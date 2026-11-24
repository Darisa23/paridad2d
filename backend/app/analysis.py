"""Parámetros del código producto y simulación Monte Carlo.

La simulación compara cuatro esquemas sobre los mismos 16 bits de datos:

* sin código (16 bits);
* producto 4×4 solo detectando (25 bits);
* producto 4×4 corrigiendo un error (25 bits), con el mismo decodificador de la demo;
* Hamming (7,4) × 4 (28 bits).

Cada bloque se clasifica como *correcto* (los datos llegan bien), *detectado*
(el receptor sabe que hay error y pide reenvío) o *silencioso* (acepta datos malos).
"""

from __future__ import annotations

import random
from dataclasses import dataclass

from .decoder import check_cols, check_rows, locate_suspect
from .parity import build_block, data_of

Bit = int

MC_ROWS: int = 4
MC_COLS: int = 4
MC_DATA_BITS: int = MC_ROWS * MC_COLS


@dataclass(frozen=True, slots=True)
class CodeInfo:
    """Parámetros de un código producto con k filas y m columnas de datos."""

    k: int
    m: int
    length: int
    dimension: int
    redundancy: int
    rate: float
    distance: int


@dataclass(frozen=True, slots=True)
class SchemeResult:
    """Resultado de un esquema en la simulación (porcentajes de 0 a 100)."""

    key: str
    label: str
    bits_sent: int
    correct: float
    detected: float
    silent: float


def code_info(k: int, m: int) -> CodeInfo:
    """Largo N=(k+1)(m+1), dimensión k·m, redundancia k+m+1, tasa y distancia mínima 4."""
    if k < 1 or m < 1:
        raise ValueError("k y m deben ser al menos 1.")
    length = (k + 1) * (m + 1)
    dimension = k * m
    return CodeInfo(k, m, length, dimension, k + m + 1, dimension / length, 4)


# --- Hamming (7,4) -------------------------------------------------------------
# Posiciones 1..7; paridades en 1, 2, 4; datos en 3, 5, 6, 7.

def hamming74_encode(d: list[Bit]) -> list[Bit]:
    """Codifica 4 bits de datos en 7 (orden de posiciones 1…7)."""
    d1, d2, d3, d4 = d
    p1 = d1 ^ d2 ^ d4
    p2 = d1 ^ d3 ^ d4
    p3 = d2 ^ d3 ^ d4
    return [p1, p2, d1, p3, d2, d3, d4]


def hamming74_decode(w: list[Bit]) -> list[Bit]:
    """Corrige hasta 1 error con el síndrome y devuelve los 4 bits de datos."""
    w = list(w)
    s = 0
    for pos in range(1, 8):
        if w[pos - 1]:
            s ^= pos
    if s:
        w[s - 1] ^= 1
    return [w[2], w[4], w[5], w[6]]


# --- Canal -----------------------------------------------------------------------

def bsc(bits: list[Bit], p: float, rng: random.Random) -> list[Bit]:
    """Canal binario simétrico: invierte cada bit con probabilidad ``p``."""
    return [b ^ (rng.random() < p) for b in bits]


def _flatten(m: list[list[Bit]]) -> list[Bit]:
    return [b for row in m for b in row]


def _reshape(bits: list[Bit], cols: int) -> list[list[Bit]]:
    return [bits[i : i + cols] for i in range(0, len(bits), cols)]


def _product_outcome(sent_data: list[list[Bit]], received: list[list[Bit]], fix: bool) -> str:
    rows, cols = check_rows(received), check_cols(received)
    bad_rows = [x.index for x in rows if not x.ok]
    bad_cols = [x.index for x in cols if not x.ok]
    if bad_rows or bad_cols:
        pos = locate_suspect(bad_rows, bad_cols) if fix else None
        if pos is None:
            return "detected"
        received = [list(r) for r in received]
        received[pos[0]][pos[1]] ^= 1
    return "correct" if data_of(received) == sent_data else "silent"


def monte_carlo(p: float, blocks: int, seed: int | None = None) -> list[SchemeResult]:
    """Simula ``blocks`` bloques de 16 bits por un canal con probabilidad de error ``p``."""
    if not 0 <= p <= 0.5:
        raise ValueError("p debe estar entre 0 y 0,5.")
    if blocks < 1:
        raise ValueError("blocks debe ser al menos 1.")
    rng = random.Random(seed)
    keys = ("none", "detect", "correct", "hamming")
    tally = {k: {"correct": 0, "detected": 0, "silent": 0} for k in keys}

    for _ in range(blocks):
        data = [rng.getrandbits(1) for _ in range(MC_DATA_BITS)]
        data_m = _reshape(data, MC_COLS)

        # Sin código
        tally["none"]["correct" if bsc(data, p, rng) == data else "silent"] += 1

        # Código producto (mismo patrón de ruido para detectar y para corregir)
        block = build_block(data_m)
        received = _reshape(bsc(_flatten(block), p, rng), MC_COLS + 1)
        tally["detect"][_product_outcome(data_m, received, fix=False)] += 1
        tally["correct"][_product_outcome(data_m, received, fix=True)] += 1

        # Hamming (7,4) × 4
        ok = True
        for i in range(0, MC_DATA_BITS, 4):
            nib = data[i : i + 4]
            if hamming74_decode(bsc(hamming74_encode(nib), p, rng)) != nib:
                ok = False
        tally["hamming"]["correct" if ok else "silent"] += 1

    meta = {
        "none": ("Sin código", MC_DATA_BITS),
        "detect": ("Producto (detectar)", (MC_ROWS + 1) * (MC_COLS + 1)),
        "correct": ("Producto (corregir)", (MC_ROWS + 1) * (MC_COLS + 1)),
        "hamming": ("Hamming (7,4) × 4", 28),
    }
    out = []
    for k in keys:
        t = tally[k]
        out.append(
            SchemeResult(
                k,
                meta[k][0],
                meta[k][1],
                100 * t["correct"] / blocks,
                100 * t["detected"] / blocks,
                100 * t["silent"] / blocks,
            )
        )
    return out
