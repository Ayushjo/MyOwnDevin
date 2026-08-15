import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: ReactNode
  trailing?: ReactNode
  invalid?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon, trailing, invalid, className, ...props },
  ref,
) {
  return (
    <div
      className={cn(
        'relative flex items-center rounded-xl border bg-white transition-all duration-200',
        invalid
          ? 'border-danger/50 focus-within:shadow-[0_0_0_3px_rgba(239,68,68,0.10)]'
          : 'border-line focus-within:border-primary focus-within:shadow-glow-primary',
      )}
    >
      {icon && <span className="absolute left-3.5 text-faint pointer-events-none flex">{icon}</span>}
      <input
        ref={ref}
        className={cn(
          'w-full bg-transparent text-sm text-ink placeholder-faint outline-none rounded-xl py-3',
          icon ? 'pl-10' : 'pl-4',
          trailing ? 'pr-10' : 'pr-4',
          className,
        )}
        {...props}
      />
      {trailing && <span className="absolute right-3.5 flex">{trailing}</span>}
    </div>
  )
})

export default Input
