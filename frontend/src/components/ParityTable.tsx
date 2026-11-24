import { AnimatePresence, motion } from 'framer-motion'
import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { show, type Sim } from '../useSimulator'
import { Cell } from './Cell'
import { centerOf } from './reveal'

interface Props {
  sim: Sim
  wrapRef: RefObject<HTMLDivElement | null>
  onFlip: (r: number, c: number) => void
}

interface Geo {
  row: { left: number; top: number; width: number; height: number }
  col: { left: number; top: number; width: number; height: number }
  cell: { left: number; top: number; size: number }
}

const COLS = 8
const counterOrigin = () => centerOf('counter-chip')

export function ParityTable({ sim, wrapRef, onFlip }: Props) {
  const n = sim.letters.length
  const gridRef = useRef<HTMLDivElement>(null)
  const [focus, setFocus] = useState<[number, number]>([0, 0])
  const [geo, setGeo] = useState<Geo | null>(null)
  const clickable = sim.phase === 'ready' && !sim.busy

  const wrong = useMemo(() => new Set((sim.view?.wrong_cells ?? []).map(([r, c]) => `${r},${c}`)), [sim.view])

  // Geometría de las franjas del diagnóstico (fila y columna del sospechoso).
  const measure = useCallback(() => {
    if (!sim.suspect) return setGeo(null)
    const [sr, sc] = sim.suspect
    const el = (r: number, c: number) => document.getElementById(`c${r}_${c}`)
    const a = el(sr, 0)
    const b = el(sr, COLS - 1)
    const top = el(0, sc)
    const bot = el(n, sc)
    const s = el(sr, sc)
    if (!a || !b || !top || !bot || !s) return setGeo(null)
    const pad = 4
    setGeo({
      row: { left: a.offsetLeft - pad, top: a.offsetTop - pad, width: b.offsetLeft + b.offsetWidth - a.offsetLeft + 2 * pad, height: a.offsetHeight + 2 * pad },
      col: { left: top.offsetLeft - pad, top: top.offsetTop - pad, width: top.offsetWidth + 2 * pad, height: bot.offsetTop + bot.offsetHeight - top.offsetTop + 2 * pad },
      cell: { left: s.offsetLeft, top: s.offsetTop, size: s.offsetWidth },
    })
  }, [sim.suspect, n])

  useLayoutEffect(() => {
    measure()
    if (!sim.suspect || !gridRef.current) return
    const ro = new ResizeObserver(measure)
    ro.observe(gridRef.current)
    return () => ro.disconnect()
  }, [measure, sim.suspect])

  const onKey = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, r: number, c: number) => {
      const d: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
      const m = d[e.key]
      if (!m) return
      e.preventDefault()
      const nr = Math.max(0, Math.min(n, r + m[0]))
      const nc = Math.max(0, Math.min(COLS - 1, c + m[1]))
      setFocus([nr, nc])
      document.getElementById(`c${nr}_${nc}`)?.focus()
    },
    [n],
  )
  const onFocusCell = useCallback((r: number, c: number) => setFocus([r, c]), [])

  if (n === 0) return <div className="scroll empty-table" ref={wrapRef} />

  const inHl = (r: number, c: number) => !!sim.hl && r >= sim.hl.r0 && r < sim.hl.r1 && c >= sim.hl.c0 && c < sim.hl.c1
  const rowLabel = (r: number) => (r < n ? `Letra ${sim.letters[r].char === ' ' ? 'espacio' : sim.letters[r].char}` : 'Paridad de columnas')
  const colLabel = (c: number) => (c < 7 ? `b${6 - c}` : 'paridad de fila')
  const markCls = (m: 'ok' | 'bad' | null) => (m === 'ok' ? ' gm' : m === 'bad' ? ' bm' : '')

  return (
    <div className={`scroll${clickable ? ' on-clk' : ''}`} ref={wrapRef}>
      <div className="g" id="g" ref={gridRef} role="group" aria-label="Bloque de bits: una fila por letra, 7 bits ASCII más paridad. Usa las flechas para moverte y Enter para voltear un bit.">
        <i className="hd corner-hd" />
        {Array.from({ length: COLS }, (_, c) => (
          <b
            key={`h${c}`}
            className={`hd${c === 7 && !sim.parHeader ? ' ghost' : ''}${markCls(sim.colMarks[c] ?? null)}`}
            id={`h${c}`}
          >
            {c < 7 ? `b${6 - c}` : 'Par.'}
          </b>
        ))}
        {Array.from({ length: n + 1 }, (_, r) => (
          <Fragment key={r}>
            <b className={`lb${sim.labelShown[r] ? '' : ' ghost'}${markCls(sim.rowMarks[r] ?? null)}`} id={`l${r}`}>
              {r < n ? (
                <>
                  <span>{show(sim.letters[r].char)}</span>
                  {sim.letters[r].code}
                </>
              ) : (
                'Par. col.'
              )}
            </b>
            {Array.from({ length: COLS }, (_, c) => {
              const value = sim.received[r]?.[c] ?? 0
              const isPar = r === n || c === 7
              const corner = r === n && c === 7
              const fixed = sim.fixed && sim.fixed.pos[0] === r && sim.fixed.pos[1] === c ? sim.fixed.key : null
              const label = corner
                ? `Esquina (paridad de las paridades): ${value}`
                : `${rowLabel(r)}, ${colLabel(c)}: ${value}${wrong.has(`${r},${c}`) ? ' (invertido)' : ''}`
              return (
                <Cell
                  key={c}
                  r={r}
                  c={c}
                  value={value}
                  shown={!!sim.cellShown[r]?.[c]}
                  parity={isPar}
                  hl={inHl(r, c)}
                  band={!!sim.suspect && (sim.suspect[0] === r || sim.suspect[1] === c)}
                  sus={!!sim.suspect && sim.suspect[0] === r && sim.suspect[1] === c}
                  wrong={wrong.has(`${r},${c}`)}
                  fixedKey={fixed}
                  clickable={clickable}
                  focusable={focus[0] === r && focus[1] === c}
                  label={label}
                  origin={isPar && !corner ? counterOrigin : undefined}
                  onFlip={onFlip}
                  onKey={onKey}
                  onFocusCell={onFocusCell}
                />
              )
            })}
          </Fragment>
        ))}

        <AnimatePresence>
          {geo && (
            <motion.div key="bands" className="bands" aria-hidden="true" exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <motion.div
                className="strip"
                style={{ ...geo.row, originX: 0 }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
              <motion.div
                className="strip"
                style={{ ...geo.col, originY: 0 }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.5, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
              />
              <motion.div
                className="reticle"
                style={{
                  left: geo.cell.left + geo.cell.size / 2 - geo.cell.size * 0.85,
                  top: geo.cell.top + geo.cell.size / 2 - geo.cell.size * 0.85,
                  width: geo.cell.size * 1.7,
                  height: geo.cell.size * 1.7,
                }}
                initial={{ scale: 2.4, opacity: 0, rotate: -45 }}
                animate={{ scale: [2.4, 1, 1.12, 1], opacity: 1, rotate: 0 }}
                transition={{ duration: 1.1, delay: 0.8, times: [0, 0.55, 0.8, 1] }}
              >
                <span className="pulse" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
