import { AnimatePresence, motion, useAnimate } from 'framer-motion'
import { memo, useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../anim'
import { show, type Sim } from '../useSimulator'
import type { Letter, RecvLetter } from '../types'
import { inputCharPoint, useReveal } from './reveal'

const SentTile = memo(function SentTile({ i, letter, shown, pick }: { i: number; letter: Letter; shown: boolean; pick: boolean }) {
  const face = useReveal<HTMLDivElement>(shown, () => inputCharPoint(i))
  return (
    <div className={`L${pick ? ' pick' : ''}${shown ? '' : ' ghost'}`} id={`sL${i}`} aria-hidden={!shown}>
      <div className="face" ref={face} style={shown ? undefined : { opacity: 0 }}>
        <b>{show(letter.char)}</b>
        <i>{letter.code}</i>
      </div>
    </div>
  )
})

const RecvTile = memo(function RecvTile({ i, letter, pulse }: { i: number; letter: RecvLetter; pulse: number }) {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const prev = useRef(letter.code)
  const reduced = prefersReducedMotion()

  // La ficha «salta» cuando cambia la letra.
  useEffect(() => {
    if (prev.current !== letter.code && scope.current && !reduced) {
      void animate(scope.current, { scale: [0.6, 1.15, 1], rotate: [-8, 3, 0] }, { duration: 0.6 })
    }
    prev.current = letter.code
  }, [letter.code])

  // «Corrigió mal»: las letras que siguen mal laten en rojo.
  useEffect(() => {
    if (pulse && letter.changed && scope.current && !reduced) {
      void animate(scope.current, { scale: [1, 1.18, 1, 1.12, 1] }, { duration: 0.9 })
    }
  }, [pulse])

  const label = `Letra ${i + 1} recibida: ${letter.char === null ? 'no imprimible' : letter.char === ' ' ? 'espacio' : letter.char}, código ${letter.code}${letter.changed ? ', distinta a la enviada' : ''}`
  return (
    <div className={`L${letter.changed ? ' bad' : ''}`} ref={scope} id={`rL${i}`} role="img" aria-label={label}>
      <div className="face">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.b
            key={letter.code}
            initial={{ rotateX: 90, opacity: 0, y: -10 }}
            animate={{ rotateX: 0, opacity: 1, y: 0 }}
            exit={{ rotateX: -90, opacity: 0, y: 10 }}
            transition={{ duration: 0.35 }}
          >
            {show(letter.char)}
          </motion.b>
        </AnimatePresence>
        <i>{letter.code}</i>
      </div>
    </div>
  )
})

const STATUS: Record<string, { text: string; cls: string }> = {
  same: { text: '= igual al enviado ✓', cls: 'ok' },
  text_same: { text: 'texto igual, pero hay bits dañados', cls: 'no' },
  different: { text: '≠ llegó distinto ✗', cls: 'no' },
}

export function Messages({ sim }: { sim: Sim }) {
  const [panel, animate] = useAnimate<HTMLDivElement>()

  // Error silencioso: el panel Recibido tiembla suavemente.
  useEffect(() => {
    if (sim.shake && panel.current && !prefersReducedMotion()) {
      void animate(panel.current, { x: [0, -7, 7, -5, 5, -2, 0] }, { duration: 0.6 })
    }
  }, [sim.shake])

  const st = sim.phase === 'ready' && sim.view ? STATUS[sim.view.status] : null

  return (
    <div className="msgs">
      <section className="pn" aria-labelledby="sent-h">
        <h2 id="sent-h">
          Enviado <span className="tag">lo que sale del emisor</span>
        </h2>
        <div className="big" id="t1">
          {sim.letters.map((l, i) => (
            <SentTile key={`${sim.runId}-${i}`} i={i} letter={l} shown={!!sim.sentShown[i]} pick={sim.pick === i} />
          ))}
        </div>
      </section>
      <div className="arr" aria-hidden="true">
        ➜<small>canal</small>
      </div>
      <section className={`pn${sim.dim ? ' dim' : ''}`} id="recv" ref={panel} aria-labelledby="recv-h">
        <h2 id="recv-h">
          Recibido{' '}
          <span id="eq" className={st?.cls ?? ''} aria-live="polite">
            {st?.text ?? ''}
          </span>
        </h2>
        <div className="big" id="t2">
          {sim.view?.letters.map((l, i) => <RecvTile key={`${sim.runId}-${i}`} i={i} letter={l} pulse={sim.wrongPulse} />)}
        </div>
      </section>
    </div>
  )
}
