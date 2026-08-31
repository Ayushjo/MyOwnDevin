import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Copy, ExternalLink, RotateCcw } from 'lucide-react'
import AppShell from '../components/AppShell'
import StepList from '../components/StepList'
import LiveLog from '../components/LiveLog'
import MetricsPanel from '../components/MetricsPanel'
import { useTaskStream } from '../hooks/useTaskStream'
import { getTask, updateTask, addTask, type StoredTask } from '../store/taskStore'
import { getTaskState, retryTask } from '../api/client'
import { Badge, Button, useToast } from '../components/ui'
import type { TaskStatus } from '../types/task'
import { cn } from '../lib/cn'

function mapApiStatus(status: unknown): TaskStatus {
  if (status === 'done' || status === 'failed' || status === 'queued') return status
  if (status === 'planning' || status === 'verifying' || status === 'running') return 'running'
  return 'queued'
}

function taskFromApiState(taskId: string, state: Record<string, unknown>): StoredTask {
  const issueUrl = String(state.issueUrl ?? '')
  return {
    id: taskId,
    issueUrl,
    issueTitle: String(state.issueTitle ?? `Task ${taskId.slice(0, 8)}`),
    issueNumber: Number(state.issueNumber ?? 0),
    repoName: String(state.repoName ?? issueUrl.replace('https://github.com/', '').split('/').slice(0, 2).join('/')),
    branchName: String(state.branchName ?? `pullwright/task-${taskId}`),
    status: mapApiStatus(state.status),
    steps: [],
    createdAt: String(state.createdAt ?? new Date().toISOString()),
    ...(state.prUrl ? { prUrl: String(state.prUrl) } : {}),
  }
}

function useElapsedTimer(running: boolean) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  const m = Math.floor(elapsed / 60)
  const s = elapsed % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function StatusBadge({ status, elapsed }: { status: string; elapsed: string }) {
  if (status === 'done') {
    return <Badge tone="success" dot>Done</Badge>
  }
  if (status === 'failed') {
    return <Badge tone="danger" dot>Failed</Badge>
  }
  return (
    <Badge tone="warning" dot className="tabular-nums">
      Running · {elapsed}
    </Badge>
  )
}

function CopyBranchButton({ branch }: { branch: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(branch)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }, [branch])

  return (
    <button
      onClick={copy}
      className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
      title="Copy branch name"
      type="button"
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.span key="check" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }} className="text-success text-[10px] font-medium">
            ✓
          </motion.span>
        ) : (
          <motion.span key="copy" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}>
            <Copy className="w-3 h-3" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}

export default function TaskView() {
  const { id } = useParams<{ id: string }>()
  const taskId = id ?? ''
  const { push: pushToast } = useToast()

  const [task, setTask] = useState<StoredTask | null>(() => getTask(taskId) ?? null)
  const [taskLoading, setTaskLoading] = useState(() => !getTask(taskId))
  const { events, steps, isRunning, metrics, failedReason, reconnect } = useTaskStream(taskId)
  const elapsed = useElapsedTimer(isRunning)
  const [retrying, setRetrying] = useState(false)
  const [highlightedStepId, setHighlightedStepId] = useState<number | null>(null)
  const stepGroupRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  useEffect(() => { setTask(getTask(taskId) ?? null) }, [taskId, isRunning])

  useEffect(() => {
    if (!taskId) return
    const local = getTask(taskId)
    if (local) {
      setTask(local)
      setTaskLoading(false)
      return
    }

    let cancelled = false
    setTaskLoading(true)
    void getTaskState(taskId).then((state) => {
      if (cancelled) return
      if (!state) {
        setTask(null)
        setTaskLoading(false)
        return
      }
      const built = taskFromApiState(taskId, state)
      addTask(built)
      setTask(built)
      setTaskLoading(false)
    })

    return () => { cancelled = true }
  }, [taskId])

  useEffect(() => {
    if (steps.length > 0) {
      updateTask(taskId, { steps })
      setTask((prev) => (prev ? { ...prev, steps } : prev))
    }
  }, [steps, taskId])

  const issueTitle = task?.issueTitle ?? `Task ${taskId.slice(0, 8)}`
  const issueNumber = task?.issueNumber ?? 0
  const branchName = task?.branchName ?? `pullwright/task-${taskId}`
  const repoName = task?.repoName ?? ''
  const prUrl = task?.prUrl
  const status = failedReason ? 'failed' : isRunning ? 'running' : (task?.status ?? 'running')
  const isDone = status === 'done'

  const shortBranch =
    branchName.length > 40 ? branchName.slice(0, 30) + '…' + branchName.slice(-8) : branchName

  async function handleRetry() {
    setRetrying(true)
    try {
      await retryTask(taskId, task?.issueUrl)
      updateTask(taskId, { status: 'running', prUrl: undefined })
      setTask((prev) => (prev ? { ...prev, status: 'running', prUrl: undefined } : prev))
      reconnect()
      pushToast('Task queued for retry', 'success')
    } catch {
      pushToast('Retry failed — check backend is running', 'error')
    } finally {
      setRetrying(false)
    }
  }

  const handleStepClick = useCallback((stepId: number) => {
    setHighlightedStepId(stepId)
    const el = stepGroupRefs.current.get(stepId)
    if (!el) return
    const motionPref = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: motionPref ? 'auto' : 'smooth', block: 'start' })
  }, [])

  if (taskLoading) {
    return (
      <AppShell maxWidth="max-w-6xl">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-muted-foreground">Loading task…</p>
        </div>
      </AppShell>
    )
  }

  if (!task) {
    return (
      <AppShell maxWidth="max-w-6xl">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-muted-foreground mb-3">Task not found.</p>
          <Link to="/dashboard" className="text-sm text-accent hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell maxWidth="max-w-[1240px]">
      <div
        className={cn(
          'rounded-xl border border-border bg-card overflow-hidden flex flex-col',
          'md:h-[calc(100vh-7rem)] md:min-h-[520px]',
        )}
      >
        {/* Header */}
        <div className="shrink-0 px-3 sm:px-5 py-3 sm:py-4 border-b border-border bg-muted/50">
          <div className="flex items-center justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Link
                to="/dashboard"
                className="w-8 h-8 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div className="flex items-center gap-1.5 font-mono text-[10px] sm:text-xs text-primary bg-primary/5 border border-primary/15 px-2 sm:px-2.5 py-1.5 rounded-lg min-w-0 flex-1">
                <span className="truncate">{shortBranch}</span>
                <CopyBranchButton branch={branchName} />
              </div>
            </div>
            <StatusBadge status={status} elapsed={elapsed} />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              {repoName && <p className="text-xs text-muted-foreground mb-0.5 truncate">{repoName}</p>}
              <h1 className="text-base sm:text-xl font-bold text-foreground leading-snug line-clamp-3 sm:line-clamp-2">
                {issueNumber > 0 ? `#${issueNumber} — ` : ''}
                {issueTitle}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(prUrl ?? (isDone && task.prUrl)) && (
                <a
                  href={prUrl ?? task.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-foreground bg-primary border border-primary px-3 py-2 rounded-lg hover:brightness-95 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View PR
                </a>
              )}
              {status === 'failed' && !isRunning && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleRetry}
                  disabled={retrying}
                  className="rounded-lg gap-1.5"
                >
                  <RotateCcw className={cn('w-3.5 h-3.5', retrying && 'animate-spin')} />
                  {retrying ? 'Queuing…' : 'Retry'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile plan strip */}
        {steps.length > 0 && (
          <div className="sm:hidden shrink-0 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-semibold text-foreground">Plan</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{steps.length} steps</span>
            </div>
            <div className="flex gap-2 overflow-x-auto px-3 pb-2.5 scrollbar-none">
              {steps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => handleStepClick(step.id)}
                  className={cn(
                    'shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-left transition-colors',
                    highlightedStepId === step.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0',
                      step.status === 'done'
                        ? 'bg-success text-white'
                        : step.status === 'running'
                          ? 'bg-primary text-primary-foreground'
                          : step.status === 'failed'
                            ? 'bg-destructive/10 text-destructive border border-destructive/30'
                            : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {step.id}
                  </span>
                  <span className="text-[11px] font-medium max-w-[120px] truncate">
                    {step.title ?? step.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex flex-col sm:flex-row flex-1 min-h-0">
          <aside className="w-[240px] sm:w-[260px] shrink-0 border-r border-border bg-muted/30 flex-col hidden sm:flex">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <span className="text-sm font-semibold text-foreground">Plan</span>
              <span className="text-xs text-muted-foreground tabular-nums">{steps.length} steps</span>
            </div>
            <div className="flex-1 overflow-y-auto py-2 px-2">
              {steps.length === 0 ? (
                <p className="text-muted-foreground text-xs text-center pt-6 px-2">
                  {isRunning ? 'Waiting for planner…' : 'No steps recorded.'}
                </p>
              ) : (
                <StepList
                  steps={steps}
                  onStepClick={handleStepClick}
                  highlightedStepId={highlightedStepId}
                />
              )}
            </div>
          </aside>

          <div className="flex-1 min-w-0 flex flex-col md:overflow-hidden">
            <div className="shrink-0 px-3 sm:px-4 py-2 sm:py-3 border-b border-border">
              <MetricsPanel metrics={metrics} isRunning={isRunning} compact />
            </div>
            <div className="md:flex-1 md:min-h-0 md:overflow-hidden">
              <LiveLog
                events={events}
                isRunning={isRunning}
                failedReason={failedReason}
                hideCompleteBanner={isDone && !!prUrl}
                registerRef={(stepId, el) => {
                  if (el) stepGroupRefs.current.set(stepId, el)
                  else stepGroupRefs.current.delete(stepId)
                }}
              />
            </div>
          </div>
        </div>

        {/* Done footer */}
        {isDone && prUrl && (
          <div className="shrink-0 px-4 py-2.5 border-t border-green-200 bg-green-50 flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-success">Task complete — PR opened</p>
            <a
              href={prUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-success hover:underline inline-flex items-center gap-1"
            >
              View PR <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </AppShell>
  )
}
