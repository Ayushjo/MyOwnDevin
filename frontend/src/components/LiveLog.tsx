import { useEffect, useRef, useState } from 'react'
import type { TaskEvent } from '../types/task'

/* ─────────────────────────────────────────────────────────────────
   Event grouping — fold flat events into per-step buckets
───────────────────────────────────────────────────────────────── */
type ToolEntry = { tool: string; args: Record<string, unknown> }

type ThoughtEntry = {
  agent: string
  status: 'thinking' | 'reasoning'
  text: string
  model?: string
  provider?: string
}

type LogGroup = {
  kind:        'step' | 'phase'
  stepId:      number
  description: string
  tools:       ToolEntry[]
  thoughts:    ThoughtEntry[]
  activeThinking?: string
  output?:     string
  done:        boolean
}

type Derived = {
  groups:    LogGroup[]
  complete?: { prUrl?: string }
  failed?:   string
}

function deriveGroups(events: TaskEvent[]): Derived {
  const groups: LogGroup[] = []
  let cur: LogGroup | null = null
  let complete: { prUrl?: string } | undefined
  let failed: string | undefined

  for (const ev of events) {
    switch (ev.type) {
      case 'step_start':
        if (cur) groups.push(cur)
        cur = { kind: 'step', stepId: ev.step.id, description: ev.step.title ?? ev.step.description, tools: [], thoughts: [], done: false }
        break
      case 'tool_call':
        if (cur) {
          const last = cur.tools[cur.tools.length - 1]
          const dup = last &&
            last.tool === ev.tool &&
            JSON.stringify(last.args) === JSON.stringify(ev.args)
          if (!dup) cur.tools.push({ tool: ev.tool, args: ev.args })
        }
        break
      case 'agent_thought':
        if (!cur) {
          cur = { kind: 'phase', stepId: groups.length + 1, description: `${ev.agent} agent`, tools: [], thoughts: [], done: false }
        }
        if (ev.status === 'thinking') {
          cur.activeThinking = ev.text
        } else {
          cur.thoughts.push({ agent: ev.agent, status: ev.status, text: ev.text, model: ev.model, provider: ev.provider })
          cur.activeThinking = undefined
        }
        break
      case 'step_done':
        if (cur) { cur.output = ev.result.output; cur.done = true }
        break
      case 'task_complete':
        if (cur) { groups.push(cur); cur = null }
        complete = { prUrl: ev.prUrl }
        break
      case 'task_failed':
        if (cur) { groups.push(cur); cur = null }
        failed = ev.reason
        break
      case 'phase_start':
        if (!cur) {
          cur = { kind: 'phase', stepId: groups.length + 1, description: `Phase: ${ev.phase}`, tools: [], thoughts: [], done: false }
        }
        break
      case 'phase_end':
        if (cur && !cur.done) { cur.done = true }
        break
    }
  }
  if (cur) groups.push(cur)
  return { groups, complete, failed }
}

function ToolIcon({ tool }: { tool: string }) {
  const color =
    tool === 'write_file' ? 'text-primary' :
    tool === 'git_commit' ? 'text-primary/80' :
    tool === 'git_checkout' ? 'text-warning' :
    tool === 'run_shell' ? 'text-muted-foreground' :
    'text-muted-foreground'

  if (tool === 'write_file') return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className={color}>
      <path d="M8.5 1.5L11.5 4.5L4 12H1V9L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2"
        strokeLinecap="round" strokeLinejoin="round" />
      <line x1="6.5" y1="3.5" x2="9.5" y2="6.5" stroke="currentColor" strokeWidth="1.2"
        strokeLinecap="round" />
    </svg>
  )
  if (tool === 'git_commit') return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className={color}>
      <circle cx="6.5" cy="6.5" r="2.2" stroke="currentColor" strokeWidth="1.2" />
      <line x1="1" y1="6.5" x2="4.3" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="8.7" y1="6.5" x2="12" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
  if (tool === 'git_checkout') return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className={color}>
      <circle cx="3.5" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="3.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="9.5" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 5V8M3.5 6C3.5 6 6.5 6 9.5 6V5" stroke="currentColor"
        strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
  if (tool === 'run_shell') return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className={color}>
      <path d="M2 4L6 6.5L2 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="7.5" y1="9" x2="11.5" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className={color}>
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function FileView({ filePath, content }: { filePath: string; content: string }) {
  const [expanded, setExpanded] = useState(false)
  const allLines = content.split('\n')
  const previewCount = 12
  const hasMore = allLines.length > previewCount
  const lines = expanded ? allLines : allLines.slice(0, previewCount)
  const hiddenCount = allLines.length - previewCount
  const fileName = filePath.split('/').pop() ?? filePath

  return (
    <div className="mt-2 mb-1 rounded-lg border border-border overflow-hidden bg-card">
      <div className="flex items-start gap-2 border-b border-border px-3 py-2 bg-muted">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-primary shrink-0 mt-0.5">
          <path d="M7.5 1.5L10.5 4.5L3.5 11.5H1.5V9.5L7.5 1.5Z" stroke="currentColor" strokeWidth="1.1"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">write_file</span>
            <span className="font-mono text-[11px] text-foreground font-medium truncate">{fileName}</span>
          </div>
          <p className="font-mono text-[10px] text-muted-foreground truncate mt-0.5" title={filePath}>
            {filePath}
          </p>
        </div>
      </div>

      <div className="log-code-block">
        {lines.map((line, i) => (
          <div key={i} className="log-code-row">
            <span className="log-code-gutter">{i + 1}</span>
            <span className="log-code-line">{line || ' '}</span>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-[11px] text-primary font-medium px-3 py-2 border-t border-border bg-muted/60 hover:bg-muted transition-colors text-left"
        >
          {expanded ? 'Show less' : `+${hiddenCount} more line${hiddenCount > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  )
}

function ThinkingBlock({ thought }: { thought: ThoughtEntry }) {
  const [open, setOpen] = useState(thought.status === 'reasoning')

  if (thought.status === 'thinking') {
    return (
      <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
        <span className="text-primary text-[11px] font-medium">{thought.text}</span>
      </div>
    )
  }

  const preview = thought.text.slice(0, 120)
  const hasMore = thought.text.length > 120

  return (
    <div className="mt-2 rounded-lg border border-primary/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/15 transition-colors text-left"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-primary shrink-0">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M4 6h4M6 4v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="text-primary text-[11px] font-semibold capitalize">{thought.agent} reasoning</span>
        {thought.model && (
          <span className="text-primary/60 text-[10px] font-mono ml-auto">{thought.provider}/{thought.model}</span>
        )}
      </button>
      {open ? (
        <div className="px-3 py-2 bg-card text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
          {thought.text}
        </div>
      ) : hasMore ? (
        <div className="px-3 py-1.5 bg-card text-[10.5px] text-muted-foreground truncate">{preview}…</div>
      ) : null}
    </div>
  )
}

function ToolLine({ entry }: { entry: ToolEntry }) {
  if (entry.tool === 'write_file') {
    const fp = String(entry.args['filePath'] ?? '')
    const ct = String(entry.args['content'] ?? '')
    return <FileView filePath={fp} content={ct} />
  }

  const label =
    entry.tool === 'run_shell'    ? String(entry.args['command']  ?? '').slice(0, 90) :
    entry.tool === 'read_file'    ? String(entry.args['filePath'] ?? '') :
    entry.tool === 'git_commit'   ? String(entry.args['message']  ?? '') :
    entry.tool === 'git_checkout' ? String(entry.args['branch']   ?? '') :
    JSON.stringify(entry.args).slice(0, 70)

  const sigil =
    entry.tool === 'run_shell'    ? '$' :
    entry.tool === 'read_file'    ? '◎' :
    entry.tool === 'git_commit'   ? '⎇' :
    entry.tool === 'git_checkout' ? '⎇' : '›'

  return (
    <div className="flex items-start gap-2 py-0.5 mt-0.5 font-mono">
      <span className="text-muted-foreground w-3 text-center text-[10px] shrink-0 mt-0.5">{sigil}</span>
      <span className="text-muted-foreground text-[11px] leading-relaxed break-all">{label}</span>
    </div>
  )
}

function StepGroup({ group, isLast, registerRef }: { group: LogGroup; isLast: boolean; registerRef?: (stepId: number, el: HTMLDivElement | null) => void }) {
  const primaryTool = group.tools.find(t => t.tool !== 'run_shell')?.tool ?? group.tools[0]?.tool
  const isStep = group.kind === 'step'

  return (
    <div
      className="flex gap-2.5 sm:gap-4"
      ref={el => { if (isStep) registerRef?.(group.stepId, el) }}
    >
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        {isStep ? (
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-primary-foreground text-[10px] sm:text-xs font-bold shrink-0 bg-primary">
            {group.stepId}
          </div>
        ) : (
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shrink-0 bg-muted border border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
          </div>
        )}
        {!isLast && <div className="w-px flex-1 bg-border mt-1.5 min-h-[16px] sm:min-h-[20px]" />}
      </div>

      <div className="flex-1 min-w-0 pb-4 sm:pb-6">
        <div className="flex items-center justify-between gap-2 mb-1 sm:mb-1.5">
          <span className="font-mono text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider truncate">
            <span className="sm:hidden">Step {group.stepId}</span>
            <span className="hidden sm:inline">{isStep ? `LOG EXECUTION | STEP ${group.stepId}` : group.description}</span>
          </span>
          {primaryTool && <ToolIcon tool={primaryTool} />}
        </div>

        {isStep && (
          <div className="flex items-start gap-1.5 mb-1">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="shrink-0 mt-[3px] text-foreground hidden sm:block">
              <path d="M2 5.5L4.5 8L9 3" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-foreground text-[12px] sm:text-[13px] font-semibold leading-snug break-words">{group.description}</span>
          </div>
        )}

        {group.activeThinking && (
          <ThinkingBlock thought={{ agent: 'agent', status: 'thinking', text: group.activeThinking }} />
        )}
        {group.thoughts.map((t, i) => (
          <ThinkingBlock key={i} thought={t} />
        ))}

        {group.tools.map((t, i) => <ToolLine key={i} entry={t} />)}

        {group.output && (
          <div className="mt-2 rounded-lg border border-border bg-muted/50 px-3 py-2 sm:py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Step result</p>
            <p className="text-xs text-foreground leading-relaxed break-words whitespace-pre-wrap">{group.output}</p>
          </div>
        )}

        {!group.done && !group.activeThinking && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-primary text-[11px]">Processing…</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LiveLog({
  events,
  isRunning,
  failedReason,
  registerRef,
  hideCompleteBanner = false,
}: {
  events: TaskEvent[]
  isRunning: boolean
  failedReason?: string
  registerRef?: (stepId: number, el: HTMLDivElement | null) => void
  hideCompleteBanner?: boolean
}) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const { groups, complete, failed: eventFailed } = deriveGroups(events)
  const failed = eventFailed ?? failedReason

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length])

  return (
    <div className="flex flex-col min-h-[280px] md:h-full bg-card md:overflow-hidden">
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 border-b border-border shrink-0 bg-muted/40">
        <span className="text-muted-foreground text-[10px] sm:text-[11px] font-bold uppercase tracking-widest select-none">
          Live log
        </span>
      </div>

      <div className="flex-1 md:overflow-y-auto px-3 py-3 sm:px-5 sm:py-5 bg-card">
        {groups.length === 0 && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            {isRunning && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
            <span>{isRunning ? 'Agent starting…' : 'No events recorded.'}</span>
          </div>
        )}

        {groups.map((g, i) => (
          <StepGroup
            key={`${g.kind}-${g.stepId}-${i}`}
            group={g}
            isLast={i === groups.length - 1 && !complete && !failed}
            registerRef={registerRef}
          />
        ))}

        {complete && !hideCompleteBanner && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2 px-3 sm:px-5 py-3 sm:py-3.5 bg-success/10 border border-success/30 rounded-xl">
            <div className="flex items-center gap-2.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-success shrink-0">
                <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-success font-semibold text-sm">Task complete — PR opened</span>
            </div>
            {complete.prUrl && (
              <a href={complete.prUrl} target="_blank" rel="noreferrer"
                className="text-success text-xs font-medium hover:underline underline-offset-2 shrink-0">
                View PR →
              </a>
            )}
          </div>
        )}

        {failed && (
          <div className="flex items-start gap-2.5 mt-2 px-3 sm:px-5 py-3 sm:py-3.5 bg-destructive/10 border border-destructive/30 rounded-xl">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-destructive shrink-0 mt-0.5">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
              <line x1="7" y1="4" x2="7" y2="7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="7" cy="10" r="0.7" fill="currentColor"/>
            </svg>
            <span className="text-destructive text-sm leading-snug">{failed}</span>
          </div>
        )}

        {isRunning && (
          <span className="cursor-blink text-primary font-mono text-sm mt-2 block">▋</span>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
