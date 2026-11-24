/**
 * Cliente único de la API: timeout, cancelación y errores legibles.
 * El front no calcula paridades ni diagnósticos: todo sale de aquí.
 */
import type {
  CorrectRes,
  DiagnoseRes,
  EncodeRes,
  ErrorKind,
  FlipRes,
  HealthRes,
  InjectRes,
  Matrix,
  MonteCarloRes,
  ParityRes,
  Bit,
} from './types'

const BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '')
const TIMEOUT_MS = 12_000

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'validation' | 'aborted'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
  /** ¿Es un problema de conexión (y no de lo que escribió el usuario)? */
  get isConnection(): boolean {
    return this.kind === 'network' || this.kind === 'timeout' || this.kind === 'http'
  }
}

interface Opts {
  signal?: AbortSignal
  timeoutMs?: number
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, opts: Opts = {}): Promise<T> {
  const ctrl = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    ctrl.abort()
  }, opts.timeoutMs ?? TIMEOUT_MS)
  const onAbort = () => ctrl.abort()
  opts.signal?.addEventListener('abort', onAbort, { once: true })
  if (opts.signal?.aborted) ctrl.abort()

  try {
    let res: Response
    try {
      res = await fetch(BASE + path, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      })
    } catch {
      if (timedOut) throw new ApiError('timeout', 'El servidor tardó demasiado en responder.')
      if (opts.signal?.aborted) throw new ApiError('aborted', 'Petición cancelada.')
      throw new ApiError('network', 'No se pudo conectar con el servidor de cálculo.')
    }
    let data: unknown = null
    try {
      data = await res.json()
    } catch {
      /* respuesta sin JSON */
    }
    if (!res.ok) {
      const detail =
        data && typeof data === 'object' && typeof (data as { detail?: unknown }).detail === 'string'
          ? (data as { detail: string }).detail
          : `El servidor respondió con un error (${res.status}).`
      if (res.status === 422 || res.status === 400) throw new ApiError('validation', detail, res.status)
      throw new ApiError('http', detail, res.status)
    }
    if (data === null) throw new ApiError('http', 'Respuesta vacía del servidor.', res.status)
    return data as T
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onAbort)
  }
}

export const api = {
  health: (o?: Opts) => request<HealthRes>('GET', '/health', undefined, { timeoutMs: 8000, ...o }),
  encode: (text: string, o?: Opts) => request<EncodeRes>('POST', '/encode', { text }, o),
  parity: (bits: Bit[][], o?: Opts) => request<ParityRes>('POST', '/parity', { bits }, o),
  inject: (original: Matrix, kind: ErrorKind, seed: number, o?: Opts) =>
    request<InjectRes>('POST', '/inject', { original, kind, seed }, o),
  flip: (matrix: Matrix, row: number, col: number, original: Matrix, o?: Opts) =>
    request<FlipRes>('POST', '/flip', { matrix, row, col, original }, o),
  diagnose: (received: Matrix, original: Matrix, o?: Opts) =>
    request<DiagnoseRes>('POST', '/diagnose', { received, original }, o),
  correct: (received: Matrix, original: Matrix, o?: Opts) =>
    request<CorrectRes>('POST', '/correct', { received, original }, o),
  montecarlo: (p: number, blocks: number, seed: number, o?: Opts) =>
    request<MonteCarloRes>('POST', '/montecarlo', { p, blocks, seed }, { timeoutMs: 30_000, ...o }),
}

export const randomSeed = () => Math.floor(Math.random() * 2 ** 31)
