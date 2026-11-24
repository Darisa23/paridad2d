import { AnimatePresence, motion, MotionConfig, animate, useMotionValue, useTransform } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'
import { useSimulator } from './useSimulator'
import { Btn } from './components/Btn'
import { ErrorPanel } from './components/ErrorPanel'
import { Header } from './components/Header'
import { Messages } from './components/Messages'
import { ParityTable } from './components/ParityTable'
import { Results } from './components/Results'

const SPEEDS = [
  { v: 0.5, label: 'Rápido' },
  { v: 1, label: 'Normal' },
  { v: 1.6, label: 'Lento' },
]

/** Número que cuenta desde 0 hasta su valor. */
function CountUp({ value }: { value: number }) {
  const mv = useMotionValue(0)
  const rounded = useTransform(mv, (v) => Math.round(v))
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.45, ease: 'easeOut' })
    return () => c.stop()
  }, [mv, value])
  return <motion.span>{rounded}</motion.span>
}

const enter = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.06 * i, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } }),
}
const Enter = ({ i, children, className }: { i: number; children: ReactNode; className?: string }) => (
  <motion.div custom={i} variants={enter} initial="hidden" animate="show" className={className}>
    {children}
  </motion.div>
)

export default function App() {
  const { sim, maxChars, conn, failure, inputError, setInputError, wrapRef, actions, reportFailure } = useSimulator()
  const [text, setText] = useState('HOLA')
  const [speed, setSpeed] = useState(1)

  useEffect(() => actions.setSpeed(speed), [speed, actions])

  const convert = () => void actions.convert(text)

  return (
    <MotionConfig reducedMotion="user">
      <main>
        <Enter i={0}>
          <Header conn={conn} />
        </Enter>

        <AnimatePresence>
          {failure && (
            <motion.div
              className="banner"
              role="alert"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <span>
                <b>Sin conexión con el servidor de cálculo.</b> {failure.message} Revisa que el backend esté encendido.
              </span>
              <Btn go onClick={() => void actions.retry()}>
                Reintentar
              </Btn>
            </motion.div>
          )}
        </AnimatePresence>

        <Enter i={1}>
          <section className="card">
            <div className="row">
              <input
                type="text"
                id="inp"
                value={text}
                maxLength={maxChars}
                aria-label="Registro a enviar"
                aria-invalid={!!inputError}
                aria-describedby={inputError ? 'inp-err' : undefined}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => {
                  setText(e.target.value)
                  if (inputError) setInputError(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && convert()}
              />
              <Btn go id="conv" onClick={convert}>
                Convertir a ASCII
              </Btn>
              <select id="spd" aria-label="Velocidad" value={speed} onChange={(e) => setSpeed(+e.target.value)}>
                {SPEEDS.map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.label}
                  </option>
                ))}
              </select>
              <Btn id="skip" onClick={actions.skip} disabled={!sim.busy}>
                Saltar animación
              </Btn>
            </div>
            <AnimatePresence>
              {inputError && (
                <motion.p
                  id="inp-err"
                  className="input-err"
                  role="alert"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {inputError}
                </motion.p>
              )}
            </AnimatePresence>
          </section>
        </Enter>

        <Enter i={2}>
          <Messages sim={sim} />
        </Enter>

        <div className="stage">
          <Enter i={3}>
            <section className="card" aria-label="Tabla de bits">
              <div id="say" role="status" aria-live="polite">
                <span>{sim.say}</span>
                <AnimatePresence mode="popLayout">
                  {sim.counter && (
                    <motion.span
                      key={sim.counter.key}
                      id="counter-chip"
                      className="chip"
                      initial={{ opacity: 0, scale: 0.7, y: 6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                      aria-hidden="true"
                    >
                      Σ <CountUp value={sim.counter.ones} /> → <b>{sim.counter.parity}</b>
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <ParityTable key={sim.runId} sim={sim} wrapRef={wrapRef} onFlip={actions.flip} />
              <div className="row" style={{ marginTop: 12 }}>
                <Btn id="pc" disabled={sim.phase !== 'converted' || sim.busy} onClick={() => void actions.parCols()}>
                  Agregar paridad por columnas
                </Btn>
                <Btn id="pr" disabled={sim.phase !== 'colsDone' || sim.busy} onClick={() => void actions.parRows()}>
                  Agregar paridad por filas
                </Btn>
              </div>
            </section>
          </Enter>
          <Enter i={4}>
            <ErrorPanel
              sim={sim}
              onInject={(k) => void actions.inject(k)}
              onClear={actions.clearErrors}
              onCheck={() => void actions.check()}
              onFix={() => void actions.doFix()}
            />
          </Enter>
        </div>

        <Enter i={5}>
          <Results onConnectionError={reportFailure} />
        </Enter>
      </main>
    </MotionConfig>
  )
}
