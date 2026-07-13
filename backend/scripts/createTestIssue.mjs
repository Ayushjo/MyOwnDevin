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
The backend has no health check endpoint. We need a simple way to verify the server and Redis are up.

## Requirements
- Add \`GET /api/health\` in \`backend/src/api/router.ts\`
- Return JSON: \`{ "status": "ok", "redis": "connected" | "disconnected", "uptime": <seconds> }\`
- Ping Redis to determine connection status
- Do not require API auth on this endpoint

## Acceptance criteria
- \`curl http://localhost:3500/api/health\` returns 200 with the JSON above
- Works when Redis is down (returns disconnected, not a crash)`

const res = await fetch("https://api.github.com/repos/Ayushjo/MyOwnDevin/issues", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Add GET /api/health endpoint with Redis status",
    body,
    labels: ["enhancement", "good first issue"],
  }),
})

const data = await res.json()
if (!res.ok) {
  console.error("Failed:", data.message || JSON.stringify(data))
  process.exit(1)
}

console.log(data.html_url)
