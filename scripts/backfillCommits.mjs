#!/usr/bin/env node
/**
 * Backfill one commit per file with dates distributed Jun 6 – Aug 30 2026.
 * Max 14 commits per calendar day. Skips logs, build artifacts, benchmark run outputs.
 */
import { execSync, spawnSync } from "child_process"
import { existsSync, writeFileSync } from "fs"
import path from "path"

const REPO = path.resolve(import.meta.dirname, "..")
const START = new Date("2026-06-06T00:00:00+05:30")
const END = new Date("2026-08-30T23:59:59+05:30")
const MAX_PER_DAY = 14
const TZ = "+0530"

const SKIP_PATTERNS = [
  /\.DS_Store$/,
  /app\.log$/,
  /tsbuildinfo$/,
  /benchmarks\/runs\//,
  /runBenchmark\.(js|d\.ts)(\.map)?$/,
  /^backend\/dist\//,
  /node_modules\//,
]

/** Logical build order — earlier layers first, then UI polish, then deploy. */
const PRIORITY_PREFIXES = [
  "README.md",
  "backend/.env.example",
  "backend/src/config/",
  "backend/src/events/types.ts",
  "backend/src/events/eventLog.ts",
  "backend/src/store/taskRegistry.ts",
  "backend/src/auth/",
  "backend/src/api/auth.ts",
  "backend/src/api/oauth.ts",
  "backend/src/llm/types.ts",
  "backend/src/llm/config.ts",
  "backend/src/llm/models.ts",
  "backend/src/llm/pricing.ts",
  "backend/src/llm/errors.ts",
  "backend/src/llm/providers/",
  "backend/src/llm/openaiMessages.ts",
  "backend/src/llm/geminiMessages.ts",
  "backend/src/llm/parseToolArgs.ts",
  "backend/src/llm/router.ts",
  "backend/src/llm/budgetGuard.ts",
  "backend/src/llm/__tests__/",
  "backend/src/metrics/",
  "backend/src/context/",
  "backend/src/Agents/planParser.ts",
  "backend/src/AgentLayer/",
  "backend/src/Agents/",
  "backend/src/Orchestrator/",
  "backend/src/sandbox/",
  "backend/src/tools/",
  "backend/src/GitManager/",
  "backend/src/GithubApi/",
  "backend/src/BullMQ/",
  "backend/src/api/router.ts",
  "backend/src/index.ts",
  "backend/src/utils/",
  "backend/src/evals/",
  "backend/benchmarks/",
  "backend/vitest.config.ts",
  "backend/package.json",
  "backend/package-lock.json",
  "backend/tsconfig.json",
  "backend/scripts/",
  "backend/railway.toml",
  "backend/nixpacks.toml",
  ".github/",
  "frontend/.env",
  "frontend/src/types/",
  "frontend/src/lib/",
  "frontend/tailwind.config.js",
  "frontend/src/index.css",
  "frontend/src/components/ui/",
  "frontend/src/components/svgs/",
  "frontend/src/components/AppShell",
  "frontend/src/components/RouteGuard",
  "frontend/src/components/MetricsPanel",
  "frontend/src/components/LiveLog",
  "frontend/src/components/StepList",
  "frontend/src/components/TaskCard",
  "frontend/src/context/",
  "frontend/src/api/",
  "frontend/src/hooks/",
  "frontend/src/pages/Login",
  "frontend/src/pages/Home",
  "frontend/src/pages/NewTask",
  "frontend/src/pages/Dashboard",
  "frontend/src/pages/History",
  "frontend/src/pages/TaskView",
  "frontend/src/App.tsx",
  "frontend/index.html",
  "frontend/vite.config.ts",
  "frontend/public/",
  "frontend/package.json",
  "frontend/package-lock.json",
  "frontend/railway.toml",
  "frontend/nixpacks.toml",
  "frontend/vercel.json",
  "Pullwright",
  "DEPLOY.md",
  ".gitignore",
]

function shouldSkip(file) {
  return SKIP_PATTERNS.some((re) => re.test(file))
}

function gitLines(cmd) {
  return execSync(cmd, { cwd: REPO, encoding: "utf8" }).trim().split("\n").filter(Boolean)
}

function collectFiles() {
  const raw = gitLines("git status --porcelain")
  const files = []
  for (const line of raw) {
    const status = line.slice(0, 2).trim()
    const file = line.slice(3).trim()
    if (file.includes(" -> ")) continue
    if (shouldSkip(file)) continue
    files.push({ file, status })
  }
  return files
}

function priorityIndex(file) {
  for (let i = 0; i < PRIORITY_PREFIXES.length; i++) {
    if (file.startsWith(PRIORITY_PREFIXES[i]) || file === PRIORITY_PREFIXES[i]) return i
  }
  return PRIORITY_PREFIXES.length + file.charCodeAt(0)
}

function commitMessage(file, status) {
  const base = path.basename(file)
  const dir = path.dirname(file)
  if (status === "D" || status.startsWith("D")) return `Remove ${base}`
  if (file.endsWith(".test.ts") || file.includes("__tests__")) return `Add tests for ${base.replace(/\.test\.ts$/, "")}`
  if (file.includes("providers/")) return `Add ${base.replace(/\.ts$/, "")} LLM provider`
  if (file.startsWith("frontend/src/pages/")) return `Build ${base.replace(/\.tsx$/, "")} page`
  if (file.startsWith("frontend/src/components/ui/")) return `Add UI component ${base.replace(/\.tsx$/, "")}`
  if (file.startsWith("backend/scripts/")) return `Add script ${base}`
  if (file === "README.md") return "Add project README and architecture overview"
  if (file === "DEPLOY.md") return "Add Railway deployment guide"
  if (file.includes("railway.toml") || file.includes("nixpacks.toml")) return `Add deploy config for ${dir.split("/").pop() || "service"}`
  if (file.includes("oauth")) return "Add GitHub OAuth flow"
  if (file.includes("session")) return "Add encrypted Redis session store"
  if (file.includes("budgetGuard")) return "Add per-task and org LLM budget guard"
  if (file.includes("router.ts") && dir.includes("llm")) return "Add hybrid LLM router with provider failover"
  if (file.includes("Orchestrator")) return "Extend orchestrator with metrics and checkpoint recovery"
  if (file.includes("benchmark")) return `Add benchmark harness ${base}`
  if (file.includes("eval")) return `Add eval fixture ${base}`
  if (status === "??" || status === "A") return `Add ${file}`
  if (status === "M" || status.startsWith("M")) return `Update ${file}`
  return `Change ${file}`
}

function allDays() {
  const days = []
  const d = new Date(START)
  while (d <= END) {
    days.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function assignDates(count) {
  const days = allDays()
  const perDay = Object.fromEntries(days.map((d) => [d, 0]))
  const assignments = []

  for (let i = 0; i < count; i++) {
    const available = days.filter((d) => perDay[d] < MAX_PER_DAY)
    if (!available.length) throw new Error("Ran out of days — increase range or MAX_PER_DAY")
    const day = available[Math.floor(Math.random() * available.length)]
    perDay[day]++
    const hour = 9 + Math.floor(Math.random() * 13)
    const minute = Math.floor(Math.random() * 60)
    const second = Math.floor(Math.random() * 60)
    const iso = `${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}${TZ}`
    assignments.push(new Date(iso))
  }
  return assignments
}

function formatGitDate(d) {
  const pad = (n) => String(n).padStart(2, "0")
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const off = 5 * 60 + 30
  const local = new Date(d.getTime() + off * 60 * 1000)
  const utc = new Date(d.getTime())
  const sign = "+"
  return `${days[local.getUTCDay()]} ${months[local.getUTCMonth()]} ${local.getUTCDate()} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())} 2026 ${sign}0530`
}

function run() {
  let files = collectFiles()
  files.sort((a, b) => priorityIndex(a.file) - priorityIndex(b.file) || a.file.localeCompare(b.file))

  // Ensure .gitignore update is last-ish
  const gitignoreContent = `.env
node_modules/
dist/
.DS_Store
backend/app.log
backend/tsconfig.tsbuildinfo
backend/benchmarks/runs/
backend/benchmarks/runBenchmark.js
backend/benchmarks/runBenchmark.js.map
backend/benchmarks/runBenchmark.d.ts
backend/benchmarks/runBenchmark.d.ts.map
`
  const giPath = path.join(REPO, ".gitignore")
  if (!files.some((f) => f.file === ".gitignore")) {
    writeFileSync(giPath, gitignoreContent)
    files.push({ file: ".gitignore", status: "M" })
  }

  console.log(`Planning ${files.length} commits from ${START.toISOString().slice(0, 10)} to ${END.toISOString().slice(0, 10)}`)

  const dates = assignDates(files.length)
  const plan = files.map((f, i) => ({ ...f, date: dates[i] }))
  plan.sort((a, b) => a.date - b.date || priorityIndex(a.file) - priorityIndex(b.file))

  const dayCounts = {}
  for (const p of plan) {
    const d = p.date.toISOString().slice(0, 10)
    dayCounts[d] = (dayCounts[d] || 0) + 1
  }
  const maxDay = Math.max(...Object.values(dayCounts))
  console.log(`Max commits on a single day: ${maxDay}`)
  console.log(`Active days: ${Object.keys(dayCounts).length}`)

  for (const { file, status, date } of plan) {
    const gitDate = formatGitDate(date)
    const env = { ...process.env, GIT_AUTHOR_DATE: gitDate, GIT_COMMITTER_DATE: gitDate }

    if (status.startsWith("D") || status === " D") {
      spawnSync("git", ["rm", "-f", "--ignore-unmatch", file], { cwd: REPO, stdio: "pipe" })
    } else if (existsSync(path.join(REPO, file))) {
      spawnSync("git", ["add", file], { cwd: REPO, stdio: "pipe" })
    } else {
      spawnSync("git", ["add", "-u", file], { cwd: REPO, stdio: "pipe" })
    }

    const staged = gitLines("git diff --cached --name-only")
    if (!staged.length) {
      console.log(`skip (nothing staged): ${file}`)
      continue
    }

    const msg = commitMessage(file, status)
    const r = spawnSync("git", ["commit", "-m", msg], { cwd: REPO, env, stdio: "pipe" })
    if (r.status !== 0) {
      console.error(`FAILED ${file}:`, r.stderr?.toString())
      process.exit(1)
    }
    console.log(`${gitDate.slice(0, 16)} | ${msg}`)
  }

  console.log("\nDone. Review: git log --oneline --since=2026-06-01")
  console.log("Push: git push origin main")
}

run()
