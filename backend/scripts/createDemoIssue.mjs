/**
 * Creates a tiny GitHub issue for homepage demo recordings (~1 step, 1 file).
 *
 * Usage:
 *   node scripts/createDemoIssue.mjs
 *
 * Then paste the printed URL into Pullwright and record:
 *   paste URL → task logs → PR opened (trim/speed up the middle in your editor).
 */
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
    }),
)

const token = env.GITHUB_TOKEN
if (!token) {
  console.error("GITHUB_TOKEN missing in backend/.env")
  process.exit(1)
}

const body = `## Demo issue (keep tiny — for screen recording)

Add a small, visible tag on the marketing homepage so the PR is easy to spot in a demo video.

### Change (one file only)
In \`frontend/src/pages/Home.tsx\`, directly **below** the hero subheadline paragraph
(\`Paste a GitHub issue URL. Get a PR with live logs.\`), add:

\`\`\`tsx
<p className="text-xs text-faint mt-3">Recorded with Pullwright ✓</p>
\`\`\`

### Rules
- **Only** edit \`frontend/src/pages/Home.tsx\` — no other files.
- Do not refactor surrounding code.
- Single step: implement → verify file exists → open PR.

### Done when
- The new line appears under the hero subheadline on the home page.
- PR title starts with \`demo:\` or \`fix:\`.

### Notes for the agent
This is intentionally minimal for a product demo. Prefer one planner step and one executor pass.`

const res = await fetch("https://api.github.com/repos/Ayushjo/MyOwnDevin/issues", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "[DEMO] Add homepage demo tagline (1 file, ~1 min)",
    body,
    labels: ["demo", "good first issue"],
  }),
})

const data = await res.json()
if (!res.ok) {
  console.error("Failed:", data.message || JSON.stringify(data))
  process.exit(1)
}

console.log("\n✓ Demo issue created:\n")
console.log(data.html_url)
console.log("\nRecording checklist:")
console.log("  1. Start screen capture")
console.log("  2. Paste URL on homepage or /tasks/new")
console.log("  3. Show TaskView logs (trim or 2× speed the wait)")
console.log("  4. End on PR link / merged diff")
console.log("  5. Save as frontend/public/demo.mp4\n")
