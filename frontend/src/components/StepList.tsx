import type { Step } from '../types/task'

function StepCircle({ step }: { step: Step }) {
  if (step.status === 'done') {
    return (
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center shadow-sm">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }
  if (step.status === 'failed') {
    return (
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-50 border border-red-300 flex items-center justify-center">
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M2 2L6 6M6 2L2 6" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    )
  }
  if (step.status === 'running') {
    return (
      <span className="relative flex-shrink-0 w-6 h-6 flex items-center justify-center">
        <span className="ping-ring absolute w-6 h-6 rounded-full bg-indigo-300" />
        <span className="relative w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
          {step.id}
        </span>
      </span>
    )
  }
  return (
    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center text-[10px] text-gray-500 font-medium">
      {step.id}
    </span>
  )
}

export default function StepList({ steps }: { steps: Step[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      {steps.map(step => (
        <div
          key={step.id}
          className={`flex items-start gap-2.5 px-2 py-2.5 rounded-lg transition-all duration-200 ${
            step.status === 'running'
              ? 'bg-indigo-50 border border-indigo-100'
              : 'border border-transparent'
          }`}
        >
          <div className="mt-0.5"><StepCircle step={step} /></div>
          <p className={`text-xs leading-snug ${
            step.status === 'done'    ? 'text-gray-600' :
            step.status === 'running' ? 'text-gray-900 font-medium' :
            step.status === 'failed'  ? 'text-red-600' :
            'text-gray-400'
          }`}>
            {step.description}
          </p>
        </div>
      ))}
    </div>
  )
}
