import { useState, useEffect, useRef, useCallback } from 'react'
import type { TaskEvent, Step, TaskMetricsSnapshot } from '../types/task'
import { openTaskStream, getTaskState, getTaskEvents, getTaskMetrics } from '../api/client'
import { updateTask } from '../store/taskStore'

function applyTerminalFromRegistry(
  taskId: string,
  status: string,
  setIsRunning: (v: boolean) => void,
  setFailedReason: (v: string | undefined) => void,
) {
  if (status === 'done') {
    setIsRunning(false)
    updateTask(taskId, { status: 'done' })
  } else if (status === 'failed') {
    setIsRunning(false)
    setFailedReason('Task failed — check the log for details')
    updateTask(taskId, { status: 'failed' })
  }
}

function eventKey(event: TaskEvent): string {
  if ('timestamp' in event && event.timestamp) return `${event.type}:${event.timestamp}`
  return `${event.type}:${JSON.stringify(event)}`
}

export function useTaskStream(taskId: string) {
  const [events, setEvents] = useState<TaskEvent[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  const [isRunning, setIsRunning] = useState(true)
  const [metrics, setMetrics] = useState<TaskMetricsSnapshot | null>(null)
  const [failedReason, setFailedReason] = useState<string | undefined>()
  const [retryNonce, setRetryNonce] = useState(0)
  const lastEventAt = useRef(Date.now())

  // Stable reconnect: bumps retryNonce → re-runs effect, resetting all state
  const reconnect = useCallback(() => {
    setRetryNonce(n => n + 1)
  }, [])

  useEffect(() => {
    if (!taskId) return

    let cancelled = false

    setEvents([])
    setSteps([])
    setIsRunning(false)
    setFailedReason(undefined)
    lastEventAt.current = Date.now()

    const ingestEvent = (event: TaskEvent) => {
      lastEventAt.current = Date.now()
      setEvents(prev => {
        const key = eventKey(event)
        if (prev.some(ev => eventKey(ev) === key)) return prev
        return [...prev, event]
      })

      if (event.type === 'step_start') {
        setSteps(prev => {
          const exists = prev.find(s => s.id === event.step.id)
          if (exists) {
            return prev.map(s => s.id === event.step.id ? { ...s, status: 'running' } : s)
          }
          return [...prev, { ...event.step, status: 'running' }]
        })
      }

      if (event.type === 'step_done') {
        setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'done' } : s))
      }

      if (event.type === 'metrics_update') {
        setMetrics(event.metrics)
      }

      if (event.type === 'task_complete') {
        setIsRunning(false)
        setMetrics(event.metrics)
        updateTask(taskId, { status: 'done', prUrl: event.prUrl })
      }

      if (event.type === 'task_failed') {
        setIsRunning(false)
        setFailedReason(event.reason)
        if (event.metrics) setMetrics(event.metrics)
        // Mark the step that was in-flight as failed so the sidebar reflects
        // *where* it stopped instead of appearing stuck on a running step.
        setSteps(prev => {
          if (!prev.some(s => s.status === 'running')) return prev
          return prev.map(s => s.status === 'running' ? { ...s, status: 'failed' } : s)
        })
        updateTask(taskId, { status: 'failed' })
      }
    }

    const bootstrap = async () => {
      const [state, stored, prior] = await Promise.all([
        getTaskState(taskId),
        getTaskEvents(taskId),
        getTaskMetrics(taskId),
      ])
      if (cancelled) return

      if (prior) setMetrics(prior as TaskMetricsSnapshot)
      else setMetrics(null)

      if (state) {
        if (Array.isArray(state.steps)) {
          const completedIds = (state.completedStepIds as number[]) ?? []
          setSteps(
            (state.steps as Array<{ id: number; title?: string; description: string }>).map(s => ({
              id: s.id,
              ...(s.title ? { title: s.title } : {}),
              description: s.description,
              status: completedIds.includes(s.id) ? 'done' : 'pending',
            }))
          )
        }

        if (state.issueTitle) {
          updateTask(taskId, {
            issueTitle: state.issueTitle as string,
            issueNumber: state.issueNumber as number,
          })
        }

        const status = state.status as string | undefined
        if (status === 'running') setIsRunning(true)
        else if (status) applyTerminalFromRegistry(taskId, status, setIsRunning, setFailedReason)
      }

      for (const ev of stored) ingestEvent(ev)
    }

    void bootstrap()

    // SSE replays persisted events; also hydrate from API as fallback (deduped)
    const source = openTaskStream(taskId)

    source.onmessage = (e: MessageEvent<string>) => {
      ingestEvent(JSON.parse(e.data) as TaskEvent)
    }

    source.onerror = () => {
      source.close()
      getTaskState(taskId).then(state => {
        if (!state) return
        const status = state.status as string | undefined
        if (status) applyTerminalFromRegistry(taskId, status, setIsRunning, setFailedReason)
      })
      getTaskEvents(taskId).then((stored: TaskEvent[]) => {
        for (const ev of stored) ingestEvent(ev)
      })
    }

    // Poll registry while running — catches fast failures after retry clears the log
    const poll = setInterval(() => {
      getTaskState(taskId).then(state => {
        if (!state) return
        const status = state.status as string | undefined
        if (status === 'failed' || status === 'done') {
          applyTerminalFromRegistry(taskId, status, setIsRunning, setFailedReason)
        } else if (status === 'running') {
          setIsRunning(true)
        }
      })
      getTaskEvents(taskId).then((stored: TaskEvent[]) => {
        for (const ev of stored) ingestEvent(ev)
      })
    }, 5_000)

    return () => {
      cancelled = true
      source.close()
      clearInterval(poll)
    }
  }, [taskId, retryNonce])

  return { events, steps, isRunning, metrics, failedReason, reconnect }
}
