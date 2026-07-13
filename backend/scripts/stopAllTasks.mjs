#!/usr/bin/env node
/**
 * Nuclear stop — clears zombie BullMQ jobs, fails all running/queued tasks,
 * kills all sandbox containers. Restart the backend after running this.
 *
 * Usage: node scripts/stopAllTasks.mjs
 */
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import path from "path"
import { Redis } from "ioredis"
import { Queue } from "bullmq"
import Docker from "dockerode"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(path.join(__dirname, "../.env"), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)

function redisOptsFromUrl(urlStr) {
  const url = new URL(urlStr)
  const opts = {
    host: url.hostname,
    port: Number(url.port) || 6379,
    maxRetriesPerRequest: null,
  }
  if (url.username) opts.username = decodeURIComponent(url.username)
  if (url.password) opts.password = decodeURIComponent(url.password)
  if (url.protocol === "rediss:") opts.tls = {}
  return opts
}

const redisOpts = redisOptsFromUrl(env.REDIS_URL)
const redis = new Redis(redisOpts)
const queue = new Queue("tasks", { connection: redisOpts })
const PREFIX = "bull:tasks"

const docker = new Docker(
  process.env.DOCKER_HOST
    ? { socketPath: process.env.DOCKER_HOST }
    : { socketPath: "/var/run/docker.sock" },
)

async function killAllContainers() {
  const containers = await docker.listContainers({ all: true, filters: { label: ["taskId"] } })
  for (const c of containers) {
    const container = docker.getContainer(c.Id)
    const taskId = c.Labels?.taskId ?? "?"
    try { await container.kill() } catch { /* stopped */ }
    try { await container.remove({ force: true }) } catch { /* gone */ }
    console.log(`  container ${c.Id.slice(0, 12)} taskId=${taskId.slice(0, 8)}… removed`)
  }
  if (!containers.length) console.log("  no sandbox containers")
}

async function forceRemoveJob(job) {
  const id = job.id
  try {
    await job.remove()
    console.log(`  removed job ${id} (${job.data?.taskId?.slice(0, 8)}…)`)
    return
  } catch {
    /* locked — manual redis cleanup */
  }
  await redis.del(`${PREFIX}:${id}:lock`)
  await redis.lrem(`${PREFIX}:active`, 0, id)
  await redis.zrem(`${PREFIX}:stalled`, id)
  await redis.del(`${PREFIX}:${id}`)
  await redis.del(`${PREFIX}:${id}:logs`)
  console.log(`  force-purged locked job ${id} (${job.data?.taskId?.slice(0, 8)}…)`)
}

async function purgeQueue() {
  await queue.pause()
  const states = ["active", "waiting", "delayed", "paused"]
  for (const state of states) {
    const jobs = await queue.getJobs([state], 0, 200)
    if (jobs.length) console.log(`\n${state}: ${jobs.length} job(s)`)
    for (const job of jobs) await forceRemoveJob(job)
  }
  await redis.del(`${PREFIX}:active`)
  await redis.del(`${PREFIX}:wait`)
  await redis.del(`${PREFIX}:paused`)
  await redis.del(`${PREFIX}:delayed`)
  await queue.resume()
  console.log("\nqueue drained")
}

async function failRunningRegistry() {
  const keys = await redis.keys("task:*")
  let n = 0
  for (const key of keys) {
    if (key === "tasks:index") continue
    const raw = await redis.get(key)
    if (!raw) continue
    let entry
    try { entry = JSON.parse(raw) } catch { continue }
    if (entry.status !== "running" && entry.status !== "queued") continue
    entry.status = "failed"
    entry.updatedAt = new Date().toISOString()
    await redis.set(key, JSON.stringify(entry), "EX", 60 * 60 * 24 * 7)
    console.log(`  ${entry.taskId.slice(0, 8)}… → failed`)
    n++
  }
  if (!n) console.log("  no running/queued registry entries")
}

async function main() {
  console.log("=== Stopping all Pullwright tasks ===\n")

  console.log("Docker sandboxes:")
  await killAllContainers().catch((e) => console.warn("  docker:", e.message))

  console.log("\nBullMQ queue:")
  await purgeQueue().catch((e) => console.warn("  queue:", e.message))

  console.log("\nTask registry:")
  await failRunningRegistry()

  const active = await queue.getJobs(["active", "waiting"], 0, 10)
  console.log(`\nVerify: ${active.length} jobs remaining (should be 0)`)

  await queue.close()
  await redis.quit()

  console.log("\n✓ Done. RESTART the backend now so the hung worker releases:")
  console.log("  cd backend && npm run dev")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
