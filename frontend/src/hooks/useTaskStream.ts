import { useState, useEffect, useRef } from 'react'
import type { TaskEvent, Step } from '../types/task'
import { MOCK_STEPS, MOCK_EVENTS } from '../data/mockData'

// Stub — replays mock events with delays to simulate live streaming.
// In Phase 6: replace the useEffect body with a real EventSource connection:
//   const source = new EventSource(`/api/task/${taskId}/stream`)
//   source.onmessage = (e) => setEvents(prev => [...prev, JSON.parse(e.data)])
//   return () => source.close()

export function useTaskStream(taskId: string) {
  const [events, setEvents] = useState<TaskEvent[]>([])
  const [steps, setSteps] = useState<Step[]>(MOCK_STEPS)
  const [isRunning, setIsRunning] = useState(true)
  const indexRef = useRef(0)

  useEffect(() => {
    indexRef.current = 0
    setEvents([])
    setSteps(MOCK_STEPS)
    setIsRunning(true)

    const tick = () => {
      const i = indexRef.current
      if (i >= MOCK_EVENTS.length) {
        setIsRunning(false)
        return
      }

      const event = MOCK_EVENTS[i]!
      setEvents(prev => [...prev, event])

      // Update step statuses as events arrive
      if (event.type === 'step_start') {
        setSteps(prev => prev.map(s =>
          s.id === event.step.id ? { ...s, status: 'running' } : s
        ))
      }
      if (event.type === 'step_done') {
        setSteps(prev => prev.map(s =>
          s.status === 'running' ? { ...s, status: 'done' } : s
        ))
      }

      indexRef.current++
      setTimeout(tick, 900)
    }

    const timer = setTimeout(tick, 500)
    return () => clearTimeout(timer)
  }, [taskId])

  return { events, steps, isRunning }
}
