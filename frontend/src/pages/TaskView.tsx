import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import StepList from '../components/StepList'
import LiveLog from '../components/LiveLog'
import { useTaskStream } from '../hooks/useTaskStream'
import { getTask, updateTask } from '../store/taskStore'

/* ─────────────────────────────────────────────────────────────────
   Light Navbar  (same design language as Home page)
───────────────────────────────────────────────────────────────── */
function LightNavbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-md border-b border-gray-100/80">
      <div className="max-w-[1220px] mx-auto px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
            <line x1="14" y1="5"  x2="5"  y2="21" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" opacity="0.45"/>
            <line x1="14" y1="5"  x2="23" y2="21" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" opacity="0.45"/>
            <line x1="5"  y1="21" x2="23" y2="21" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" opacity="0.25"/>
            <circle cx="5"  cy="21" r="2.5" fill="white" stroke="#1e293b" strokeWidth="1.5"/>
            <circle cx="23" cy="21" r="2.5" fill="white" stroke="#1e293b" strokeWidth="1.5"/>
            <circle cx="14" cy="5"  r="4"   fill="#1e293b"/>
            <circle cx="14" cy="5"  r="2"   fill="white" opacity="0.9"/>
          </svg>
          <span className="text-gray-900 font-bold text-base tracking-tight">devin</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500
                           border border-gray-200 uppercase tracking-widest">
            agent
          </span>
        </Link>

        {/* Nav right */}
        <div className="flex items-center gap-2">
          <Link to="/dashboard"
            className="text-gray-600 hover:text-gray-900 text-sm font-medium px-4 py-2 transition-colors rounded-lg">
            Dashboard
          </Link>
          <Link to="/tasks/new"
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full
                       bg-gray-900 text-white shadow-sm hover:bg-gray-700 transition-all duration-200">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <line x1="6" y1="1" x2="6" y2="11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            New Task
          </Link>
        </div>
      </div>
    </nav>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Elapsed timer
───────────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────────────── */
export default function TaskView() {
  const { id }   = useParams<{ id: string }>()
  const taskId   = id ?? ''

  const [task, setTask] = useState(() => getTask(taskId))
  const { events, steps, isRunning } = useTaskStream(taskId)
  const elapsed = useElapsedTimer(isRunning)

  // Re-read store on status change
  useEffect(() => { setTask(getTask(taskId)) }, [taskId, isRunning])

  // Persist live steps to localStorage → Dashboard stays in sync
  useEffect(() => {
    if (steps.length > 0) {
      updateTask(taskId, { steps })
      setTask(prev => prev ? { ...prev, steps } : prev)
    }
  }, [steps, taskId])

  // Derived values
  const issueTitle  = task?.issueTitle  ?? `Task ${taskId.slice(0, 8)}`
  const issueNumber = task?.issueNumber ?? 0
  const branchName  = task?.branchName  ?? `devin/task-${taskId}`
  const repoName    = task?.repoName    ?? ''
  const prUrl       = task?.prUrl
  const status      = isRunning ? 'running' : (task?.status ?? 'running')
  const isDone      = status === 'done'
  const isFailed    = status === 'failed'

  // Truncate long branch name: "devin/task-8323cae7…7ff56ab"
  const shortBranch = branchName.length > 44
    ? branchName.slice(0, 34) + '…' + branchName.slice(-8)
    : branchName

  /* ── Not found ── */
  if (!task) {
    return (
      <div
        className="min-h-screen font-sans antialiased"
        style={{
          background: '#F7F8FC',
          backgroundImage:
            'linear-gradient(rgba(203,213,225,0.3) 1px,transparent 1px),' +
            'linear-gradient(90deg,rgba(203,213,225,0.3) 1px,transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      >
        <LightNavbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-gray-500 mb-4">Task not found.</p>
            <Link to="/dashboard" className="text-indigo-600 text-sm hover:underline">
              ← Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen font-sans antialiased"
      style={{
        background: '#F7F8FC',
        backgroundImage:
          'linear-gradient(rgba(203,213,225,0.3) 1px,transparent 1px),' +
          'linear-gradient(90deg,rgba(203,213,225,0.3) 1px,transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      <LightNavbar />

      <main className="max-w-[1220px] mx-auto px-5 pt-[72px] pb-6" style={{ minHeight: '100vh' }}>
        {/* ── Outer padding wrapper ── */}
        <div className="pt-4 pb-4">

          {/* ── Main white card ── */}
          <div
            className="bg-white rounded-2xl overflow-hidden flex flex-col"
            style={{
              boxShadow:
                '0 4px 6px -1px rgba(0,0,0,0.04),' +
                '0 10px 40px -8px rgba(15,23,42,0.10),' +
                '0 1px 3px rgba(0,0,0,0.03)',
              border: '1px solid rgba(226,232,240,0.9)',
              height: 'calc(100vh - 108px)',
            }}
          >
            {/* ── Card header ── */}
            <div className="shrink-0 px-5 pt-4 pb-3.5 border-b border-gray-100">
              {/* Row 1: breadcrumb + status */}
              <div className="flex items-center justify-between mb-3 gap-3">
                {/* Nav arrows + branch breadcrumb */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <Link to="/dashboard"
                    className="w-7 h-7 rounded-md bg-gray-50 hover:bg-gray-100 border border-gray-200
                               flex items-center justify-center text-gray-500 transition-all shrink-0">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M7 2L4 5.5L7 9" stroke="currentColor" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                  {/* Fwd arrow (decorative) */}
                  <button disabled
                    className="w-7 h-7 rounded-md bg-gray-50 border border-gray-200
                               flex items-center justify-center text-gray-300 cursor-default shrink-0">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M4 2L7 5.5L4 9" stroke="currentColor" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {/* Branch pill */}
                  <span className="font-mono text-xs text-gray-700 bg-gray-100 border border-gray-200
                                   px-3 py-1.5 rounded-lg truncate max-w-xs sm:max-w-sm">
                    {shortBranch}
                  </span>
                </div>

                {/* Status badge */}
                {isDone ? (
                  <div className="flex items-center gap-1.5 bg-green-50 border border-green-200
                                  text-green-700 text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M2 5.5L4.5 8L9 3" stroke="currentColor" strokeWidth="1.7"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Done
                  </div>
                ) : isFailed ? (
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-200
                                  text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M2.5 2.5L8.5 8.5M8.5 2.5L2.5 8.5" stroke="currentColor"
                        strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Failed
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200
                                  text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Running · {elapsed}
                  </div>
                )}
              </div>

              {/* Row 2: project + issue title */}
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  {repoName && (
                    <p className="text-gray-500 text-sm mb-0.5 truncate">{repoName}</p>
                  )}
                  <h1 className="text-gray-900 font-bold text-xl leading-tight truncate">
                    {issueNumber > 0 ? `#${issueNumber} — ` : ''}{issueTitle}
                  </h1>
                </div>

                {prUrl && (
                  <a href={prUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600
                               bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg
                               hover:bg-indigo-100 transition-colors shrink-0">
                    View PR
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M2 9L9 2M9 2H4.5M9 2V6.5" stroke="currentColor"
                        strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                )}
              </div>
            </div>

            {/* ── Card body: Plan | Terminal ── */}
            <div className="flex flex-1 min-h-0">

              {/* Left — Plan */}
              <div className="w-[260px] shrink-0 border-r border-gray-100 bg-gray-50/50 flex flex-col">
                {/* Plan header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
                  <span className="text-gray-800 font-semibold text-sm">Plan</span>
                  <span className="text-gray-400 text-xs tabular-nums">{steps.length} steps</span>
                </div>
                {/* Step list */}
                <div className="flex-1 overflow-y-auto py-2.5 px-2.5">
                  {steps.length === 0 ? (
                    <p className="text-gray-400 text-xs text-center pt-8 px-2">
                      {isRunning ? 'Waiting for planner…' : 'No steps recorded.'}
                    </p>
                  ) : (
                    <StepList steps={steps} />
                  )}
                </div>
              </div>

              {/* Right — Terminal / live log */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <LiveLog events={events} isRunning={isRunning} />
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
