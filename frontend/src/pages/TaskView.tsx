import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import StepList from '../components/StepList'
import LiveLog from '../components/LiveLog'
import StatusBadge from '../components/StatusBadge'
import { useTaskStream } from '../hooks/useTaskStream'
import { getTask, updateTask } from '../store/taskStore'

function useElapsedTimer(running: boolean) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  const m = Math.floor(elapsed / 60)
  const s = elapsed % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function TaskView() {
  const { id }   = useParams<{ id: string }>()
  const taskId   = id ?? ''

  // task state — kept in sync as SSE events update localStorage
  const [task, setTask] = useState(() => getTask(taskId))

  const { events, steps, isRunning } = useTaskStream(taskId)
  const elapsed = useElapsedTimer(isRunning)

  // Re-read localStorage when isRunning changes (task_complete / task_failed writes to store)
  useEffect(() => {
    setTask(getTask(taskId))
  }, [taskId, isRunning])

  // Persist live step list into localStorage so TaskCard shows progress on Dashboard
  useEffect(() => {
    if (steps.length > 0) {
      updateTask(taskId, { steps })
      setTask(prev => prev ? { ...prev, steps } : prev)
    }
  }, [steps, taskId])

  // Derive display values (fall back to parsing taskId so the page never shows "undefined")
  const issueTitle  = task?.issueTitle  ?? `Task ${taskId.slice(0, 8)}`
  const issueNumber = task?.issueNumber ?? 0
  const branchName  = task?.branchName  ?? `devin/task-${taskId}`
  const repoName    = task?.repoName    ?? ''
  const prUrl       = task?.prUrl
  const status      = isRunning ? 'running' : (task?.status ?? 'running')

  // Last tool call shown in the bottom strip
  const currentTool = (() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i]!
      if (e.type === 'tool_call') {
        const firstArg = String(Object.values(e.args)[0] ?? '').slice(0, 60)
        return `${e.tool} → ${firstArg}`
      }
    }
    return null
  })()

  // Task not in localStorage at all (navigated directly to an unknown ID)
  if (!task) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-slate-400 mb-4">Task not found.</p>
            <Link to="/dashboard" className="btn-ghost text-sm">← Back to dashboard</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto px-6 pt-20 pb-4">

        {/* ── Top bar ────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 py-4 border-b border-subtle mb-4">
          <div className="flex items-start gap-4 min-w-0">
            {/* Back arrow */}
            <Link to="/dashboard"
              className="text-slate-600 hover:text-slate-300 mt-0.5 transition-colors flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M11 4L7 9L11 14" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <StatusBadge status={status} />
                <span className="font-mono text-xs text-slate-600 bg-elevated px-2 py-0.5 rounded border border-subtle">
                  {branchName}
                </span>
                {isRunning && (
                  <span className="text-slate-500 text-xs tabular-nums">{elapsed}</span>
                )}
              </div>
              <h1 className="text-white font-semibold text-base leading-snug">
                {issueNumber > 0 ? `#${issueNumber} — ` : ''}{issueTitle}
              </h1>
              {repoName && <p className="text-slate-500 text-xs mt-0.5">{repoName}</p>}
            </div>
          </div>

          {prUrl && (
            <a href={prUrl} target="_blank" rel="noreferrer"
              className="btn-primary flex-shrink-0 flex items-center gap-1.5 text-sm">
              View PR
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4M9.5 2.5V8"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}
        </div>

        {/* ── Split panel ─────────────────────────────────────────── */}
        <div
          className="flex-1 grid grid-cols-[320px_1fr] gap-4 min-h-0"
          style={{ height: 'calc(100vh - 200px)' }}
        >
          {/* Left — step list */}
          <div className="bg-surface border border-subtle rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
              <span className="text-slate-300 text-sm font-medium">Plan</span>
              <span className="text-slate-600 text-xs">{steps.length} steps</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {steps.length === 0 ? (
                <p className="text-slate-600 text-xs text-center pt-6">
                  {isRunning ? 'Waiting for planner...' : 'No steps recorded.'}
                </p>
              ) : (
                <StepList steps={steps} />
              )}
            </div>
          </div>

          {/* Right — live log terminal */}
          <LiveLog events={events} isRunning={isRunning} />
        </div>

        {/* ── Bottom status strip ─────────────────────────────────── */}
        {isRunning && currentTool && (
          <div className="mt-2.5 flex items-center gap-2.5 px-4 py-2 bg-surface border border-subtle
            rounded-lg text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse flex-shrink-0" />
            <span className="text-slate-500">executing:</span>
            <span className="text-slate-300 truncate">{currentTool}</span>
          </div>
        )}

      </main>
    </div>
  )
}
