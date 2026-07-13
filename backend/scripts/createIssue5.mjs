import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import path from "path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, "../.env")
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i), l.slice(i + 1)]
    })
)

const token = env.GITHUB_TOKEN
if (!token) {
  console.error("GITHUB_TOKEN missing in .env")
  process.exit(1)
}

const body = `## Problem
Users cannot cancel a long-running or stuck agent task. When a task fails and is retried,
there is no persisted record of prior attempts (duration, cost, failure reason). The Task View
also has no way to surface run history. \`GET /api/stats\` does not include cancelled tasks.

## Requirements
Implement task cancellation end-to-end, persist run-attempt history, and expose it in the API + UI.

### 1. Cancel flag + orchestrator — \`backend/src/Orchestrator/index.ts\`
- Before each step loop iteration, check Redis key \`cancel:{taskId}\` (set with 24h TTL).
- If set: clean up sandbox container, set task status to \`cancelled\`, emit \`task_cancelled\` event
  with cumulative metrics, and return without throwing.
- Do not delete the checkpoint (user may want to retry later).

### 2. \`POST /api/task/:taskId/cancel\` — \`backend/src/api/router.ts\`
- Require auth (same as other task routes).
- Set \`cancel:{taskId}\` in Redis.
- If the task is \`queued\`, remove the BullMQ job if possible.
- Return \`{ taskId, status: "cancelling" }\`.
- Return \`404\` if task not found, \`400\` if already \`done\` or \`cancelled\`.

### 3. Run attempt history — new \`backend/src/store/runHistoryStore.ts\`
- Redis list key \`attempts:{taskId}\` (LPUSH, max 10 entries, 7-day TTL).
- Each entry:
  \`{ attempt: number, startedAt: string, endedAt: string, status: "failed" | "cancelled", reason?: string, metrics: TaskMetricsSnapshot }\`
- On task failure or cancellation, append an attempt with the cumulative metrics snapshot.
- On successful completion, optionally append a final \`status: "done"\` attempt (or skip — your call, but document it).

### 4. Extend \`GET /api/task/:taskId\` — \`backend/src/api/router.ts\`
- Include \`attempts: RunAttempt[]\` from \`runHistoryStore.list(taskId)\`.
- Include \`cumulativeMetrics\` from \`taskRegistry.getMetrics(taskId)\` when present.

### 5. \`TaskRegistry\` status — \`backend/src/store/taskRegistry.ts\`
- Add \`"cancelled"\` to the \`status\` union type.
- Update \`GET /api/stats\` to count \`cancelled\` tasks.

### 6. Frontend API client — \`frontend/src/api/client.ts\`
- Add \`cancelTask(taskId)\` calling \`POST /api/task/:taskId/cancel\`.
- Extend task detail types with \`attempts\` and \`cumulativeMetrics\`.

### 7. Task View — \`frontend/src/pages/TaskView.tsx\`
- Show a **Cancel** button when status is \`running\` or \`queued\` (disabled while cancelling).
- Add a **Run History** section below metrics: list each attempt with status, duration, cost, and failure reason.
- Handle \`task_cancelled\` SSE event (set status, show reason).

### 8. Dashboard — \`frontend/src/pages/Dashboard.tsx\`
- Add a stat chip for \`cancelled\` count when \`stats.cancelled > 0\`.

## Acceptance criteria
- \`curl -X POST http://localhost:3500/api/task/<running-id>/cancel\` stops the task within one step boundary.
- Cancelled task shows status \`cancelled\` in \`GET /api/tasks\`.
- \`GET /api/task/:id\` returns \`attempts\` array after a failed then retried run.
- Task View Cancel button works; Run History shows prior failed attempt metrics.
- \`npx tsc -b\` in \`backend/\` and \`frontend/\` passes.

## Notes
- Reuse existing Redis connection patterns (\`getRedisUrl\`, TTLs like task registry).
- Cumulative metrics on retry are already partially implemented — wire run history on failure/cancel.
- Do NOT add clone/setup/deploy steps — sandbox already has the repo.
- Match existing code style and event bus patterns.`

const res = await fetch("https://api.github.com/repos/Ayushjo/MyOwnDevin/issues", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Add task cancellation, run-attempt history, and cancelled status",
    body,
    labels: ["enhancement"],
  }),
})

const data = await res.json()
if (!res.ok) {
  console.error("Failed:", data.message || JSON.stringify(data))
  process.exit(1)
}

console.log(data.html_url)
console.log(`Issue #${data.number}`)
