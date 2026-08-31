import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export default function Tooltip({
  label,
  children,
  side = 'top',
}: {
  label: string
  children: ReactNode
  side?: 'top' | 'bottom'
}) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: side === 'top' ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: side === 'top' ? 4 : -4 }}
            transition={{ duration: 0.15 }}
            className={`absolute left-1/2 -translate-x-1/2 z-overlay whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-[11px] font-medium text-background border border-border ${
              side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
