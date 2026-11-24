import { AnimatePresence, motion } from 'framer-motion'
import { useId, useRef, useState } from 'react'
import { api, ApiError, randomSeed } from '../api'
import type { MonteCarloRes } from '../types'
import { Btn } from './Btn'

const BLOCKS = 10_000
const pct = (v: number) => v.toLocaleString('es', { minimumFractionDigits: v > 0 && v < 1 ? 2 : 1, maximumFractionDigits: 2 }) + ' %'

export function Results({ onConnectionError }: { onConnectionError: (msg: string, retry: () => void) => void }) {
  const [open, setOpen] = useState(false)
  const [p, setP] = useState(0.01)
  const [res, setRes] = useState<MonteCarloRes | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  const id = useId()

  const run = async () => {
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setLoading(true)
    setErr(null)
    try {
      setRes(await api.montecarlo(p, BLOCKS, randomSeed(), { signal: ctrl.signal }))
    } catch (e) {
      if (e instanceof ApiError && e.kind === 'aborted') return
      const msg = e instanceof Error ? e.message : 'No se pudo simular.'
      setErr(msg)
      if (e instanceof ApiError && e.isConnection) onConnectionError(msg, () => void run())
    } finally {
      if (abort.current === ctrl) setLoading(false)
    }
  }

  return (
    <section className="card results">
      <button type="button" className="fold" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span>Resultados</span>
        <motion.span aria-hidden="true" animate={{ rotate: open ? 90 : 0 }} className="chev">
          ›
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="res-body">
              <p className="mu">
                Simulación de {BLOCKS.toLocaleString('es')} bloques con los mismos <b>16 bits de datos</b> en los cuatro
                esquemas (producto 4×4 → 25 bits; Hamming 4 × 7 = 28 bits). Cada bit se invierte con probabilidad <i>p</i>.
              </p>
              <div className="row">
                <label htmlFor={`${id}-p`} className="plabel">
                  p = <b>{(p * 100).toLocaleString('es', { maximumFractionDigits: 1 })} %</b>
                </label>
                <input
                  id={`${id}-p`}
                  type="range"
                  min={0.001}
                  max={0.1}
                  step={0.001}
                  value={p}
                  onChange={(e) => setP(+e.target.value)}
                  aria-valuetext={`${(p * 100).toFixed(1)} por ciento`}
                />
                <Btn go onClick={run} disabled={loading}>
                  {loading ? 'Simulando…' : `Simular ${BLOCKS.toLocaleString('es')} bloques`}
                </Btn>
              </div>
              {err && (
                <p className="input-err" role="alert">
                  {err}
                </p>
              )}
              <div className="legend" aria-hidden="true">
                <span className="k-ok">correcto</span>
                <span className="k-det">detectado</span>
                <span className="k-sil">silencioso</span>
              </div>
              <div className={`bars${loading ? ' loading' : ''}`}>
                {(res?.schemes ?? PLACEHOLDER).map((s) => (
                  <div className="bar-row" key={s.key}>
                    <div className="bar-name">
                      {s.label}
                      <small>{s.bits_sent} bits</small>
                    </div>
                    <div
                      className="bar"
                      role="img"
                      aria-label={
                        res ? `${s.label}: ${pct(s.correct)} correcto, ${pct(s.detected)} detectado, ${pct(s.silent)} silencioso` : `${s.label}: sin datos`
                      }
                    >
                      <motion.span className="seg ok" animate={{ width: `${s.correct}%` }} transition={{ duration: 0.7 }} />
                      <motion.span className="seg det" animate={{ width: `${s.detected}%` }} transition={{ duration: 0.7 }} />
                      <motion.span className="seg sil" animate={{ width: `${s.silent}%` }} transition={{ duration: 0.7 }} />
                    </div>
                    <div className="bar-num">
                      {res ? (
                        <>
                          <span className="k-ok">{pct(s.correct)}</span>
                          <span className="k-det">{pct(s.detected)}</span>
                          <span className="k-sil">{pct(s.silent)}</span>
                        </>
                      ) : (
                        <span className="mu">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {res && (
                <p className="mu small">
                  Con más letras por bloque la tasa mejora (R = 7L / (8(L+1)): 0,78 con 8 letras, 0,84 con 24), pero la
                  distancia sigue siendo 4: un bloque grande acumula más fácilmente 2 o más errores y deja de poder corregirse.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

const PLACEHOLDER = [
  { key: 'none', label: 'Sin código', bits_sent: 16, correct: 0, detected: 0, silent: 0 },
  { key: 'detect', label: 'Producto (detectar)', bits_sent: 25, correct: 0, detected: 0, silent: 0 },
  { key: 'correct', label: 'Producto (corregir)', bits_sent: 25, correct: 0, detected: 0, silent: 0 },
  { key: 'hamming', label: 'Hamming (7,4) × 4', bits_sent: 28, correct: 0, detected: 0, silent: 0 },
] as const
