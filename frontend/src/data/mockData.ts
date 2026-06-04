import type { Task, TaskEvent, Step } from '../types/task'

export const MOCK_STEPS: Step[] = [
  { id: 1, description: 'Read getUserById in src/users.ts and identify the null crash', status: 'done' },
  { id: 2, description: 'Add null guard before accessing user.id on line 42', status: 'done' },
  { id: 3, description: 'Run test suite to confirm all tests pass', status: 'running' },
  { id: 4, description: 'Commit the fix with a descriptive message', status: 'pending' },
]

export const MOCK_EVENTS: TaskEvent[] = [
  { type: 'step_start', step: MOCK_STEPS[0]! },
  { type: 'tool_call', tool: 'read_file', args: { filePath: '/workspace/src/users.ts' } },
  { type: 'tool_call', tool: 'run_shell', args: { command: 'cat /workspace/src/users.ts | head -60' } },
  { type: 'step_done', result: { success: true, output: 'STEP COMPLETE: Found null crash at line 42 in getUserById' } },
  { type: 'step_start', step: MOCK_STEPS[1]! },
  { type: 'tool_call', tool: 'read_file', args: { filePath: '/workspace/src/users.ts' } },
  { type: 'tool_call', tool: 'write_file', args: { filePath: '/workspace/src/users.ts', content: '...' } },
  { type: 'tool_call', tool: 'run_shell', args: { command: 'cat /workspace/src/users.ts | grep -n "getUserById" | head -10' } },
  { type: 'step_done', result: { success: true, output: 'STEP COMPLETE: Added null check — if (!userId) return null' } },
  { type: 'step_start', step: MOCK_STEPS[2]! },
  { type: 'tool_call', tool: 'run_shell', args: { command: 'npm test' } },
]

export const MOCK_TASKS: Task[] = [
  {
    id: 'task-a1b2c3',
    issueUrl: 'https://github.com/ayush/api-service/issues/42',
    issueTitle: 'Fix null crash in getUserById when userId is undefined',
    issueNumber: 42,
    repoName: 'ayush/api-service',
    branchName: 'devin/task-a1b2c3',
    status: 'running',
    steps: MOCK_STEPS,
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    elapsedSeconds: 240,
  },
  {
    id: 'task-d4e5f6',
    issueUrl: 'https://github.com/ayush/api-service/issues/38',
    issueTitle: 'Add rate limiting to POST /auth/login endpoint',
    issueNumber: 38,
    repoName: 'ayush/api-service',
    branchName: 'devin/task-d4e5f6',
    status: 'done',
    steps: [
      { id: 1, description: 'Install express-rate-limit package', status: 'done' },
      { id: 2, description: 'Apply limiter middleware to /auth/login', status: 'done' },
      { id: 3, description: 'Write unit test for rate limit response', status: 'done' },
      { id: 4, description: 'Commit and push changes', status: 'done' },
    ],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    prUrl: 'https://github.com/ayush/api-service/pull/45',
  },
  {
    id: 'task-g7h8i9',
    issueUrl: 'https://github.com/ayush/frontend-app/issues/17',
    issueTitle: 'Fix broken pagination on the users table — page 2+ returns empty',
    issueNumber: 17,
    repoName: 'ayush/frontend-app',
    branchName: 'devin/task-g7h8i9',
    status: 'failed',
    steps: [
      { id: 1, description: 'Read the pagination hook in src/hooks/useUsers.ts', status: 'done' },
      { id: 2, description: 'Fix the offset calculation in the query builder', status: 'failed' },
      { id: 3, description: 'Run integration tests', status: 'pending' },
    ],
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
]
