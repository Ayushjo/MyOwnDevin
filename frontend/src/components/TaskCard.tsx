import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Task } from '../types/task'
import { Badge } from './ui'
import { cn } from '../lib/cn'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function statusTone(status: Task['status']): 'success' | 'warning' | 'danger' | 'neutral' | 'primary' {
  if (status === 'done') return 'success'
  if (status === 'running' || status === 'planning') return 'primary'
  if (status === 'failed') return 'danger'
  if (status === 'queued') return 'warning'
  return 'neutral'
}

function statusLabel(status: Task['status']): string {
  const map: Record<Task['status'], string> = {
    done:       'Done',
    running:    'Running',
    planning:   'Planning',
    verifying:  'Verifying',
    failed:     'Failed',
    queued:     'Queued',
  }
  return map[status] ?? status
}

/* Live status dot — pulses while running */
function StatusDot({ status }: { status: Task['status'] }) {
  const isLive = status === 'running' || status === 'planning' || status === 'verifying'
  if (!isLive) return null
  return (
    <span className="relative flex items-center justify-center w-2 h-2 shrink-0">
      <span className="absolute w-2 h-2 rounded-full bg-primary/30 animate-ping" />
      <span className="relative w-1.5 h-1.5 rounded-full bg-primary" />
    </span>
  )
}

export default function TaskCard({ task }: { task: Task }) {
  const done  = task.steps.filter((s) => s.status === 'done').length
  const total = task.steps.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  const progressColor =
    task.status === 'failed' ? '#EF4444' :
    task.status === 'done'   ? '#10B981' : '#6366F1'

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 350, damping: 26 }}
    >
      <Link
        to={`/tasks/${task.id}`}
        className={cn(
          'block bg-paper rounded-xl border border-line p-4 group',
          'hover:border-primary/30 hover:shadow-card transition-all duration-150',
        )}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge tone={statusTone(task.status)} dot={false}>
                <StatusDot status={task.status} />
                {statusLabel(task.status)}
              </Badge>
              <span className="text-faint text-xs">{timeAgo(task.createdAt)}</span>
            </div>
            <p className="text-ink text-sm font-medium leading-snug truncate group-hover:text-primary-dark transition-colors">
              {task.issueNumber > 0 ? `#${task.issueNumber} — ` : ''}{task.issueTitle}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="font-mono text-[10.5px] text-mute bg-canvas px-2 py-0.5 rounded-lg border border-line truncate max-w-[160px]">
                {task.branchName}
              </span>
              <span className="text-faint text-xs truncate">{task.repoName}</span>
            </div>
          </div>

          {/* Right: progress */}
          <div className="flex-shrink-0 text-right">
            <p className="text-xs text-faint mb-1.5 tabular-nums">{done}/{total} steps</p>
            <div className="w-20 h-1.5 bg-line rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: progressColor }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
