import type { Step } from '../types/task'

function StepCircle({ step }: { step: Step }) {
  if (step.status === 'done') {
    return (
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-success/20 border border-success/50
        flex items-center justify-center">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5L4 7L8 3" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }
  if (step.status === 'failed') {
    return (
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-danger/20 border border-danger/50
        flex items-center justify-center">
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M2 2L6 6M6 2L2 6" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    )
  }
  if (step.status === 'running') {
    return (
      <span className="relative flex-shrink-0 w-6 h-6 flex items-center justify-center">
        <span className="ping-ring absolute w-6 h-6 rounded-full bg-primary/30" />
        <span className="relative w-6 h-6 rounded-full bg-primary/20 border border-primary/60
          flex items-center justify-center text-[10px] font-bold text-primary-light">
          {step.id}
        </span>
      </span>
    )
  }
  return (
    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-elevated border border-subtle
      flex items-center justify-center text-[10px] text-slate-500">
      {step.id}
    </span>
  )
}

export default function StepList({ steps }: { steps: Step[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {steps.map(step => (
        <div
          key={step.id}
          className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
            ${step.status === 'running'
              ? 'bg-primary/5 border border-primary/20 shadow-[inset_2px_0_0_#6366F1]'
              : 'border border-transparent'
            }`}
        >
          <StepCircle step={step} />
          <p className={`text-sm leading-snug mt-0.5
            ${step.status === 'done'    ? 'text-slate-500 line-through' :
              step.status === 'running' ? 'text-slate-100' :
              step.status === 'failed'  ? 'text-danger' :
              'text-slate-500'}`}>
            {step.description}
          </p>
        </div>
      ))}
    </div>
  )
}
