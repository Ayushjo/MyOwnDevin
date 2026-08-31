import type { Variants, Transition } from 'framer-motion'

export const easeOut: Transition = { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
export const easeMicro: Transition = { duration: 0.15, ease: [0.4, 0, 0.2, 1] }
export const springSoft: Transition = { type: 'spring', stiffness: 400, damping: 32 }

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: easeOut },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: easeOut },
}

export const stagger = (gap = 0.05): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap } },
})

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  show: { opacity: 1, scale: 1, transition: easeOut },
}
