import { useEffect, useRef } from 'react'
import type { TaskEvent } from '../types/task'

/* ─────────────────────────────────────────────────────────────────
   Event grouping — fold flat events into per-step buckets
───────────────────────────────────────────────────────────────── */
type ToolEntry = { tool: string; args: Record<string, unknown> }

type LogGroup = {
  stepId:      number
  description: string
  tools:       ToolEntry[]
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
        cur = { stepId: ev.step.id, description: ev.step.description, tools: [], done: false }
        break
      case 'tool_call':
        cur?.tools.push({ tool: ev.tool, args: ev.args })
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
    }
  }
  if (cur) groups.push(cur)
  return { groups, complete, failed }
}

/* ─────────────────────────────────────────────────────────────────
   Tool-specific icons shown on the right of the LOG header
───────────────────────────────────────────────────────────────── */
function ToolIcon({ tool }: { tool: string }) {
  if (tool === 'write_file') return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-blue-500">
      <path d="M8.5 1.5L11.5 4.5L4 12H1V9L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2"
        strokeLinecap="round" strokeLinejoin="round" />
      <line x1="6.5" y1="3.5" x2="9.5" y2="6.5" stroke="currentColor" strokeWidth="1.2"
        strokeLinecap="round" />
    </svg>
  )
  if (tool === 'git_commit') return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-purple-500">
      <circle cx="6.5" cy="6.5" r="2.2" stroke="currentColor" strokeWidth="1.2" />
      <line x1="1" y1="6.5" x2="4.3" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="8.7" y1="6.5" x2="12" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
  if (tool === 'git_checkout') return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-orange-500">
      <circle cx="3.5" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="3.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="9.5" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 5V8M3.5 6C3.5 6 6.5 6 9.5 6V5" stroke="currentColor"
        strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
  if (tool === 'run_shell') return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-gray-500">
      <path d="M2 4L6 6.5L2 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="7.5" y1="9" x2="11.5" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-gray-400">
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Embedded file view — shown when write_file is called
───────────────────────────────────────────────────────────────── */
function FileView({ filePath, content }: { filePath: string; content: string }) {
  const lines = content.split('\n').slice(0, 9)
  const extra = content.split('\n').length - 9
  const fileName = filePath.split('/').pop() ?? filePath

  return (
    <div className="mt-2 mb-1 rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 bg-gray-50 border-b border-gray-200 px-3 py-1.5">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="text-blue-400 shrink-0">
          <rect x="1.5" y="0.5" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
          <line x1="3.5" y1="3.5" x2="7.5" y2="3.5" stroke="currentColor" strokeWidth="0.9" />
          <line x1="3.5" y1="5.5" x2="7.5" y2="5.5" stroke="currentColor" strokeWidth="0.9" />
          <line x1="3.5" y1="7.5" x2="6"   y2="7.5" stroke="currentColor" strokeWidth="0.9" />
        </svg>
        <span className="font-mono text-[10px] text-gray-700 font-medium">{fileName}</span>
        <span className="font-mono text-[10px] text-gray-400 ml-1 truncate hidden sm:block">{filePath}</span>
      </div>
      {/* Code */}
      <div className="bg-white font-mono overflow-x-auto">
        {lines.map((line, i) => (
          <div key={i} className="flex min-h-[18px]">
            <span className="w-8 shrink-0 text-right pr-2 text-[9.5px] leading-[18px] text-gray-300 border-r border-gray-100 select-none">
              {i + 1}
            </span>
            <span className="pl-2.5 pr-3 text-[10.5px] leading-[18px] text-gray-600 whitespace-pre">
              {line || ' '}
            </span>
          </div>
        ))}
        {extra > 0 && (
          <div className="text-[10px] text-gray-400 px-3 py-1 border-t border-gray-100 font-sans">
            +{extra} more line{extra > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Single tool call line
───────────────────────────────────────────────────────────────── */
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
      <span className="text-gray-400 w-3 text-center text-[10px] shrink-0 mt-0.5">{sigil}</span>
      <span className="text-gray-500 text-[11px] leading-relaxed break-all">{label}</span>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Single step group
───────────────────────────────────────────────────────────────── */
function StepGroup({ group, isLast }: { group: LogGroup; isLast: boolean }) {
  const primaryTool = group.tools.find(t => t.tool !== 'run_shell')?.tool ?? group.tools[0]?.tool

  return (
    <div className="flex gap-4">
      {/* Left: circle + connector line */}
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
          style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }}
        >
          {group.stepId}
        </div>
        {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1.5 min-h-[20px]" />}
      </div>

      {/* Right: content */}
      <div className="flex-1 min-w-0 pb-6">
        {/* LOG EXECUTION header */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-[10px] text-gray-400 uppercase tracking-wider">
            LOG EXECUTION | STEP {group.stepId}
          </span>
          {primaryTool && <ToolIcon tool={primaryTool} />}
        </div>

        {/* ✓ Step description */}
        <div className="flex items-start gap-1.5 mb-1">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="shrink-0 mt-[3px] text-gray-800">
            <path d="M2 5.5L4.5 8L9 3" stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-gray-900 text-[13px] font-semibold leading-snug">{group.description}</span>
        </div>

        {/* Tool calls */}
        {group.tools.map((t, i) => <ToolLine key={i} entry={t} />)}

        {/* ✓ Step output */}
        {group.output && (
          <div className="flex items-start gap-1.5 mt-1.5">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="shrink-0 mt-[3px] text-gray-400">
              <path d="M2 5.5L4.5 8L9 3" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-mono text-[10.5px] text-gray-500 leading-relaxed line-clamp-3">
              {group.output.slice(0, 160)}
            </span>
          </div>
        )}

        {/* In-progress indicator */}
        {!group.done && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-indigo-500 text-[11px]">Processing…</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Main export
───────────────────────────────────────────────────────────────── */
export default function LiveLog({ events, isRunning }: { events: TaskEvent[]; isRunning: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const { groups, complete, failed } = deriveGroups(events)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length])

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Terminal chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 shrink-0">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-gray-600 text-[11px] font-bold uppercase tracking-widest select-none">
          TERMINAL
        </span>
      </div>

      {/* Scrollable log */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {groups.length === 0 && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            {isRunning && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />}
            <span>{isRunning ? 'Agent starting…' : 'No events recorded.'}</span>
          </div>
        )}

        {groups.map((g, i) => (
          <StepGroup key={g.stepId} group={g} isLast={i === groups.length - 1 && !complete && !failed} />
        ))}

        {/* ── Task complete banner ── */}
        {complete && (
          <div className="flex items-center justify-between gap-3 mt-2 px-5 py-3.5
            bg-green-50 border border-green-200 rounded-xl shadow-sm">
            <div className="flex items-center gap-2.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-green-600 shrink-0">
                <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-green-700 font-semibold text-sm">Task complete — PR opened</span>
            </div>
            {complete.prUrl && (
              <a href={complete.prUrl} target="_blank" rel="noreferrer"
                className="text-green-700 text-xs font-medium hover:underline underline-offset-2 shrink-0">
                View PR →
              </a>
            )}
          </div>
        )}

        {/* ── Task failed banner ── */}
        {failed && (
          <div className="flex items-start gap-2.5 mt-2 px-5 py-3.5
            bg-red-50 border border-red-200 rounded-xl">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-red-600 shrink-0 mt-0.5">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
              <line x1="7" y1="4" x2="7" y2="7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="7" cy="10" r="0.7" fill="currentColor"/>
            </svg>
            <span className="text-red-700 text-sm leading-snug">{failed}</span>
          </div>
        )}

        {/* Blinking cursor while running */}
        {isRunning && (
          <span className="cursor-blink text-indigo-500 font-mono text-sm mt-2 block">▋</span>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
