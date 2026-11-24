/**
 * Estado y secuencias de la demo. Replica el flujo del prototipo paso a paso;
 * los datos (bits, paridades, diagnóstico, corrección) vienen siempre de la API.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, ApiError, randomSeed } from './api'
import { Cancelled, fz, prefersReducedMotion, Runner } from './anim'
import type { Bit, ErrorKind, Letter, Matrix, ParityRes, Pos, View } from './types'

export type Phase = 'empty' | 'converting' | 'converted' | 'cols' | 'colsDone' | 'rows' | 'ready'
export type Mark = 'ok' | 'bad' | null
export interface Rect {
  r0: number
  r1: number
  c0: number
  c1: number
}
export interface Verdict {
  tone: 'ok' | 'warn' | 'bad'
  title: string
  body: ReactNode
  fix?: boolean
}
export interface Counter {
  key: string
  ones: number
  parity: Bit
}
export type Conn = 'checking' | 'ok' | 'down'
export interface Failure {
  message: string
  retry?: () => void
}

export interface Sim {
  runId: number
  phase: Phase
  text: string
  letters: Letter[]
  parity: ParityRes | null
  original: Matrix
  received: Matrix
  view: View | null
  sentShown: boolean[]
  pick: number | null
  labelShown: boolean[]
  cellShown: boolean[][]
  parHeader: boolean
  hl: Rect | null
  counter: Counter | null
  rowMarks: Mark[]
  colMarks: Mark[]
  suspect: Pos | null
  fixed: { pos: Pos; key: number } | null
  say: ReactNode
  nar: ReactNode
  verdict: Verdict | null
  busy: boolean
  dim: boolean
  shake: number
  wrongPulse: number
}

const COLS = 8

const initial = (maxChars: number): Sim => ({
  runId: 0,
  phase: 'empty',
  text: '',
  letters: [],
  parity: null,
  original: [],
  received: [],
  view: null,
  sentShown: [],
  pick: null,
  labelShown: [],
  cellShown: [],
  parHeader: false,
  hl: null,
  counter: null,
  rowMarks: [],
  colMarks: [],
  suspect: null,
  fixed: null,
  say: (
    <>
      Escribe un registro (máx. {maxChars} caracteres) y toca «Convertir a ASCII».
    </>
  ),
  nar: '',
  verdict: null,
  busy: false,
  dim: true,
  shake: 0,
  wrongPulse: 0,
})

/** Muestra el espacio como ␣ (solo presentación). */
export const show = (c: string | null) => (c === null ? '?' : c === ' ' ? '␣' : c)
const uno = (n: number) => (n === 1 ? 'uno' : 'unos')

/** Vista del recibido cuando todavía no hay errores: es copia de lo enviado (sin cálculo). */
const sentView = (letters: Letter[]): View => ({
  letters: letters.map((l) => ({ char: l.char, code: l.code, changed: false })),
  status: 'same',
  wrong_cells: [],
})

const clearMarks = (s: Sim): Partial<Sim> => ({
  rowMarks: s.rowMarks.map(() => null),
  colMarks: s.colMarks.map(() => null),
  suspect: null,
  fixed: null,
  hl: null,
  verdict: null,
  nar: '',
})

export function useSimulator() {
  const [maxChars, setMaxChars] = useState(24)
  const [conn, setConn] = useState<Conn>('checking')
  const [failure, setFailure] = useState<Failure | null>(null)
  const [inputError, setInputError] = useState<string | null>(null)
  const [sim, setSim] = useState<Sim>(() => initial(24))
  const ref = useRef(sim)
  const runner = useMemo(() => new Runner(), [])
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const pendingRef = useRef(false)

  const patch = useCallback((p: Partial<Sim> | ((s: Sim) => Partial<Sim>)) => {
    const next = { ...ref.current, ...(typeof p === 'function' ? p(ref.current) : p) }
    ref.current = next
    setSim(next)
  }, [])

  // ---------- Conexión ----------
  const checkHealth = useCallback(async () => {
    setConn('checking')
    try {
      const h = await api.health()
      setConn('ok')
      setMaxChars(h.max_chars)
      if (ref.current.phase === 'empty') patch({ say: initial(h.max_chars).say })
      return true
    } catch {
      setConn('down')
      return false
    }
  }, [patch])

  useEffect(() => {
    void checkHealth()
    const on = () => void checkHealth()
    window.addEventListener('online', on)
    return () => window.removeEventListener('online', on)
  }, [checkHealth])

  const handleError = useCallback(
    (e: unknown, retry?: () => void) => {
      if (e instanceof Cancelled) return
      if (e instanceof ApiError && e.kind === 'aborted') return
      patch({ busy: false })
      if (e instanceof ApiError && e.isConnection) {
        setConn('down')
        setFailure({ message: e.message, retry })
        return
      }
      setFailure({ message: e instanceof Error ? e.message : 'Ocurrió un error inesperado.', retry })
    },
    [patch],
  )

  const ok = useCallback(() => {
    setConn('ok')
    setFailure(null)
  }, [])

  const retry = useCallback(async () => {
    const f = failure
    setFailure(null)
    const alive = await checkHealth()
    if (alive) f?.retry?.()
    else setFailure(f ?? { message: 'No se pudo conectar con el servidor de cálculo.' })
  }, [failure, checkHealth])

  // ---------- Utilidades de animación ----------
  const follow = useCallback(
    (r: number) => {
      const w = wrapRef.current
      const e = document.getElementById(`l${r}`)
      if (!w || !e) return
      const top = w.scrollTop + e.getBoundingClientRect().top - w.getBoundingClientRect().top - 110
      w.scrollTo({ top, behavior: runner.isSkipping || prefersReducedMotion() ? 'auto' : 'smooth' })
    },
    [runner],
  )

  const setCell = (r: number, c: number) =>
    patch((s) => ({ cellShown: s.cellShown.map((row, i) => (i === r ? row.map((v, j) => (j === c ? true : v)) : row)) }))
  const setAt = <T,>(arr: T[], i: number, v: T) => arr.map((x, j) => (j === i ? v : x))

  const rname = (r: number): ReactNode => {
    const s = ref.current
    return r < s.letters.length ? (
      <>
        de la <b>{show(s.letters[r].char)}</b>
      </>
    ) : (
      <>
        de <b>paridad de columnas</b>
      </>
    )
  }
  const cname = (c: number): ReactNode =>
    c < 7 ? (
      <b>b{6 - c}</b>
    ) : (
      <>
        de <b>paridad de filas</b>
      </>
    )

  // ---------- Convertir ----------
  const convert = useCallback(
    async (rawText: string) => {
      const my = runner.begin()
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const wasBusy = ref.current.busy
      patch({ busy: true })
      setInputError(null)
      setFailure(null)

      let enc, par
      try {
        enc = await api.encode(rawText, { signal: ctrl.signal })
        par = await api.parity(
          enc.letters.map((l) => l.bits),
          { signal: ctrl.signal },
        )
        runner.check(my)
        ok()
      } catch (e) {
        if (e instanceof ApiError && e.kind === 'validation') {
          setConn('ok')
          setInputError(e.message)
          patch(wasBusy ? { ...initial(maxChars), say: e.message, runId: ref.current.runId + 1 } : { busy: false })
          return
        }
        if (wasBusy) patch({ ...initial(maxChars), runId: ref.current.runId + 1 })
        handleError(e, () => void convert(rawText))
        return
      }

      const n = enc.letters.length
      patch({
        ...initial(maxChars),
        runId: ref.current.runId + 1,
        phase: 'converting',
        busy: true,
        text: enc.text,
        letters: enc.letters,
        parity: par,
        original: par.block,
        received: par.block.map((r) => [...r]),
        view: sentView(enc.letters),
        sentShown: Array(n).fill(false),
        labelShown: Array(n + 1).fill(false),
        cellShown: Array.from({ length: n + 1 }, () => Array(COLS).fill(false)),
        rowMarks: Array(n + 1).fill(null),
        colMarks: Array(COLS).fill(null),
        say: '',
      })
      wrapRef.current?.scrollTo({ top: 0 })

      try {
        for (let r = 0; r < n; r++) {
          runner.check(my)
          const L = enc.letters[r]
          patch((s) => ({ sentShown: setAt(s.sentShown, r, true), pick: r }))
          patch({
            say: (
              <>
                Agarro la <b>{show(L.char)}</b>: en ASCII vale <b>{L.code}</b>, que en binario (7 bits) es{' '}
                <b>{L.bits.join('')}</b>.
              </>
            ),
          })
          follow(r)
          await runner.sleep(my, 700 * fz(r))
          patch((s) => ({ labelShown: setAt(s.labelShown, r, true) }))
          for (let c = 0; c < 7; c++) {
            runner.check(my)
            setCell(r, c)
            await runner.sleep(my, 90 * fz(r))
          }
          patch({ pick: null })
          await runner.sleep(my, 250 * fz(r))
        }
        patch({
          phase: 'converted',
          busy: false,
          say: 'Cada letra quedó como una fila de 7 bits. Ahora agrega la paridad por columnas.',
        })
      } catch (e) {
        handleError(e)
      }
    },
    [runner, patch, follow, handleError, ok, maxChars],
  )

  // ---------- Paridad por columnas ----------
  const parCols = useCallback(async () => {
    const s0 = ref.current
    if (s0.phase !== 'converted' || s0.busy || !s0.parity) return
    const my = runner.resume()
    const n = s0.letters.length
    const par = s0.parity
    patch((s) => ({ phase: 'cols', busy: true, labelShown: setAt(s.labelShown, n, true) }))
    follow(n)
    try {
      for (let c = 0; c < 7; c++) {
        runner.check(my)
        const { ones, parity } = par.cols[c]
        patch({
          hl: { r0: 0, r1: n, c0: c, c1: c + 1 },
          counter: { key: `c${c}`, ones, parity },
          say: (
            <>
              Columna <b>b{6 - c}</b>: tiene {ones} {uno(ones)}, así que la paridad es <b>{parity}</b> (para que el
              total sea par).
            </>
          ),
        })
        await runner.sleep(my, 700)
        setCell(n, c)
        await runner.sleep(my, 300)
        patch({ hl: null })
      }
      patch({ phase: 'colsDone', busy: false, counter: null, say: 'Paridad por columnas lista. Ahora la de las filas.' })
    } catch (e) {
      handleError(e)
    }
  }, [runner, patch, follow, handleError])

  // ---------- Paridad por filas ----------
  const parRows = useCallback(async () => {
    const s0 = ref.current
    if (s0.phase !== 'colsDone' || s0.busy || !s0.parity) return
    const my = runner.resume()
    const n = s0.letters.length
    const par = s0.parity
    patch({ phase: 'rows', busy: true, parHeader: true })
    try {
      for (let r = 0; r < n; r++) {
        runner.check(my)
        const { ones, parity } = par.rows[r]
        patch({
          hl: { r0: r, r1: r + 1, c0: 0, c1: 7 },
          counter: { key: `r${r}`, ones, parity },
          say: (
            <>
              Letra <b>{show(s0.letters[r].char)}</b>: tiene {ones} {uno(ones)}, así que su paridad es <b>{parity}</b>.
            </>
          ),
        })
        follow(r)
        await runner.sleep(my, 700 * fz(r))
        setCell(r, 7)
        await runner.sleep(my, 300 * fz(r))
        patch({ hl: null })
      }
      patch({
        counter: null,
        say: 'La esquina es la paridad de las paridades: sale igual contándola por fila o por columna.',
      })
      await runner.sleep(my, 600)
      setCell(n, 7)
      await runner.sleep(my, 500)
      patch({
        phase: 'ready',
        busy: false,
        dim: false,
        say: 'Bloque completo y enviado. Ya puedes probar con errores.',
      })
    } catch (e) {
      handleError(e)
    }
  }, [runner, patch, follow, handleError])

  // ---------- Errores ----------
  const canTouch = () => ref.current.phase === 'ready' && !ref.current.busy && !pendingRef.current

  const inject = useCallback(
    async (kind: ErrorKind) => {
      if (!canTouch()) return
      pendingRef.current = true
      try {
        const s = ref.current
        const res = await api.inject(s.original, kind, randomSeed())
        ok()
        patch((st) => ({ ...clearMarks(st), received: res.matrix, view: res.view }))
      } catch (e) {
        handleError(e, () => void inject(kind))
      } finally {
        pendingRef.current = false
      }
    },
    [patch, handleError, ok],
  )

  const clearErrors = useCallback(() => {
    if (!canTouch()) return
    patch((s) => ({ ...clearMarks(s), received: s.original.map((r) => [...r]), view: sentView(s.letters) }))
  }, [patch])

  const flip = useCallback(
    async (r: number, c: number) => {
      if (!canTouch()) return
      pendingRef.current = true
      try {
        const s = ref.current
        const res = await api.flip(s.received, r, c, s.original)
        ok()
        patch((st) => ({ ...clearMarks(st), received: res.matrix, view: res.view ?? st.view }))
      } catch (e) {
        handleError(e, () => void flip(r, c))
      } finally {
        pendingRef.current = false
      }
    },
    [patch, handleError, ok],
  )

  // ---------- Revisar paridades ----------
  const check = useCallback(async () => {
    if (!canTouch()) return
    const my = runner.begin()
    const s0 = ref.current
    const n = s0.letters.length
    patch((s) => ({ ...clearMarks(s), busy: true }))
    try {
      const d = await api.diagnose(s0.received, s0.original)
      ok()
      runner.check(my)
      patch({ nar: 'Reviso fila por fila: cada una debe tener un número par de unos.' })
      await runner.sleep(my, 700)
      for (let r = 0; r <= n; r++) {
        runner.check(my)
        const { ones, ok: good } = d.rows[r]
        patch({
          hl: { r0: r, r1: r + 1, c0: 0, c1: COLS },
          nar: (
            <>
              Fila {rname(r)}: <span className="num">{ones}</span> {uno(ones)} →{' '}
              {good ? 'par ✓' : <b className="rdt">impar ✗</b>}
            </>
          ),
        })
        follow(r)
        await runner.sleep(my, 520 * fz(r))
        patch((s) => ({ hl: null, rowMarks: setAt(s.rowMarks, r, good ? 'ok' : 'bad') }))
      }
      patch({ nar: 'Ahora columna por columna.' })
      wrapRef.current?.scrollTo({ top: 0, behavior: runner.isSkipping || prefersReducedMotion() ? 'auto' : 'smooth' })
      await runner.sleep(my, 700)
      for (let c = 0; c < COLS; c++) {
        runner.check(my)
        const { ones, ok: good } = d.cols[c]
        patch({
          hl: { r0: 0, r1: n + 1, c0: c, c1: c + 1 },
          nar: (
            <>
              Columna {cname(c)}: <span className="num">{ones}</span> {uno(ones)} →{' '}
              {good ? 'par ✓' : <b className="rdt">impar ✗</b>}
            </>
          ),
        })
        await runner.sleep(my, 520)
        patch((s) => ({ hl: null, colMarks: setAt(s.colMarks, c, good ? 'ok' : 'bad') }))
      }

      if (d.case === 'ok' || d.case === 'undetected') {
        const bits = d.wrong_bits ?? 0
        patch((s) => ({
          busy: false,
          nar: '',
          shake: bits ? s.shake + 1 : s.shake,
          verdict: bits
            ? {
                tone: 'bad',
                title: 'No detecta ni corrige',
                body: `Todas las paridades cuadran (todo ✓), pero hay ${bits} bits mal. Cada fila y cada columna afectada recibió un número par de errores y se cancelaron. El receptor da el mensaje por bueno y nadie se entera.`,
              }
            : {
                tone: 'ok',
                title: 'Sin errores',
                body: 'Todas las filas y columnas tienen paridad par: el bloque llegó bien.',
              },
        }))
        return
      }

      if (d.case === 'correctable' && d.suspect) {
        const { row, col, value } = d.suspect
        follow(row)
        patch({
          suspect: [row, col],
          nar: (
            <>
              Falla la fila {rname(row)} y falla la columna {cname(col)}. El error solo puede estar en el cruce: la
              celda roja.
            </>
          ),
        })
        await runner.sleep(my, 1500)
        patch({
          nar: (
            <>
              Ese bit vale <b>{value}</b>. Si lo invierto (<b>{1 - value}</b>), esa fila y esa columna quedan con
              paridad par.
            </>
          ),
        })
        await runner.sleep(my, 1000)
        patch({
          busy: false,
          verdict: {
            tone: 'ok',
            title: 'Detecta y puede corregir',
            body: 'Con una sola fila y una sola columna malas, la celda del cruce se puede ubicar.',
            fix: true,
          },
        })
        return
      }

      const br = d.bad_rows.length
      const bc = d.bad_cols.length
      let why: string
      if (!br) why = `fallan ${bc} columnas y ninguna fila: sabe que hay error pero no en qué fila está`
      else if (!bc) why = `fallan ${br} filas y ninguna columna: sabe que hay error pero no en qué columna está`
      else why = `fallan ${br} filas y ${bc} columnas: hay varias celdas posibles y no puede elegir`
      patch({
        busy: false,
        nar: '',
        verdict: { tone: 'warn', title: 'Detecta pero no puede corregir', body: `${why}. Lo correcto es pedir que reenvíen el bloque.` },
      })
    } catch (e) {
      if (!(e instanceof Cancelled)) patch({ nar: '', hl: null })
      handleError(e, () => void check())
    }
  }, [runner, patch, follow, handleError, ok])

  // ---------- Corregir ese bit ----------
  const doFix = useCallback(async () => {
    const s0 = ref.current
    if (s0.busy || !s0.suspect || pendingRef.current) return
    const my = runner.begin()
    patch({ busy: true })
    try {
      const res = await api.correct(s0.received, s0.original)
      ok()
      runner.check(my)
      const pos: Pos = res.position ? [res.position.row, res.position.col] : s0.suspect
      patch((s) => ({
        nar: 'Invierto ese bit…',
        suspect: null,
        verdict: null,
        received: res.matrix,
        view: res.view,
        fixed: { pos, key: (s.fixed?.key ?? 0) + 1 },
      }))
      await runner.sleep(my, 1100)
      patch((s) => ({
        busy: false,
        rowMarks: res.rows.map((x) => (x.ok ? 'ok' : 'bad')),
        colMarks: res.cols.map((x) => (x.ok ? 'ok' : 'bad')),
        ...(res.recovered
          ? {
              nar: 'Ahora todas las filas y columnas quedan en par ✓ y el mensaje recibido es igual al enviado.',
              verdict: {
                tone: 'ok' as const,
                title: 'Corregido',
                body: 'El bit invertido era el dañado: el mensaje recibido quedó igual al enviado.',
              },
            }
          : {
              nar: 'Las paridades cuadran, pero mira el mensaje recibido: sigue distinto.',
              wrongPulse: s.wrongPulse + 1,
              verdict: {
                tone: 'bad' as const,
                title: 'Corrigió mal',
                body: 'Había más de un error (3 en L) pero parecía uno solo. Al «corregir» se completó un rectángulo: las paridades cuadran y el mensaje sigue distinto al enviado.',
              },
            }),
      }))
    } catch (e) {
      handleError(e, () => void doFix())
    }
  }, [runner, patch, handleError, ok])

  const skip = useCallback(() => runner.skip(), [runner])
  const setSpeed = useCallback((v: number) => runner.setSpeed(v), [runner])
  const reportFailure = useCallback((message: string, retryFn: () => void) => {
    setConn('down')
    setFailure({ message, retry: retryFn })
  }, [])

  useEffect(() => () => runner.cancel(), [runner])

  const actions = useMemo(
    () => ({ convert, parCols, parRows, inject, clearErrors, flip, check, doFix, skip, setSpeed, retry }),
    [convert, parCols, parRows, inject, clearErrors, flip, check, doFix, skip, setSpeed, retry],
  )

  return { sim, maxChars, conn, failure, inputError, setInputError, wrapRef, actions, reportFailure }
}
