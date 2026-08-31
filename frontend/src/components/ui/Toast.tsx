import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, XCircle, Info } from 'lucide-react'

type ToastTone = 'success' | 'error' | 'info'
type Toast = { id: number; message: string; tone: ToastTone }

type ToastCtx = { push: (message: string, tone?: ToastTone) => void }

const Ctx = createContext<ToastCtx | null>(null)

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx)
  if (!ctx) return { push: () => {} }
  return ctx
}

const ICONS = {
  success: <CheckCircle2 className="w-4 h-4 text-success" />,
  error: <XCircle className="w-4 h-4 text-danger" />,
  info: <Info className="w-4 h-4 text-primary" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, tone }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3800)
  }, [])

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-6 right-6 z-overlay flex flex-col gap-2.5 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="pointer-events-auto flex items-center gap-2.5 bg-card border border-border rounded-lg px-4 py-3 min-w-[240px] max-w-sm"
            >
              {ICONS[t.tone]}
              <span className="text-sm text-foreground font-medium">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}
