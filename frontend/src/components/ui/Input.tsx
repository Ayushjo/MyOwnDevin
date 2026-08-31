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
        'relative flex items-center rounded-sm border bg-card transition-colors duration-micro',
        invalid
          ? 'border-danger focus-within:ring-2 focus-within:ring-danger/30'
          : 'border-border focus-within:ring-2 focus-within:ring-[rgba(43,127,255,0.3)]',
      )}
    >
      {icon && <span className="absolute left-3 text-muted-foreground pointer-events-none flex">{icon}</span>}
      <input
        ref={ref}
        className={cn(
          'w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none rounded-sm py-2',
          icon ? 'pl-9' : 'pl-3',
          trailing ? 'pr-9' : 'pr-3',
          className,
        )}
        {...props}
      />
      {trailing && <span className="absolute right-3 flex">{trailing}</span>}
    </div>
  )
})

export default Input
