import { useId } from 'react'
import { cn } from '../../lib/cn'

type MarkProps = {
  className?: string
  textClassName?: string
  /** Enable hover micro-animations (use inside .group) */
  animated?: boolean
}

function IconPaths({ gradId, animated }: { gradId: string; animated?: boolean }) {
  const motion = animated
    ? 'transition-transform duration-500 ease-out group-hover:translate-x-[3px] group-hover:-translate-y-[1px]'
    : ''

  return (
    <g className={motion}>
      <circle cx="10.5" cy="13.5" r="5.25" fill={`url(#${gradId})`} className={animated ? 'origin-center transition-transform duration-500 group-hover:scale-110' : ''} />
      <circle cx="10.5" cy="42.5" r="5.25" fill={`url(#${gradId})`} className={animated ? 'origin-center transition-transform duration-500 group-hover:scale-110' : ''} />
      <path
        d="M15.5 13.5C24 13.5 27.5 19 30.5 24.5"
        stroke={`url(#${gradId})`}
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M15.5 42.5C24 42.5 27.5 37 30.5 31.5"
        stroke={`url(#${gradId})`}
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M30.5 28H44.5"
        stroke={`url(#${gradId})`}
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
        className={animated ? 'origin-left transition-transform duration-500 group-hover:scale-x-110' : ''}
      />
      <path
        d="M41.5 22.5L50.5 28L41.5 33.5Z"
        fill={`url(#${gradId})`}
        className={animated ? 'transition-transform duration-500 group-hover:translate-x-[4px]' : ''}
      />
    </g>
  )
}

/** Git-branch → arrow icon mark (vector, from Pullwright brand). */
export function PullwrightIcon({
  className = '',
  size = 32,
  animated = false,
}: {
  className?: string
  size?: number
  animated?: boolean
}) {
  const gradId = useId()

  return (
    <svg
      viewBox="0 0 56 56"
      width={size}
      height={size}
      className={cn(className, animated && 'group')}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="4" y1="8" x2="52" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2EC4B6" />
          <stop offset="55%" stopColor="#1FAF7A" />
          <stop offset="100%" stopColor="#169B63" />
        </linearGradient>
      </defs>
      <IconPaths gradId={gradId} animated={animated} />
    </svg>
  )
}

/** Full horizontal lockup — icon + Pullwright wordmark. */
export function PullwrightLockup({
  height = 32,
  className = '',
  textClassName = 'fill-ink',
  animated = false,
}: MarkProps & { height?: number }) {
  const gradId = useId()

  return (
    <svg
      viewBox="0 0 320 56"
      height={height}
      className={cn('w-auto', className)}
      style={{ height }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Pullwright"
    >
      <defs>
        <linearGradient id={gradId} x1="4" y1="8" x2="52" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2EC4B6" />
          <stop offset="55%" stopColor="#1FAF7A" />
          <stop offset="100%" stopColor="#169B63" />
        </linearGradient>
      </defs>

      <IconPaths gradId={gradId} animated={animated} />

      <text
        x="66"
        y="39.5"
        className={cn(
          textClassName,
          animated && 'transition-transform duration-500 group-hover:translate-x-[2px]',
        )}
        style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700, fontSize: 34 }}
      >
        Pullwright
      </text>
    </svg>
  )
}
