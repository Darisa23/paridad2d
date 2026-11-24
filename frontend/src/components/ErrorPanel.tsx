import { AnimatePresence, motion } from 'framer-motion'
import type { Sim } from '../useSimulator'
import type { ErrorKind } from '../types'
import { Btn } from './Btn'

interface Props {
  sim: Sim
  onInject: (k: ErrorKind) => void
  onClear: () => void
  onCheck: () => void
  onFix: () => void
}

const GROUPS: { title: string; cls: string; items: { k: ErrorKind | 'clear'; label: string }[] }[] = [
  { title: 'Detecta y corrige', cls: 'g1', items: [{ k: 'one', label: '1 error' }] },
  {
    title: 'Detecta pero no corrige',
    cls: 'g2',
    items: [
      { k: 'row', label: '2 en la misma fila' },
      { k: 'diag', label: '2 en filas y columnas distintas' },
    ],
  },
  { title: 'No detecta ni corrige', cls: 'g3', items: [{ k: 'rect', label: '4 en rectángulo' }] },
  {
    title: 'Otros',
    cls: '',
    items: [
      { k: 'L', label: '3 en L (trampa)' },
      { k: 'random', label: 'Al azar' },
      { k: 'clear', label: 'Quitar errores' },
    ],
  },
]

export function ErrorPanel({ sim, onInject, onClear, onCheck, onFix }: Props) {
  const enabled = sim.phase === 'ready' && !sim.busy
  return (
    <section className="card" id="errs" aria-labelledby="errs-h">
      <h2 id="errs-h">Probar con errores</h2>
      <p className="mu">
        En la vida real el ruido cae donde quiere. Aquí lo provocamos nosotros para ver cada caso a propósito; «Al azar» sí lo
        deja caer donde sea. También puedes tocar cualquier bit de la tabla.
      </p>
      {GROUPS.map((g) => (
        <div className={`grp ${g.cls}`} key={g.title} role="group" aria-label={g.title}>
          <b>{g.title}</b>
          {g.items.map((it) => (
            <Btn key={it.k} disabled={!enabled} onClick={() => (it.k === 'clear' ? onClear() : onInject(it.k))}>
              {it.label}
            </Btn>
          ))}
        </div>
      ))}
      <div className="row" style={{ marginTop: 6 }}>
        <Btn go disabled={!enabled} onClick={onCheck}>
          Revisar paridades
        </Btn>
      </div>
      <div id="nar" role="status" aria-live="polite">
        {sim.nar}
      </div>
      <AnimatePresence mode="wait">
        {sim.verdict && (
          <motion.div
            key={sim.verdict.title}
            id="verdict"
            className={`v-${sim.verdict.tone}`}
            role="status"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
          >
            <h3>{sim.verdict.title}</h3>
            <p>{sim.verdict.body}</p>
            {sim.verdict.fix && (
              <Btn go id="fix" disabled={sim.busy} onClick={onFix}>
                Corregir ese bit
              </Btn>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
