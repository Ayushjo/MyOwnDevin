export type TaskStatus = 'queued' | 'planning' | 'running' | 'verifying' | 'done' | 'failed'

export type StepStatus = 'pending' | 'running' | 'done' | 'failed'

export type Step = {
  id: number
  description: string
  status: StepStatus
}

// tool_call is in the type ready for Phase 6 wiring
export type TaskEvent =
  | { type: 'step_start'; step: Step }
  | { type: 'step_done'; result: { success: boolean; output: string } }
  | { type: 'tool_call'; tool: string; args: Record<string, unknown> }
  | { type: 'task_complete'; prUrl?: string }
  | { type: 'task_failed'; reason: string }

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
