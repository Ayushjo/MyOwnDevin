import type { TaskStatus } from '../types/task'

const CONFIG: Record<TaskStatus, { label: string; dot: string; text: string; ring?: boolean }> = {
  queued:    { label: 'Queued',    dot: 'bg-slate-500',  text: 'text-slate-400' },
  planning:  { label: 'Planning',  dot: 'bg-warning',    text: 'text-warning',  ring: true },
  running:   { label: 'Running',   dot: 'bg-warning',    text: 'text-warning',  ring: true },
  verifying: { label: 'Verifying', dot: 'bg-primary',    text: 'text-primary-light', ring: true },
  done:      { label: 'Done',      dot: 'bg-success',    text: 'text-success' },
  failed:    { label: 'Failed',    dot: 'bg-danger',     text: 'text-danger' },
}

export default function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
      bg-surface border border-subtle ${cfg.text}`}>
      <span className="relative flex h-1.5 w-1.5">
        {cfg.ring && (
          <span className={`ping-ring absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-60`} />
        )}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${cfg.dot}`} />
      </span>
      {cfg.label}
    </span>
  )
}
