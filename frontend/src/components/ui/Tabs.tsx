import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'

export type TabItem<T extends string> = { key: T; label: string; count?: number }

export default function Tabs<T extends string>({
  items,
  value,
  onChange,
  layoutId = 'tab-pill',
}: {
  items: TabItem<T>[]
  value: T
  onChange: (v: T) => void
  layoutId?: string
}) {
  return (
    <div className="inline-flex items-center gap-1 bg-card border border-border rounded-lg p-1">
      {items.map((item) => {
        const active = item.key === value
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={cn(
              'relative px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors duration-micro',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 bg-muted rounded-md"
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {item.label}
              {item.count !== undefined && (
                <span
                  className={cn(
                    'text-[10px] tabular-nums px-1.5 py-0.5 rounded-full',
                    active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {item.count}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
