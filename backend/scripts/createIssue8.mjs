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
The Dashboard and History pages load a flat list of tasks and filter client-side. As task volume
grows this breaks down: no pagination, no server-side search, and \`GET /api/stats\` scans up to 200
tasks in the router while ignoring per-task cost metrics already stored in Redis.

## Requirements
Implement paginated task listing with optional status filter and search, aggregate cost stats, and
wire both into the frontend. Touch backend store + API + frontend client + two pages.

### 1. \`TaskRegistry\` — \`backend/src/store/taskRegistry.ts\`
- Extend \`list()\` to accept \`opts?: { limit?: number; offset?: number; status?: TaskRegistryEntry["status"] }\`.
  - Use \`zrevrange\` on \`tasks:index\` with offset/limit (defaults: limit=20, offset=0).
  - When \`status\` is set, filter entries after loading.
- Add \`count(status?)\` → total tasks (optionally filtered by status).
- Add \`search(query: string, opts?: { limit?: number })\`:
  - Scan recent IDs from index (newest first), case-insensitive match on \`issueTitle\` or \`issueUrl\`.
  - Default limit 20, max 50.
- Add \`aggregateStats()\` → \`{ total, queued, running, done, failed, totalCostUsd }\`:
  - Scan up to 200 recent tasks; sum \`metrics.costUsd\` via \`getMetrics(taskId)\` (missing = 0).

### 2. \`GET /api/tasks\` — \`backend/src/api/router.ts\`
- Query params: \`limit\` (1–100, default 20), \`offset\` (≥0, default 0), \`status\` (optional),
  \`q\` (optional search).
- If \`q\` is present but empty/whitespace → 400.
- If \`status\` is invalid → 400.
- When \`q\` is set, use \`search()\`; otherwise use paginated \`list()\`.
- Response envelope (not a bare array):
  \`\`\`json
  { "tasks": [...], "total": <number>, "limit": <number>, "offset": <number> }
  \`\`\`

### 3. \`GET /api/stats\` — \`backend/src/api/router.ts\`
- Replace inline loop with \`taskRegistry.aggregateStats()\`.
- Include \`totalCostUsd\` in the JSON response.

### 4. Frontend API — \`frontend/src/api/client.ts\`
- Update \`listTasks()\` to parse the new paginated envelope (return \`tasks\` array for backward compat
  OR add \`listTasksPaginated(limit?, offset?, status?)\` — update Dashboard callers accordingly).
- Add \`searchTasks(q: string, limit?: number)\`.
- Extend \`StatsResponse\` with \`totalCostUsd?: number\`.

### 5. Types — \`frontend/src/types/task.ts\`
- Add \`PaginatedTasksResponse\` type matching the API envelope.

### 6. History page — \`frontend/src/pages/History.tsx\`
- Debounce search input (300ms) and call \`searchTasks\` when the user types.
- Add "Load more" or simple prev/next pagination using \`offset\` + \`total\` from the API.
- Fall back to client-side filter if the search API fails.

### 7. Dashboard — \`frontend/src/pages/Dashboard.tsx\`
- Use paginated \`GET /api/tasks\` (first page) instead of assuming a flat array.
- Show \`totalCostUsd\` from stats when present (label: "Total cost").

## Acceptance criteria
- \`curl "http://localhost:3500/api/tasks?limit=5&offset=0"\` → envelope with ≤5 tasks + \`total\`.
- \`curl "http://localhost:3500/api/tasks?status=done"\` → only done tasks.
- \`curl "http://localhost:3500/api/tasks?status=invalid"\` → HTTP 400.
- \`curl "http://localhost:3500/api/tasks?q=cancel"\` → matching tasks only.
- \`curl "http://localhost:3500/api/tasks?q="\` → HTTP 400.
- \`curl http://localhost:3500/api/stats\` → includes \`totalCostUsd\`.
- \`npx tsc -b\` passes in both \`backend/\` and \`frontend/\`.
- History search box hits the API; Dashboard shows total cost.

## Notes
- Do NOT add clone/npm-install steps — repo is pre-cloned in the sandbox.
- Keep changes minimal and focused on the files above.
- One step per file where possible.`

const res = await fetch("https://api.github.com/repos/Ayushjo/MyOwnDevin/issues", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Add paginated task listing, search API, aggregate cost stats, and History/Dashboard wiring",
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
