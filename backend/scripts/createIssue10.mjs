import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import path from "path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(path.join(__dirname, "../.env"), "utf8")
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
After task cancellation (#7) and paginated search (#9), users still cannot see a unified **activity timeline**
for a task. Run-attempt history lives in \`attempts:{taskId}\`, live events are ephemeral, and there is no
persisted per-step audit trail for the Task View. This issue is **harder than #7**: it touches the orchestrator,
a new Redis store, API aggregation, and a **large frontend file** (\`TaskView.tsx\`).

## Stress areas (read carefully)
This issue intentionally exercises patterns that previously failed:
- **Large file edit**: \`frontend/src/pages/TaskView.tsx\` is 300+ lines — use \`view_file\` in line ranges before \`write_file\`.
- **Valid tool JSON**: \`write_file\` arguments must be properly escaped; write the **complete** file.
- **Canonical tools only**: \`search_code\`, \`read_file\`, \`view_file\`, \`write_file\`, \`run_shell\`, \`list_dir\` — do NOT use \`repo_browser.*\` aliases.
- **Orchestrator wiring**: hook into the existing step loop without breaking cancel/checkpoint behaviour from #7.
- **Type safety**: update shared types before UI; \`npx tsc -b\` must pass in backend and frontend.

## Requirements

### 1. Activity store — NEW \`backend/src/store/activityStore.ts\`
- Redis list key \`activity:{taskId}\` (LPUSH, max 100 entries, 7-day TTL).
- Entry shape:
  \`{ id: string, ts: string, type: "step_start" | "step_done" | "phase" | "note", stepId?: number, phase?: string, message: string, meta?: Record<string, unknown> }\`
- Methods: \`append(taskId, entry)\`, \`list(taskId, limit = 50)\`, \`clear(taskId)\`.

### 2. Orchestrator — \`backend/src/Orchestrator/index.ts\`
- Import and use \`ActivityStore\`.
- On each \`phase_start\` / \`step_start\` / \`step_done\`, append a matching activity entry.
- On task failure or cancellation, append a \`type: "note"\` entry with the failure/cancel reason.
- Do **not** remove or break existing cancel-flag checks or checkpoint saves.

### 3. Activity API — \`backend/src/api/router.ts\`
- \`GET /api/task/:taskId/activity?limit=50\` → \`{ activities: ActivityEntry[] }\`
- Extend \`GET /api/task/:taskId\` to include \`activities\` (last 20) alongside existing fields.
- If \`runHistoryStore\` exists from #7, merge \`attempts\` into the task detail response as \`attempts\` (do not duplicate logic — import the store).

### 4. Stats — \`backend/src/api/router.ts\` + \`taskRegistry.ts\`
- Add \`runningOverMinutes(minutes: number)\` to TaskRegistry — count tasks in \`running\` status older than N minutes (scan recent index).
- Extend \`GET /api/stats\` with \`staleRunning: number\` (tasks running > 30 minutes).

### 5. Frontend types — \`frontend/src/types/task.ts\`
- Add \`ActivityEntry\` type matching the backend shape.
- Extend task detail type with optional \`activities\` and \`attempts\`.

### 6. Frontend API — \`frontend/src/api/client.ts\`
- Add \`getTaskActivity(taskId, limit?)\`.
- Extend \`StatsResponse\` with \`staleRunning?: number\`.

### 7. Task View — \`frontend/src/pages/TaskView.tsx\` (**large file**)
- Add an **Activity Timeline** section below the metrics panel.
- Render \`activities\` chronologically (newest first or oldest first — pick one, be consistent).
- If \`attempts\` are present, show a collapsible **Run History** block (attempt #, status, duration, cost).
- Keep existing retry/cancel UI working — integrate, do not remove.

### 8. Dashboard — \`frontend/src/pages/Dashboard.tsx\`
- If \`stats.staleRunning > 0\`, show a warning chip/card: "\${n} stale running tasks".

### 9. History — \`frontend/src/pages/History.tsx\`
- For each task row, show the latest activity \`message\` as a subtitle when available (fetch from task detail or list endpoint).

### 10. Verification
- Run \`cd /workspace/backend && npx tsc -b --noEmit\` and \`cd /workspace/frontend && npx tsc -b --noEmit\`.

## Acceptance criteria
- \`curl http://localhost:3500/api/task/<id>/activity\` returns JSON with \`activities\` array.
- \`curl http://localhost:3500/api/stats\` includes \`staleRunning\`.
- Task View shows Activity Timeline after a task runs at least one step.
- Cancelled/failed tasks have a note activity entry with reason.
- Both \`tsc -b\` checks pass.
- PR contains changes across **≥8 files** (store + orchestrator + router + registry + client + types + 2 pages minimum).

## Notes
- Repo is pre-cloned at \`/workspace\`. Do not add clone/npm-install steps.
- One focused step per file where possible.
- Prefer minimal diffs; do not rewrite unrelated code.`

const res = await fetch("https://api.github.com/repos/Ayushjo/MyOwnDevin/issues", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "[HARD] Task activity timeline, stale-run stats, and TaskView integration (orchestrator + large UI)",
    body,
    labels: ["enhancement"],
  }),
})

const data = await res.json()
if (!res.ok) {
  console.error("Failed:", data.message || JSON.stringify(data))
  process.exit(1)
}

console.log(JSON.stringify({ number: data.number, url: data.html_url }, null, 2))
