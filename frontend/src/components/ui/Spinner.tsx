import { cn } from '../../lib/cn'

export default function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className ?? 'w-4 h-4')} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
