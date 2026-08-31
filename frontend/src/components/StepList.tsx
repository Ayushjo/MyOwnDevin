import { motion, AnimatePresence } from 'framer-motion'
import type { Step } from '../types/task'
import { cn } from '../lib/cn'

function StepCircle({ step }: { step: Step }) {
  const base = 'w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-micro'

  if (step.status === 'done') {
    return (
      <motion.span
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={cn(base, 'bg-success text-white')}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.span>
    )
  }

  if (step.status === 'failed') {
    return (
      <motion.span
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(base, 'bg-red-50 border border-red-200')}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M2 2L6 6M6 2L2 6" stroke="#CF222E" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </motion.span>
    )
  }

  if (step.status === 'running') {
    return (
      <span className={cn(base, 'relative')}>
        <span className="ping-ring absolute w-6 h-6 rounded-full bg-primary/25" />
        <span className={cn(base, 'relative bg-primary text-primary-foreground text-[9px] font-semibold')}>
          {step.id}
        </span>
      </span>
    )
  }

  return (
    <span className={cn(base, 'bg-elevated border border-border text-[10px] text-muted-foreground font-medium')}>
      {step.id}
    </span>
  )
}

interface StepListProps {
  steps: Step[]
  onStepClick?: (stepId: number) => void
  highlightedStepId?: number | null
}

export default function StepList({ steps, onStepClick, highlightedStepId }: StepListProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <AnimatePresence initial={false}>
        {steps.map((step, i) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: i * 0.03 }}
            role="button"
            tabIndex={0}
            onClick={() => onStepClick?.(step.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onStepClick?.(step.id)
              }
            }}
            className={cn(
              'relative flex items-start gap-2.5 px-2 py-2.5 rounded-md transition-colors duration-micro',
              onStepClick ? 'cursor-pointer' : '',
              step.status === 'running'
                ? 'bg-primary/10 border border-primary/20'
                : highlightedStepId === step.id
                  ? 'bg-elevated border border-primary/30'
                  : 'border border-transparent hover:bg-elevated',
            )}
          >
            {i < steps.length - 1 && (
              <span
                className={cn(
                  'absolute left-[18px] top-10 w-px h-[calc(100%-24px)]',
                  step.status === 'done' ? 'bg-success/30' : 'bg-border',
                )}
              />
            )}

            <div className="mt-0.5">
              <StepCircle step={step} />
            </div>

            <p
              title={step.description}
              className={cn(
                'text-xs leading-relaxed',
                step.status === 'done' && 'text-muted-foreground line-through decoration-muted-foreground/40',
                step.status === 'running' && 'text-foreground font-medium',
                step.status === 'failed' && 'text-danger',
                step.status === 'pending' && 'text-muted-foreground',
              )}
            >
              {step.title ?? step.description}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
