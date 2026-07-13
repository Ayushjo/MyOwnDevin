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
The Dashboard and History pages can only filter tasks client-side after downloading the full list.
There is no way to search tasks by title/URL from the API, and \`GET /api/stats\` recomputes counts by
loading up to 200 tasks in memory. We also have per-task metrics in Redis (\`metrics:{taskId}\`) but no
aggregate cost reporting for the dashboard.

## Requirements
Implement server-side task search and richer stats, wired through to the frontend.

### 1. \`TaskRegistry\` — \`backend/src/store/taskRegistry.ts\`
- Add \`search(query: string, opts?: { limit?: number })\` that:
  - Reads recent task IDs from \`tasks:index\` via \`zrevrange\` (newest first).
  - Loads each entry and keeps those where \`issueTitle\` or \`issueUrl\` contains \`query\` (case-insensitive).
  - Default \`limit\` = 20, cap at 50.
- Add \`aggregateStats()\` returning:
  \`{ total, queued, running, done, failed, totalCostUsd }\`
  - Count statuses by scanning recent tasks from the index (at least the most recent 200).
  - \`totalCostUsd\` = sum of \`metrics.costUsd\` from \`getMetrics(taskId)\` for those tasks (treat missing metrics as 0).

### 2. \`GET /api/tasks\` — \`backend/src/api/router.ts\`
- Support optional query param \`q\` (search string). When present, call \`taskRegistry.search(q, { limit })\` where
  \`limit\` comes from \`?limit=\` (default 20, clamp 1–50).
- When \`q\` is absent, keep existing list behaviour unchanged.
- Return \`400\` if \`q\` is provided but empty/whitespace-only.

### 3. Refactor \`GET /api/stats\` — \`backend/src/api/router.ts\`
- Replace the inline loop over \`taskRegistry.list(200)\` with \`taskRegistry.aggregateStats()\`.
- Response must include \`totalCostUsd\` (number, 2 decimal places in JSON is fine).

### 4. Frontend API client — \`frontend/src/api/client.ts\`
- Add \`searchTasks(q: string, limit?: number)\` calling \`GET /api/tasks?q=...\`.
- Extend \`StatsResponse\` type with optional \`totalCostUsd\`.

### 5. History page — \`frontend/src/pages/History.tsx\`
- When the user types in the search box, debounce (300ms) and call \`searchTasks\` instead of filtering only
  the already-loaded client list. Fall back to client filter if the API call fails.

### 6. Dashboard — \`frontend/src/pages/Dashboard.tsx\`
- If \`stats.totalCostUsd\` is present, show it in the stats row (e.g. label "Total cost").

## Acceptance criteria
- \`curl "http://localhost:3500/api/tasks?q=pagination"\` returns only tasks whose title or URL matches.
- \`curl "http://localhost:3500/api/tasks?q="\` returns HTTP 400.
- \`curl http://localhost:3500/api/stats\` returns \`totalCostUsd\` alongside status counts.
- History search box triggers server-side search (network tab shows \`/api/tasks?q=\`).
- \`npx tsc -b\` in \`backend/\` and \`frontend/\` passes with no errors.

## Notes
- Do NOT add clone/setup/deploy steps — the sandbox already has the repo.
- Use existing Redis keys (\`tasks:index\`, \`task:{id}\`, \`metrics:{id}\`) — no new database.
- Keep changes minimal and match existing code style.`

const res = await fetch("https://api.github.com/repos/Ayushjo/MyOwnDevin/issues", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Add task search API and aggregate stats with total cost",
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
