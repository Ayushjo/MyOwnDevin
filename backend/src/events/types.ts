import type { Step } from "../Agents/plannerAgent.js"

export type PhaseName = "planning" | "recon" | "executing" | "verifying" | "pushing" | "pr"

export type PhaseMetrics = {
  durationMs: number
  model?: string
  provider?: string
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
}

export type VerificationResult = {
  passed: boolean
  reason: string
  layer?: "deterministic" | "diff" | "llm"
  signals?: string[]
}

export type TaskMetricsSnapshot = {
  inputTokens: number
  outputTokens: number
  costUsd: number
  shadowCostUsd: number
  llmCalls: number
  toolCalls: number
  retries: number
  routerRetries?: number
  providerFailovers?: number
  durationMs: number
  phases: Partial<Record<PhaseName, PhaseMetrics>>
  budgetUsedUsd?: number
  budgetLimitUsd?: number
  budgetRemainingUsd?: number
  orgBudgetRemainingUsd?: number
}

export type TaskEvent =
  | { type: "phase_start"; phase: PhaseName; timestamp?: string }
  | { type: "phase_end"; phase: PhaseName; metrics: PhaseMetrics; timestamp?: string }
  | { type: "step_start"; step: Step; timestamp?: string }
  | { type: "tool_call"; tool: string; args: Record<string, unknown>; stepId?: number; timestamp?: string }
  | { type: "tool_result"; tool: string; success: boolean; output: string; durationMs: number; stepId?: number; timestamp?: string }
  | { type: "llm_call"; agent: string; model: string; provider: string; tokens: { in: number; out: number }; costUsd: number; durationMs: number; timestamp?: string }
  | { type: "agent_thought"; agent: string; status: "thinking" | "reasoning"; text: string; model?: string; provider?: string; timestamp?: string }
  | { type: "step_done"; result: { success: boolean; output: string }; verification: VerificationResult; timestamp?: string }
  | { type: "metrics_update"; metrics: TaskMetricsSnapshot; timestamp?: string }
  | { type: "task_complete"; prUrl?: string; metrics: TaskMetricsSnapshot; timestamp?: string }
  | { type: "task_failed"; reason: string; metrics?: TaskMetricsSnapshot; timestamp?: string }

export function timestamp(): string {
  return new Date().toISOString()
}
