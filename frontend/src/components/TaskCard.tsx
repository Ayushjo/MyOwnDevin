import { Link } from 'react-router-dom'
import type { Task } from '../types/task'
import StatusBadge from './StatusBadge'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function TaskCard({ task }: { task: Task }) {
  const done  = task.steps.filter(s => s.status === 'done').length
  const total = task.steps.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <Link
      to={`/tasks/${task.id}`}
      className="card-hover block bg-surface rounded-xl p-4 group"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <StatusBadge status={task.status} />
            <span className="text-slate-600 text-xs">{timeAgo(task.createdAt)}</span>
          </div>
          <p className="text-slate-100 text-sm font-medium leading-snug truncate group-hover:text-white transition-colors">
            #{task.issueNumber} — {task.issueTitle}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="font-mono text-[11px] text-slate-500 bg-elevated px-2 py-0.5 rounded border border-subtle">
              {task.branchName}
            </span>
            <span className="text-slate-600 text-xs">{task.repoName}</span>
          </div>
        </div>

        {/* Right: progress */}
        <div className="flex-shrink-0 text-right">
          <p className="text-xs text-slate-500 mb-1.5">{done}/{total} steps</p>
          <div className="w-20 h-1 bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: task.status === 'failed' ? '#EF4444' :
                            task.status === 'done'   ? '#10B981' : '#6366F1',
              }}
            />
          </div>
        </div>
      </div>
    </Link>
  )
}
