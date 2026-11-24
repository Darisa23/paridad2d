import { motion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef } from 'react'

/** Botón con micro-interacciones (se hunde al pulsar, sube al pasar el cursor). */
export const Btn = forwardRef<HTMLButtonElement, HTMLMotionProps<'button'> & { go?: boolean }>(function Btn(
  { go, className, disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type="button"
      className={[go && 'go', className].filter(Boolean).join(' ') || undefined}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      {...rest}
    />
  )
})
