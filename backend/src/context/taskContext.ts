export type StepSummary = {
  stepId: number
  description: string
  filesChanged: string[]
  commitHash?: string
  outputSummary: string
}

export type TestResult = {
  command: string
  exitCode: number
  passed: boolean
  output: string
}

export type TaskContext = {
  issueTitle: string
  issueBody: string
  planSummary: string
  completedSteps: StepSummary[]
  filesModified: string[]
  testResults: TestResult[]
  currentBranch: string
  repoStructure: string
  baselineSha?: string  // SHA captured right after checkout, before agent touches anything
}

export function createEmptyContext(issueTitle: string, issueBody: string, branch: string): TaskContext {
  return {
    issueTitle,
    issueBody,
    planSummary: "",
    completedSteps: [],
    filesModified: [],
    testResults: [],
    currentBranch: branch,
    repoStructure: "",
  }
}

const CHARS_PER_TOKEN = 4

export function toPrompt(ctx: TaskContext, budgetTokens = 4000): string {
  const budget = budgetTokens * CHARS_PER_TOKEN
  const parts: string[] = []

  parts.push(`# Issue: ${ctx.issueTitle}`)
  parts.push(ctx.issueBody.slice(0, 500))

  if (ctx.planSummary) {
    parts.push(`\n# Plan\n${ctx.planSummary}`)
  }

  if (ctx.repoStructure) {
    parts.push(`\n# Repo Structure\n${ctx.repoStructure.slice(0, 1500)}`)
  }

  if (ctx.filesModified.length > 0) {
    parts.push(`\n# Files Modified So Far\n${ctx.filesModified.join("\n")}`)
  }

  if (ctx.completedSteps.length > 0) {
    parts.push("\n# Completed Steps")
    const recent = ctx.completedSteps.slice(-5)
    for (const step of recent) {
      parts.push(`- Step ${step.stepId}: ${step.description}`)
      parts.push(`  Result: ${step.outputSummary.slice(0, 200)}`)
      if (step.filesChanged.length > 0) {
        parts.push(`  Files: ${step.filesChanged.join(", ")}`)
      }
    }
  }

  if (ctx.testResults.length > 0) {
    const last = ctx.testResults[ctx.testResults.length - 1]
    if (last) {
      parts.push(`\n# Last Test: ${last.command} — exit ${last.exitCode} (${last.passed ? "PASS" : "FAIL"})`)
    }
  }

  let result = parts.join("\n")
  if (result.length > budget) {
    result = result.slice(0, budget) + "\n...[context truncated]"
  }
  return result
}

export function summarizeOutput(output: string, maxLen = 300): string {
  const cleaned = output.replace(/\s+/g, " ").trim()
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + "..." : cleaned
}
