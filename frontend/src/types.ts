/** Tipos de las respuestas de la API (espejo de backend/app/schemas.py). */

export type Bit = 0 | 1
export type Matrix = Bit[][]
export type Pos = [number, number]

export interface Letter {
  char: string
  code: number
  bits: Bit[]
}
export interface EncodeRes {
  text: string
  letters: Letter[]
}

export interface LineParity {
  index: number
  ones: number
  parity: Bit
}
export interface ParityRes {
  block: Matrix
  rows: LineParity[]
  cols: LineParity[]
  corner: { value: Bit; from_rows: Bit; from_cols: Bit }
}

export interface RecvLetter {
  char: string | null
  code: number
  changed: boolean
}
export type RecvStatus = 'same' | 'text_same' | 'different'
export interface View {
  letters: RecvLetter[]
  status: RecvStatus
  wrong_cells: Pos[]
}

export type ErrorKind = 'one' | 'row' | 'diag' | 'rect' | 'L' | 'random'

export interface InjectRes {
  matrix: Matrix
  flipped: Pos[]
  view: View
}
export interface FlipRes {
  matrix: Matrix
  view: View | null
}

export interface LineCheck {
  index: number
  ones: number
  ok: boolean
}
export type Case = 'ok' | 'correctable' | 'detected_uncorrectable' | 'undetected'
export interface DiagnoseRes {
  rows: LineCheck[]
  cols: LineCheck[]
  bad_rows: number[]
  bad_cols: number[]
  suspect: { row: number; col: number; value: Bit } | null
  case: Case
  wrong_bits: number | null
  view: View | null
}

export interface CorrectRes {
  matrix: Matrix
  applied: boolean
  position: { row: number; col: number } | null
  recovered: boolean
  miscorrected: boolean
  rows: LineCheck[]
  cols: LineCheck[]
  view: View
}

export interface Scheme {
  key: 'none' | 'detect' | 'correct' | 'hamming'
  label: string
  bits_sent: number
  correct: number
  detected: number
  silent: number
}
export interface MonteCarloRes {
  p: number
  blocks: number
  data_bits: number
  schemes: Scheme[]
}

export interface HealthRes {
  status: 'ok'
  max_chars: number
  version: string
}
