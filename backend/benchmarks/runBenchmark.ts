/**
 * Benchmark harness — runs issues end-to-end and records cost/time/success.
 *
 * Usage: npm run benchmark
 * Requires: Redis, Docker, API keys, GITHUB_TOKEN
 */
import { readFileSync, writeFileSync } from "fs"
import { fileURLToPath } from "url"
import path from "path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API_BASE = process.env.API_URL ?? "http://localhost:3500"
const POLL_INTERVAL_MS = 5000
const MAX_WAIT_MS = 30 * 60 * 1000
const DEFAULT_MAX_COST = Number(process.env.TASK_BUDGET_USD ?? 0.25)

type BenchmarkIssue = {
  id: string
  issueUrl: string
  description: string
  complexity: string
  expectedFiles: number
  maxCostUsd?: number
}

type BenchmarkResult = {
  id: string
  issueUrl: string
  complexity: string
  success: boolean
  durationMs: number
  inputTokens: number
  outputTokens: number
  costUsd: number
  shadowCostUsd: number
  llmCalls: number
  toolCalls: number
  routerRetries?: number
  providerFailovers?: number
  budgetExceeded?: boolean
  prUrl?: string
  error?: string
}

async function createTask(issueUrl: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/task`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issueUrl }),
  })
  if (!res.ok) throw new Error(`Create task failed: ${res.status}`)
  const data = await res.json() as { taskId: string }
  return data.taskId
}

async function waitForCompletion(taskId: string, maxCostUsd: number): Promise<BenchmarkResult> {
  const start = Date.now()
  while (Date.now() - start < MAX_WAIT_MS) {
    const metricsRes = await fetch(`${API_BASE}/api/task/${taskId}/metrics`)
    const registryRes = await fetch(`${API_BASE}/api/task/${taskId}`)
    const reg = registryRes.ok ? await registryRes.json() as { status: string; prUrl?: string } : null

    if (metricsRes.ok) {
      const metrics = await metricsRes.json() as {
        inputTokens: number; outputTokens: number; costUsd: number;
        shadowCostUsd: number; llmCalls: number; toolCalls: number; durationMs: number;
        routerRetries?: number; providerFailovers?: number;
      }

      if (metrics.costUsd > maxCostUsd || metrics.shadowCostUsd > maxCostUsd * 1.5) {
        return {
          id: taskId,
          issueUrl: "",
          complexity: "",
          success: false,
          durationMs: metrics.durationMs,
          inputTokens: metrics.inputTokens,
          outputTokens: metrics.outputTokens,
          costUsd: metrics.costUsd,
          shadowCostUsd: metrics.shadowCostUsd,
          llmCalls: metrics.llmCalls,
          toolCalls: metrics.toolCalls,
          routerRetries: metrics.routerRetries,
          providerFailovers: metrics.providerFailovers,
          budgetExceeded: true,
          error: `Cost $${metrics.costUsd.toFixed(4)} exceeded max $${maxCostUsd}`,
        }
      }

      if (reg && (reg.status === "done" || reg.status === "failed")) {
        return {
          id: taskId,
          issueUrl: "",
          complexity: "",
          success: reg.status === "done",
          durationMs: metrics.durationMs,
          inputTokens: metrics.inputTokens,
          outputTokens: metrics.outputTokens,
          costUsd: metrics.costUsd,
          shadowCostUsd: metrics.shadowCostUsd,
          llmCalls: metrics.llmCalls,
          toolCalls: metrics.toolCalls,
          routerRetries: metrics.routerRetries,
          providerFailovers: metrics.providerFailovers,
          prUrl: reg.prUrl,
        }
      }
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  throw new Error("Timeout waiting for task completion")
}

async function main() {
  const issues: BenchmarkIssue[] = JSON.parse(
    readFileSync(path.join(__dirname, "benchmark-issues.json"), "utf-8")
  )

  console.log(`\nMyOwnDevin Benchmark — ${issues.length} issues\n`)
  console.log("─".repeat(80))

  const results: BenchmarkResult[] = []

  for (const issue of issues) {
    const maxCost = issue.maxCostUsd ?? DEFAULT_MAX_COST
    console.log(`\n[${issue.id}] ${issue.description} (${issue.complexity}, max $${maxCost})`)
    try {
      const taskId = await createTask(issue.issueUrl)
      console.log(`  Task created: ${taskId}`)
      const result = await waitForCompletion(taskId, maxCost)
      result.id = issue.id
      result.issueUrl = issue.issueUrl
      result.complexity = issue.complexity
      results.push(result)
      const status = result.budgetExceeded ? "BUDGET" : result.success ? "PASS" : "FAIL"
      console.log(`  ${status} — ${(result.durationMs / 1000).toFixed(1)}s, ${result.llmCalls} LLM, $${result.costUsd.toFixed(4)} real / $${result.shadowCostUsd.toFixed(4)} shadow, ${result.providerFailovers ?? 0} failovers`)
    } catch (error) {
      results.push({
        id: issue.id,
        issueUrl: issue.issueUrl,
        complexity: issue.complexity,
        success: false,
        durationMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        shadowCostUsd: 0,
        llmCalls: 0,
        toolCalls: 0,
        error: String(error),
      })
      console.log(`  ERROR: ${error}`)
    }
  }

  console.log("\n" + "─".repeat(80))
  console.log("\nSUMMARY\n")
  const passed = results.filter((r) => r.success).length
  const totalCost = results.reduce((s, r) => s + r.costUsd, 0)
  const totalShadow = results.reduce((s, r) => s + r.shadowCostUsd, 0)
  const avgDuration = results.reduce((s, r) => s + r.durationMs, 0) / results.length

  console.log(`Pass rate:         ${passed}/${results.length} (${((passed / results.length) * 100).toFixed(0)}%)`)
  console.log(`Avg duration:      ${(avgDuration / 1000).toFixed(1)}s`)
  console.log(`Total real cost:   $${totalCost.toFixed(4)}`)
  console.log(`Total shadow cost: $${totalShadow.toFixed(4)}`)
  console.log(`Total LLM calls:   ${results.reduce((s, r) => s + r.llmCalls, 0)}`)
  console.log(`Total failovers:   ${results.reduce((s, r) => s + (r.providerFailovers ?? 0), 0)}`)

  const outPath = path.join(__dirname, `results-${Date.now()}.json`)
  writeFileSync(outPath, JSON.stringify(results, null, 2))
  const csvPath = outPath.replace(".json", ".csv")
  const csvHeader = "id,success,costUsd,shadowCostUsd,llmCalls,failovers,durationMs\n"
  const csvRows = results.map((r) =>
    `${r.id},${r.success},${r.costUsd},${r.shadowCostUsd},${r.llmCalls},${r.providerFailovers ?? 0},${r.durationMs}`
  ).join("\n")
  writeFileSync(csvPath, csvHeader + csvRows)
  console.log(`\nResults saved to ${outPath}`)
  console.log(`CSV saved to ${csvPath}`)
}

main().catch(console.error)
