import { motion, useAnimate } from 'framer-motion'
import { memo, useEffect, useRef, type KeyboardEvent } from 'react'
import { prefersReducedMotion } from '../anim'
import { useReveal, type Origin } from './reveal'

interface Props {
  r: number
  c: number
  value: number
  shown: boolean
  parity: boolean
  hl: boolean
  band: boolean
  sus: boolean
  wrong: boolean
  fixedKey: number | null
  clickable: boolean
  focusable: boolean
  label: string
  origin?: Origin
  onFlip: (r: number, c: number) => void
  onKey: (e: KeyboardEvent<HTMLButtonElement>, r: number, c: number) => void
  onFocusCell: (r: number, c: number) => void
}

function CellImpl(p: Props) {
  const face = useReveal<HTMLSpanElement>(p.shown, p.origin)
  const [bit, animateBit] = useAnimate<HTMLSpanElement>()
  const prev = useRef(p.value)

  // Giro 3D cuando el bit cambia (error, volteo manual o corrección).
  useEffect(() => {
    if (prev.current !== p.value && p.shown && bit.current && !prefersReducedMotion()) {
      void animateBit(bit.current, { rotateY: [180, 0] }, { duration: 0.5, ease: 'easeOut' })
    }
    prev.current = p.value
  }, [p.value])

  const cls = [
    'c',
    p.parity && 'p',
    p.value && 'on',
    !p.shown && 'ghost',
    p.hl && 'hl',
    p.band && 'band',
    p.sus && 'sus',
    p.wrong && 'fl',
    p.fixedKey !== null && 'fx',
    p.clickable && 'clk',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      id={`c${p.r}_${p.c}`}
      className={cls}
      aria-label={p.label}
      aria-disabled={!p.clickable}
      tabIndex={p.shown && p.focusable ? 0 : -1}
      onClick={() => p.clickable && p.onFlip(p.r, p.c)}
      onKeyDown={(e) => p.onKey(e, p.r, p.c)}
      onFocus={() => p.onFocusCell(p.r, p.c)}
    >
      <span className="face" ref={face} style={p.shown ? undefined : { opacity: 0 }}>
        <span className="bit" ref={bit}>
          {p.value}
        </span>
      </span>
      {p.fixedKey !== null && (
        <motion.span
          key={p.fixedKey}
          className="ring"
          aria-hidden="true"
          initial={{ scale: 0.6, opacity: 0.95 }}
          animate={{ scale: 2.8, opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      )}
    </button>
  )
}

export const Cell = memo(CellImpl)
