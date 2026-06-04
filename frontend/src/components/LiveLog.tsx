import { useEffect, useRef } from 'react'
import type { TaskEvent } from '../types/task'

function LogLine({ event, index }: { event: TaskEvent; index: number }) {
  const style = { animationDelay: `${index * 0.04}s` }

  if (event.type === 'step_start') {
    return (
      <div className="log-line flex items-start gap-2.5 py-1" style={style}>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary-light border border-primary/30 flex-shrink-0 mt-0.5">
          STEP {event.step.id}
        </span>
        <span className="text-slate-300 text-sm">{event.step.description}</span>
      </div>
    )
  }

  if (event.type === 'tool_call') {
    const colors: Record<string, { icon: string; color: string }> = {
      run_shell:  { icon: '$',  color: 'text-warning' },
      write_file: { icon: '✎', color: 'text-sky-400' },
      read_file:  { icon: '◎', color: 'text-cyan-400' },
      git_commit: { icon: '⎇', color: 'text-accent' },
    }
    const cfg = colors[event.tool] ?? { icon: '›', color: 'text-slate-400' }
    const arg = event.tool === 'run_shell' ? (event.args['command'] as string) :
                (event.args['filePath'] as string) ?? ''

    return (
      <div className="log-line flex items-start gap-2.5 py-0.5 pl-4" style={style}>
        <span className={`font-mono font-bold flex-shrink-0 text-sm ${cfg.color}`}>{cfg.icon}</span>
        <span className="font-mono text-xs text-slate-400">{arg}</span>
      </div>
    )
  }

  if (event.type === 'step_done') {
    return (
      <div className="log-line flex items-center gap-2 py-0.5 pl-4" style={style}>
        <span className="text-success text-sm">✓</span>
        <span className="text-slate-500 text-xs truncate">{event.result.output.slice(0, 80)}</span>
      </div>
    )
  }

  if (event.type === 'task_failed') {
    return (
      <div className="log-line flex items-start gap-2.5 py-2 px-3 rounded-lg bg-danger/5 border border-danger/20 mt-2" style={style}>
        <span className="text-danger text-sm flex-shrink-0">✗</span>
        <span className="text-danger/80 text-sm">{event.reason}</span>
      </div>
    )
  }

  if (event.type === 'task_complete') {
    return (
      <div className="log-line flex items-center justify-between py-2.5 px-4 rounded-xl
        bg-success/10 border border-success/25 mt-3" style={style}>
        <div className="flex items-center gap-2">
          <span className="text-success text-base">✓</span>
          <span className="text-success font-medium text-sm">Task complete — PR opened</span>
        </div>
        {event.prUrl && (
          <a href={event.prUrl} target="_blank" rel="noreferrer"
            className="text-xs text-success/70 hover:text-success underline underline-offset-2">
            View PR →
          </a>
        )}
      </div>
    )
  }

  return null
}

export default function LiveLog({ events, isRunning }: { events: TaskEvent[]; isRunning: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length])

  return (
    <div className="flex flex-col h-full bg-[#060A12] rounded-xl border border-subtle overflow-hidden">
      {/* Terminal header bar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-subtle">
        <span className="w-2.5 h-2.5 rounded-full bg-danger/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-warning/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-success/60" />
        <span className="ml-3 text-slate-600 text-xs font-mono">agent output</span>
      </div>

      {/* Log content */}
      <div className="flex-1 overflow-y-auto p-4 font-mono space-y-0.5">
        {events.length === 0 && (
          <p className="text-slate-600 text-sm">Waiting for agent to start...</p>
        )}
        {events.map((event, i) => (
          <LogLine key={i} event={event} index={i} />
        ))}
        {isRunning && (
          <div className="flex items-center gap-1 pt-1 pl-0.5">
            <span className="cursor-blink text-primary-light font-mono text-sm">▋</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
