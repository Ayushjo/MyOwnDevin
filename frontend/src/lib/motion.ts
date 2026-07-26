import type { Variants, Transition } from 'framer-motion'

export const easeOut: Transition = { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
export const springSoft: Transition = { type: 'spring', stiffness: 320, damping: 30 }

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: easeOut },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: easeOut },
}

export const stagger = (gap = 0.06): Variants => ({
  hidden: {},
  show:   { transition: { staggerChildren: gap } },
})

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show:   { opacity: 1, scale: 1, transition: springSoft },
}
