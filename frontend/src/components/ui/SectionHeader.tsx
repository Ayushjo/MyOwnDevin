import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export default function SectionHeader({
  eyebrow,
  title,
  description,
  className,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  className?: string
  action?: ReactNode
}) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2', className)}>
      <div>
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-faint mb-1.5">{eyebrow}</p>
        )}
        <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">{title}</h2>
        {description && <p className="text-sm text-mute mt-1 max-w-lg">{description}</p>}
      </div>
      {action}
    </div>
  )
}
