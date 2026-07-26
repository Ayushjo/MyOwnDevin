export type TaskStatus = 'queued' | 'planning' | 'running' | 'verifying' | 'done' | 'failed'

export type StepStatus = 'pending' | 'running' | 'done' | 'failed'

export type Step = {
  id: number
  title?: string
  description: string
  status: StepStatus
}

export type PhaseMetrics = {
  durationMs: number
  model?: string
  provider?: string
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
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
  phases: Record<string, PhaseMetrics>
  budgetUsedUsd?: number
  budgetLimitUsd?: number
  budgetRemainingUsd?: number
  orgBudgetRemainingUsd?: number
}

export type VerificationResult = {
  passed: boolean
  reason: string
  layer?: string
}

export type TaskEvent =
  | { type: 'phase_start'; phase: string; timestamp?: string }
  | { type: 'phase_end'; phase: string; metrics: PhaseMetrics; timestamp?: string }
  | { type: 'step_start'; step: Step; timestamp?: string }
  | { type: 'step_done'; result: { success: boolean; output: string }; verification: VerificationResult; timestamp?: string }
  | { type: 'tool_call'; tool: string; args: Record<string, unknown>; stepId?: number; timestamp?: string }
  | { type: 'tool_result'; tool: string; success: boolean; output: string; durationMs: number; stepId?: number; timestamp?: string }
  | { type: 'llm_call'; agent: string; model: string; provider: string; tokens: { in: number; out: number }; costUsd: number; durationMs: number; timestamp?: string }
  | { type: 'agent_thought'; agent: string; status: 'thinking' | 'reasoning'; text: string; model?: string; provider?: string; timestamp?: string }
  | { type: 'metrics_update'; metrics: TaskMetricsSnapshot; timestamp?: string }
  | { type: 'task_complete'; prUrl?: string; metrics: TaskMetricsSnapshot; timestamp?: string }
  | { type: 'task_failed'; reason: string; metrics?: TaskMetricsSnapshot; timestamp?: string }

export type Task = {
  id: string
  issueUrl: string
  issueTitle: string
  issueNumber: number
  repoName: string
  branchName: string
  status: TaskStatus
  steps: Step[]
  createdAt: string
  elapsedSeconds?: number
  prUrl?: string
}

export type TaskRegistryEntry = {
  taskId: string
  issueUrl: string
  issueTitle: string
  issueNumber: number
  status: 'queued' | 'running' | 'done' | 'failed'
  createdAt: string
  updatedAt: string
  prUrl?: string
}
