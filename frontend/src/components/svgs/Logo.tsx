import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { PullwrightIcon, PullwrightLockup } from './PullwrightMark'

type LogoProps = {
  height?: number
  className?: string
  linked?: boolean
  variant?: 'default' | 'inverse'
  animated?: boolean
}

export default function Logo({
  height = 32,
  className = '',
  linked = true,
  variant = 'default',
  animated = true,
}: LogoProps) {
  const textClassName = variant === 'inverse' ? 'fill-white' : 'fill-ink'
  const lockup = (
    <PullwrightLockup
      height={height}
      className={className}
      textClassName={textClassName}
      animated={animated}
    />
  )

  const inner = animated ? (
    <motion.span
      className="inline-flex group"
      whileHover={{ scale: 1.015 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    >
      {lockup}
    </motion.span>
  ) : (
    <span className="inline-flex">{lockup}</span>
  )

  if (!linked) {
    return <span className={cn('inline-flex shrink-0 group', animated && 'cursor-default')}>{inner}</span>
  }

  return (
    <Link
      to="/"
      className={cn('inline-flex shrink-0 group', className)}
      aria-label="Pullwright home"
    >
      {inner}
    </Link>
  )
}

export function LogoIcon({
  size = 28,
  className = '',
  animated = false,
}: {
  size?: number
  className?: string
  animated?: boolean
}) {
  return <PullwrightIcon size={size} className={className} animated={animated} />
}
