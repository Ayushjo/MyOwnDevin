import type { Step } from "./plannerAgent.js"
import { PlanSchema } from "../store/checkpointStore.js"

export function extractPlanJson(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error("Planner returned empty response")
  }

  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim()

  try {
    return JSON.parse(unfenced)
  } catch {
    const match = unfenced.match(/\[[\s\S]*\]/)
    if (match) return JSON.parse(match[0])
    throw new Error(`No JSON array found in planner output: ${unfenced.slice(0, 300)}`)
  }
}

/** Derive a short Title-Case label from a long/technical description. */
function deriveTitle(description: string): string {
  const cleaned = description
    .replace(/`[^`]*`/g, "")            // drop code spans
    .replace(/\b[\w./-]+\.(ts|tsx|js|mjs|json)\b/gi, "") // drop file paths
    .replace(/\s+/g, " ")
    .trim()
  const words = cleaned.split(" ").filter(Boolean).slice(0, 6)
  const short = words.join(" ").replace(/[,:;.]+$/, "")
  const label = short || description.slice(0, 40)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function parsePlanSteps(text: string): Step[] {
  const raw = PlanSchema.parse(extractPlanJson(text))

  // De-duplicate steps whose descriptions are effectively identical, then
  // normalize: ensure a short title and re-sequence ids.
  const seen = new Set<string>()
  const deduped: typeof raw = []
  for (const step of raw) {
    const key = step.description.trim().toLowerCase().replace(/\s+/g, " ")
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(step)
  }

  return deduped.map((step, i) => ({
    id: i + 1,
    title: step.title?.trim() || deriveTitle(step.description),
    description: step.description.trim(),
  }))
}

/** Last-resort plan so a bad LLM response doesn't kill the whole task */
export function fallbackPlan(issueBody: string): Step[] {
  const lower = issueBody.toLowerCase()
  if (lower.includes("health") && lower.includes("redis")) {
    return [
      {
        id: 1,
        title: "Add health endpoint",
        description:
          "Add GET /api/health in backend/src/api/router.ts returning { status, redis, uptime } with a Redis ping via ioredis",
      },
      {
        id: 2,
        title: "Verify build",
        description: "Run cd /workspace/backend && npx tsc -b --noEmit to verify the code compiles",
      },
      { id: 3, title: "Commit changes", description: "git_commit with message describing the health endpoint addition" },
    ]
  }

  return [
    { id: 1, title: "Implement changes", description: "Inspect relevant files and implement the required code changes" },
    { id: 2, title: "Verify build", description: "Verify the project builds successfully" },
    { id: 3, title: "Commit changes", description: "Commit the changes with a descriptive message" },
  ]
}
