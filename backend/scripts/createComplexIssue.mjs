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
\`GET /api/tasks\` currently returns a fixed list of the 50 most recent tasks with no way to page
through older runs or filter by status. As the task history grows this becomes unusable for the
Dashboard and History pages.

## Requirements
Enhance the tasks listing to support pagination and status filtering, end-to-end.

### 1. \`TaskRegistry.list()\` — \`backend/src/store/taskRegistry.ts\`
- Change the signature to accept an options object:
  \`list(opts?: { limit?: number; offset?: number; status?: "queued" | "running" | "done" | "failed" })\`
- Use the existing sorted set index (\`tasks:index\`) with \`zrevrange\` to apply \`offset\` + \`limit\`
  (default \`limit\` = 20, default \`offset\` = 0).
- When \`status\` is provided, only return entries whose \`status\` matches.
- Also add a \`count(status?)\` method that returns the total number of tasks (optionally filtered
  by status) so the API can report a total for pagination.

### 2. \`GET /api/tasks\` — \`backend/src/api/router.ts\`
- Read \`limit\`, \`offset\`, and \`status\` from the query string (validate/clamp: \`limit\` between 1 and
  100, \`offset\` >= 0; reject an invalid \`status\` with 400).
- Return a paginated envelope instead of a bare array:
  \`\`\`json
  { "tasks": [ ... ], "total": <number>, "limit": <number>, "offset": <number> }
  \`\`\`

## Acceptance criteria
- \`curl "http://localhost:3500/api/tasks?limit=5&offset=0"\` returns at most 5 tasks plus the total.
- \`curl "http://localhost:3500/api/tasks?status=done"\` returns only completed tasks.
- \`curl "http://localhost:3500/api/tasks?status=bogus"\` returns HTTP 400.
- Existing callers still get their data under the new \`tasks\` key (update any internal usage).
- \`npx tsc -b\` in \`backend/\` passes with no errors.`

const res = await fetch("https://api.github.com/repos/Ayushjo/MyOwnDevin/issues", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Add pagination and status filtering to GET /api/tasks",
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
