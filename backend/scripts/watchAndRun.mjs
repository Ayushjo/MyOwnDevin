#!/usr/bin/env node
/**
 * Submit a task, watch until done/failed, auto-retry on failure.
 * Usage: node scripts/watchAndRun.mjs [issueUrl] [--max-retries 5]
 */
const API = process.env.API_URL ?? "http://127.0.0.1:3500"
const ISSUE_URL = process.argv[2] ?? "https://github.com/Ayushjo/MyOwnDevin/issues/1"
const MAX_RETRIES = Number(process.argv.find((a, i) => process.argv[i - 1] === "--max-retries") ?? 5)
const POLL_MS = 3000

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${opts.method ?? "GET"} ${path} → ${res.status}: ${body}`)
  }
  return res.json()
}

async function createTask() {
  const { taskId } = await api("/api/task", {
    method: "POST",
    body: JSON.stringify({ issueUrl: ISSUE_URL }),
  })
  console.log(`[watch] Created task ${taskId}`)
  console.log(`[watch] UI → http://localhost:5180 (task view)`)
  return taskId
}

async function getStatus(taskId) {
  try {
    const tasks = await api("/api/tasks")
    const registry = tasks.find((t) => t.taskId === taskId)
    if (registry?.status) return registry.status
    const state = await api(`/api/task/${taskId}`)
    return state.status ?? "running"
  } catch {
    return "running"
  }
}

async function getFailureReason(taskId) {
  const events = await api(`/api/task/${taskId}/events`)
  const failed = [...events].reverse().find((e) => e.type === "task_failed")
  return failed?.reason ?? "unknown"
}

async function waitForTerminal(taskId) {
  while (true) {
    const events = await api(`/api/task/${taskId}/events`).catch(() => [])
    const last = events[events.length - 1]
    if (last) {
      const ts = last.timestamp?.slice(11, 19) ?? ""
      if (last.type === "agent_thought" && last.status === "thinking") {
        process.stdout.write(`\r[${ts}] thinking (${last.model ?? last.agent})...   `)
      } else if (last.type === "tool_call") {
        console.log(`\n[${ts}] tool: ${last.tool}`)
      } else if (last.type === "step_start") {
        console.log(`\n[${ts}] step ${last.step.id}: ${last.step.description.slice(0, 80)}`)
      } else if (last.type === "phase_start") {
        console.log(`\n[${ts}] phase: ${last.phase}`)
      }
    }

    const status = await getStatus(taskId)
    if (status === "done") {
      console.log(`\n[watch] ✅ Task ${taskId} completed`)
      return { ok: true, taskId }
    }
    if (status === "failed") {
      const reason = await getFailureReason(taskId)
      console.log(`\n[watch] ❌ Task ${taskId} failed: ${reason}`)
      return { ok: false, taskId, reason }
    }

    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

async function main() {
  console.log(`[watch] API=${API} issue=${ISSUE_URL} maxRetries=${MAX_RETRIES}`)

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`\n[watch] === Attempt ${attempt}/${MAX_RETRIES} ===`)
    const taskId = await createTask()
    const result = await waitForTerminal(taskId)
    if (result.ok) {
      console.log(`[watch] Done. Open http://localhost:5180 to see results.`)
      process.exit(0)
    }
    console.log(`[watch] Will retry in 5s...`)
    await new Promise((r) => setTimeout(r, 5000))
  }

  console.log(`[watch] Gave up after ${MAX_RETRIES} attempts`)
  process.exit(1)
}

main().catch((err) => {
  console.error("[watch] Fatal:", err.message)
  process.exit(1)
})
