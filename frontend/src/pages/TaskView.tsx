import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import StepList from '../components/StepList'
import LiveLog from '../components/LiveLog'
import StatusBadge from '../components/StatusBadge'
import { useTaskStream } from '../hooks/useTaskStream'
import { MOCK_TASKS } from '../data/mockData'

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
  const { id } = useParams<{ id: string }>()
  const task = MOCK_TASKS.find(t => t.id === id) ?? MOCK_TASKS[0]!
  const { events, steps, isRunning } = useTaskStream(id ?? 'task-a1b2c3')
  const elapsed = useElapsedTimer(isRunning)

  const currentTool = (() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i]!
      if (e.type === 'tool_call') return `${e.tool} → ${String(Object.values(e.args)[0] ?? '').slice(0, 50)}`
    }
    return null
  })()

  const status = isRunning ? 'running' : task.status

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto px-6 pt-20 pb-4">
        {/* Top bar */}
        <div className="flex items-start justify-between gap-4 py-4 border-b border-subtle mb-4">
          <div className="flex items-start gap-4 min-w-0">
            <Link to="/dashboard" className="text-slate-600 hover:text-slate-300 mt-0.5 transition-colors flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M11 4L7 9L11 14" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <StatusBadge status={status} />
                <span className="font-mono text-xs text-slate-600 bg-elevated px-2 py-0.5 rounded border border-subtle">
                  {task.branchName}
                </span>
                {isRunning && (
                  <span className="text-slate-500 text-xs tabular-nums">{elapsed}</span>
                )}
              </div>
              <h1 className="text-white font-semibold text-base leading-snug">
                #{task.issueNumber} — {task.issueTitle}
              </h1>
              <p className="text-slate-500 text-xs mt-0.5">{task.repoName}</p>
            </div>
          </div>

          {task.prUrl && (
            <a href={task.prUrl} target="_blank" rel="noreferrer"
              className="btn-primary flex-shrink-0 flex items-center gap-1.5 text-sm">
              View PR
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4M9.5 2.5V8"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}
        </div>

        {/* Split panel */}
        <div className="flex-1 grid grid-cols-[320px_1fr] gap-4 min-h-0" style={{ height: 'calc(100vh - 200px)' }}>
          {/* Left: steps */}
          <div className="bg-surface border border-subtle rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
              <span className="text-slate-300 text-sm font-medium">Plan</span>
              <span className="text-slate-600 text-xs">{steps.length} steps</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <StepList steps={steps} />
            </div>
          </div>

          {/* Right: live log */}
          <LiveLog events={events} isRunning={isRunning} />
        </div>

        {/* Bottom strip — current action */}
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
