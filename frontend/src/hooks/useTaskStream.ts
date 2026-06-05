import { useState, useEffect } from 'react'
import type { TaskEvent, Step } from '../types/task'
import { openTaskStream, getTaskState } from '../api/client'
import { updateTask } from '../store/taskStore'

export function useTaskStream(taskId: string) {
  const [events,    setEvents]    = useState<TaskEvent[]>([])
  const [steps,     setSteps]     = useState<Step[]>([])
  const [isRunning, setIsRunning] = useState(true)

  useEffect(() => {
    if (!taskId) return

    setEvents([])
    setSteps([])
    setIsRunning(true)

    // ── Hydrate existing steps from checkpoint ──────────────────────
    // Handles resumed tasks — steps already completed won't fire step_start again.
    getTaskState(taskId).then(state => {
      if (!state) return

      if (Array.isArray(state.steps)) {
        const completedIds = (state.completedStepIds as number[]) ?? []
        setSteps(
          (state.steps as Array<{ id: number; description: string }>).map(s => ({
            id:          s.id,
            description: s.description,
            status:      completedIds.includes(s.id) ? 'done' : 'pending',
          }))
        )
      }

      // Back-fill title / issue number into localStorage
      if (state.issueTitle) {
        updateTask(taskId, {
          issueTitle:  state.issueTitle  as string,
          issueNumber: state.issueNumber as number,
        })
      }
    })

    // ── Connect to the SSE stream ───────────────────────────────────
    const source = openTaskStream(taskId)

    source.onmessage = (e: MessageEvent<string>) => {
      const event = JSON.parse(e.data) as TaskEvent
      setEvents(prev => [...prev, event])

      if (event.type === 'step_start') {
        setSteps(prev => {
          const exists = prev.find(s => s.id === event.step.id)
          if (exists) {
            return prev.map(s =>
              s.id === event.step.id ? { ...s, status: 'running' } : s
            )
          }
          return [...prev, { ...event.step, status: 'running' }]
        })
      }

      if (event.type === 'step_done') {
        setSteps(prev =>
          prev.map(s => s.status === 'running' ? { ...s, status: 'done' } : s)
        )
      }

      if (event.type === 'task_complete') {
        setIsRunning(false)
        updateTask(taskId, { status: 'done', prUrl: event.prUrl })
        source.close()
      }

      if (event.type === 'task_failed') {
        setIsRunning(false)
        updateTask(taskId, { status: 'failed' })
        source.close()
      }
    }

    source.onerror = () => {
      setIsRunning(false)
      source.close()
    }

    return () => source.close()
  }, [taskId])

  return { events, steps, isRunning }
}
