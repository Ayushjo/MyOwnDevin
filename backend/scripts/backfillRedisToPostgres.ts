/**
 * Backfill Redis task registry, metrics, and event logs into Neon/Postgres.
 *
 * Redis never stored user_id — you must assign an owner:
 *   npm run db:backfill -- --github-login=yourname
 *   npm run db:backfill -- --user-id=<uuid>
 *
 * Dry run (no writes):
 *   npm run db:backfill -- --github-login=yourname --dry-run
 */
import { Redis } from "ioredis"
import { PrismaClient, type TaskStatus } from "@prisma/client"
import { createRedisClient } from "../src/config/redis.js"

type RedisTask = {
  taskId: string
  issueUrl: string
  issueTitle: string
  issueNumber: number
  status: "queued" | "running" | "done" | "failed"
  createdAt: string
  updatedAt: string
  prUrl?: string
}

type TaskMetricsSnapshot = {
  inputTokens: number
  outputTokens: number
  costUsd: number
  shadowCostUsd: number
  llmCalls: number
  toolCalls: number
  retries: number
  routerRetries?: number
  providerFailovers?: number
  durationMs: number
  phases: Record<string, unknown>
  budgetUsedUsd?: number
  budgetLimitUsd?: number
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run")
  const skipUsage = argv.includes("--skip-usage")
  const userId = argv.find((a) => a.startsWith("--user-id="))?.split("=")[1]
  const githubLogin = argv.find((a) => a.startsWith("--github-login="))?.split("=")[1]
  return { dryRun, skipUsage, userId, githubLogin }
}

function parseRepo(issueUrl: string): { owner: string | null; repo: string | null } {
  const m = issueUrl.match(/github\.com\/([^/]+)\/([^/]+)/i)
  if (!m) return { owner: null, repo: null }
  return { owner: m[1] ?? null, repo: m[2]?.replace(/\.git$/, "") ?? null }
}

function mapStatus(status: RedisTask["status"]): TaskStatus {
  return status
}

async function scanTaskKeys(redis: Redis): Promise<string[]> {
  const ids = new Set<string>()
  let cursor = "0"
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", "task:*", "COUNT", 200)
    cursor = next
    for (const key of keys) {
      const taskId = key.replace(/^task:/, "")
      if (taskId) ids.add(taskId)
    }
  } while (cursor !== "0")
  return [...ids]
}

async function resolveUserId(
  db: PrismaClient,
  opts: { userId?: string; githubLogin?: string },
): Promise<{ userId: string; login: string }> {
  if (opts.userId) {
    const user = await db.user.findUnique({ where: { id: opts.userId } })
    if (!user) throw new Error(`No user found for id ${opts.userId}. Sign in via OAuth first.`)
    return { userId: user.id, login: user.login }
  }
  if (opts.githubLogin) {
    const user = await db.user.findUnique({ where: { login: opts.githubLogin } })
    if (!user) {
      throw new Error(
        `No user found for login "${opts.githubLogin}". Sign in via OAuth once so the user row exists.`,
      )
    }
    return { userId: user.id, login: user.login }
  }
  throw new Error("Pass --user-id=<uuid> or --github-login=<name> to assign task ownership.")
}

function failureReasonFromEvents(events: Array<{ type: string; reason?: string }>): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i]
    if (ev?.type === "task_failed" && ev.reason) return ev.reason
  }
  return null
}

async function main() {
  const { dryRun, skipUsage, userId, githubLogin } = parseArgs(process.argv.slice(2))

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set in backend/.env")
  }

  const db = new PrismaClient()
  const redis = createRedisClient()
  const owner = await resolveUserId(db, { userId, githubLogin })

  const taskIds = await scanTaskKeys(redis)
  console.log(`Found ${taskIds.length} task(s) in Redis. Assigning to @${owner.login} (${owner.userId})`)
  if (dryRun) console.log("(dry run — no database writes)\n")

  let created = 0
  let updated = 0
  let skipped = 0
  let eventsInserted = 0
  let metricsInserted = 0

  for (const taskId of taskIds) {
    const raw = await redis.get(`task:${taskId}`)
    if (!raw) {
      skipped++
      continue
    }

    let task: RedisTask
    try {
      task = JSON.parse(raw) as RedisTask
    } catch {
      console.warn(`  skip ${taskId}: invalid JSON`)
      skipped++
      continue
    }

    const existing = await db.task.findUnique({ where: { id: taskId } })
    const { owner: repoOwner, repo } = parseRepo(task.issueUrl)
    const completedAt =
      task.status === "done" || task.status === "failed" ? new Date(task.updatedAt) : null

    const eventRaw = await redis.lrange(`events:${taskId}`, 0, -1)
    const events = eventRaw.map((item) => JSON.parse(item) as { type: string; reason?: string })
    const failureReason = task.status === "failed" ? failureReasonFromEvents(events) : null

    if (dryRun) {
      console.log(
        `  would sync ${taskId} status=${task.status} events=${events.length} metrics=${(await redis.get(`metrics:${taskId}`)) ? "yes" : "no"}`,
      )
      continue
    }

    if (!existing) {
      await db.task.create({
        data: {
          id: taskId,
          userId: owner.userId,
          issueUrl: task.issueUrl,
          issueTitle: task.issueTitle,
          issueNumber: task.issueNumber,
          repoOwner: repoOwner,
          repoName: repo,
          branchName: `devin/task-${taskId}`,
          status: mapStatus(task.status),
          prUrl: task.prUrl ?? null,
          failureReason,
          githubLogin: owner.login,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
          completedAt,
        },
      })
      created++
    } else {
      await db.task.update({
        where: { id: taskId },
        data: {
          issueTitle: task.issueTitle,
          issueNumber: task.issueNumber,
          status: mapStatus(task.status),
          prUrl: task.prUrl ?? null,
          failureReason,
          updatedAt: new Date(task.updatedAt),
          completedAt,
        },
      })
      updated++
    }

    const metricsRaw = await redis.get(`metrics:${taskId}`)
    if (metricsRaw) {
      const m = JSON.parse(metricsRaw) as TaskMetricsSnapshot
      const metricsData = {
        durationMs: m.durationMs ?? 0,
        inputTokens: m.inputTokens ?? 0,
        outputTokens: m.outputTokens ?? 0,
        costUsd: m.costUsd ?? 0,
        shadowCostUsd: m.shadowCostUsd ?? 0,
        llmCalls: m.llmCalls ?? 0,
        toolCalls: m.toolCalls ?? 0,
        retries: m.retries ?? 0,
        routerRetries: m.routerRetries ?? null,
        providerFailovers: m.providerFailovers ?? null,
        phases: (m.phases ?? {}) as object,
        budgetUsedUsd: m.budgetUsedUsd ?? null,
        budgetLimitUsd: m.budgetLimitUsd ?? null,
      }
      await db.taskMetrics.upsert({
        where: { taskId },
        create: { taskId, ...metricsData },
        update: metricsData,
      })
      metricsInserted++

      if (!skipUsage && (task.status === "done" || task.status === "failed") && (m.costUsd ?? 0) > 0) {
        const already = await db.usageRecord.findFirst({ where: { taskId } })
        if (!already) {
          const now = new Date()
          const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
          const periodEnd = new Date(periodStart)
          periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1)
          await db.usageRecord.create({
            data: {
              userId: owner.userId,
              taskId,
              usageType: "llm_cost",
              quantity: 1,
              unitAmountUsd: m.costUsd,
              totalUsd: m.costUsd,
              periodStart,
              periodEnd,
              metadata: { backfill: true },
            },
          })
        }
      }
    }

    if (events.length > 0) {
      const existingCount = await db.taskEvent.count({ where: { taskId } })
      if (existingCount === 0) {
        await db.taskEvent.createMany({
          data: events.map((payload, sequence) => ({
            taskId,
            sequence,
            eventType: payload.type,
            payload: payload as object,
          })),
        })
        eventsInserted += events.length
      }
    }

    console.log(`  synced ${taskId} (${task.status}, ${events.length} events)`)
  }

  console.log("\nDone.")
  console.log(`  tasks created: ${created}`)
  console.log(`  tasks updated: ${updated}`)
  console.log(`  tasks skipped: ${skipped}`)
  console.log(`  metrics upserted: ${metricsInserted}`)
  console.log(`  events inserted: ${eventsInserted}`)

  await redis.quit()
  await db.$disconnect()
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
