import { type ReactNode } from 'react'
import { cn } from '../../lib/cn'

type BentoCardProps = React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean
}

function BentoCard({ className, interactive = true, children, ...props }: BentoCardProps) {
  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-xl border border-line bg-paper overflow-hidden',
        interactive && 'transition-colors duration-200 hover:border-primary/30',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function BentoHeader({
  className,
  children,
  action,
}: {
  className?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-3 border-b border-line bg-canvas/50 shrink-0',
        className,
      )}
    >
      <div className="min-w-0">{children}</div>
      {action}
    </div>
  )
}

function BentoContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-4 flex-1', className)}>{children}</div>
}

export { BentoCard, BentoHeader, BentoContent }
