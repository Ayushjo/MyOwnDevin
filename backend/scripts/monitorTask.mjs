#!/usr/bin/env node
/**
 * Live task monitor — accurate metrics + event progress, writes JSONL audit log.
 *
 * Usage:
 *   node scripts/monitorTask.mjs <taskId>
 *   node scripts/monitorTask.mjs --create https://github.com/Ayushjo/MyOwnDevin/issues/10
 *
 * Env: API_URL (default http://localhost:3500)
 */
import { mkdirSync, appendFileSync, writeFileSync } from "fs"
import { fileURLToPath } from "url"
import path from "path"

const API = process.env.API_URL ?? "http://localhost:3500"
const POLL_MS = Number(process.env.MONITOR_POLL_MS ?? 5000)
const STALL_MS = Number(process.env.MONITOR_STALL_MS ?? 90_000)
const FAILOVER_WARN = Number(process.env.MONITOR_FAILOVER_WARN ?? 5)
const COST_WARN = Number(process.env.TASK_BUDGET_USD ?? 0.08)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RUNS_DIR = path.join(__dirname, "../benchmarks/runs")

async function api(p, opts = {}) {
  const res = await fetch(`${API}${p}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${opts.method ?? "GET"} ${p} → ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

function fmtMs(ms) {
  if (!ms) return "0s"
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function fmtCost(n) {
  return `$${(n ?? 0).toFixed(4)}`
}

async function createTask(issueUrl) {
  const { taskId } = await api("/api/task", {
    method: "POST",
    body: JSON.stringify({ issueUrl }),
  })
  return taskId
}

async function snapshot(taskId) {
  const [task, metrics, events, budget] = await Promise.all([
    api(`/api/task/${taskId}`).catch(() => null),
    api(`/api/task/${taskId}/metrics`).catch(() => null),
    api(`/api/task/${taskId}/events`).catch(() => []),
    api("/api/budget").catch(() => null),
  ])

  const status = task?.status ?? "unknown"
  const completed = task?.completedStepIds ?? []
  const steps = task?.steps ?? []
  const runningStep = steps.find((s) => !completed.includes(s.id))?.id ?? null

  const lastEvent = events[events.length - 1]
  let lastLabel = "—"
  if (lastEvent) {
    if (lastEvent.type === "step_start") lastLabel = `step ${lastEvent.step?.id} start`
    else if (lastEvent.type === "tool_call") lastLabel = `tool ${lastEvent.tool}`
    else if (lastEvent.type === "agent_thought") lastLabel = `${lastEvent.agent} ${lastEvent.status}`
    else if (lastEvent.type === "task_failed") lastLabel = `FAILED: ${lastEvent.reason?.slice(0, 60)}`
    else if (lastEvent.type === "task_complete") lastLabel = "COMPLETE"
    else lastLabel = lastEvent.type
  }

  return {
    ts: new Date().toISOString(),
    taskId,
    status,
    completedSteps: completed.length,
    totalSteps: steps.length,
    runningStep,
    events: events.length,
    lastEvent: lastLabel,
    durationMs: metrics?.durationMs ?? 0,
    llmCalls: metrics?.llmCalls ?? 0,
    toolCalls: metrics?.toolCalls ?? 0,
    retries: metrics?.retries ?? 0,
    routerRetries: metrics?.routerRetries ?? 0,
    providerFailovers: metrics?.providerFailovers ?? 0,
    costUsd: metrics?.costUsd ?? 0,
    shadowCostUsd: metrics?.shadowCostUsd ?? 0,
    budgetUsedUsd: metrics?.budgetUsedUsd,
    budgetLimitUsd: metrics?.budgetLimitUsd,
    orgRemainingUsd: budget?.orgRemainingUsd,
    inputTokens: metrics?.inputTokens ?? 0,
    outputTokens: metrics?.outputTokens ?? 0,
  }
}

function printLine(s) {
  process.stdout.write(`\r${s.padEnd(120)}`)
}

function printWarn(msg) {
  console.log(`\n⚠️  ${msg}`)
}

async function main() {
  let taskId = process.argv[2]
  const createIdx = process.argv.indexOf("--create")
  if (createIdx >= 0) {
    const issueUrl = process.argv[createIdx + 1]
    if (!issueUrl) {
      console.error("Usage: monitorTask.mjs --create <issueUrl>")
      process.exit(1)
    }
    taskId = await createTask(issueUrl)
    console.log(`Created task ${taskId}`)
  }

  if (!taskId || taskId.startsWith("--")) {
    console.error("Usage: monitorTask.mjs <taskId> | --create <issueUrl>")
    process.exit(1)
  }

  mkdirSync(RUNS_DIR, { recursive: true })
  const logPath = path.join(RUNS_DIR, `${taskId}.jsonl`)
  const summaryPath = path.join(RUNS_DIR, `${taskId}-summary.json`)

  writeFileSync(logPath, "")
  console.log(`Monitoring ${taskId}`)
  console.log(`Log → ${logPath}`)
  console.log(`UI  → http://localhost:5173/task/${taskId}`)
  console.log("─".repeat(80))

  const start = Date.now()
  let lastEventCount = 0
  let lastProgressAt = Date.now()
  let maxFailovers = 0
  let warnedFailover = false
  let warnedCost = false
  let warnedStall = false
  let finalSnap = null

  while (true) {
    const snap = await snapshot(taskId)
    finalSnap = snap
    appendFileSync(logPath, JSON.stringify(snap) + "\n")

    if (snap.events > lastEventCount) {
      lastEventCount = snap.events
      lastProgressAt = Date.now()
    }

    maxFailovers = Math.max(maxFailovers, snap.providerFailovers)
    if (snap.providerFailovers >= FAILOVER_WARN && !warnedFailover) {
      printWarn(`Failovers ≥ ${FAILOVER_WARN} (${snap.providerFailovers}) — check LLM routing`)
      warnedFailover = true
    }
    if (snap.costUsd >= COST_WARN && !warnedCost) {
      printWarn(`Cost ≥ ${fmtCost(COST_WARN)} (${fmtCost(snap.costUsd)})`)
      warnedCost = true
    }
    if (Date.now() - lastProgressAt > STALL_MS && snap.status === "running" && !warnedStall) {
      printWarn(`No new events for ${STALL_MS / 1000}s — task may be stuck`)
      warnedStall = true
    }

    printLine(
      `[${fmtMs(Date.now() - start)}] ${snap.status} | steps ${snap.completedSteps}/${snap.totalSteps}` +
        ` | LLM ${snap.llmCalls} tools ${snap.toolCalls} failovers ${snap.providerFailovers}` +
        ` | ${fmtCost(snap.costUsd)} | ${snap.lastEvent}`,
    )

    if (snap.status === "done" || snap.status === "failed" || snap.status === "cancelled") {
      console.log("\n" + "─".repeat(80))
      break
    }

    await new Promise((r) => setTimeout(r, POLL_MS))
  }

  const summary = {
    ...finalSnap,
    wallMs: Date.now() - start,
    maxFailovers,
    success: finalSnap?.status === "done",
    logPath,
  }
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2))

  console.log(finalSnap?.status === "done" ? "✅ DONE" : `❌ ${finalSnap?.status?.toUpperCase()}`)
  console.log(`Duration:  ${fmtMs(finalSnap?.durationMs)} (wall ${fmtMs(summary.wallMs)})`)
  console.log(`LLM:       ${finalSnap?.llmCalls} calls, ${finalSnap?.inputTokens} in / ${finalSnap?.outputTokens} out`)
  console.log(`Tools:     ${finalSnap?.toolCalls}`)
  console.log(`Retries:   ${finalSnap?.retries} | Router retries: ${finalSnap?.routerRetries}`)
  console.log(`Failovers: ${finalSnap?.providerFailovers} (peak ${maxFailovers})`)
  console.log(`Cost:      ${fmtCost(finalSnap?.costUsd)} real / ${fmtCost(finalSnap?.shadowCostUsd)} shadow`)
  console.log(`Steps:     ${finalSnap?.completedSteps}/${finalSnap?.totalSteps}`)
  console.log(`Summary → ${summaryPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
