"""Inyección de errores en un bloque y volteo de una celda.

Cada tipo de error parte del bloque limpio (no acumula errores anteriores).
Las posiciones pueden caer en cualquier celda: datos, paridad o esquina.
"""

from __future__ import annotations

import random
from typing import Literal

Bit = int
Matrix = list[list[Bit]]
Position = tuple[int, int]
ErrorKind = Literal["one", "row", "diag", "rect", "L", "random"]

ERROR_KINDS: tuple[ErrorKind, ...] = ("one", "row", "diag", "rect", "L", "random")


def copy_matrix(matrix: Matrix) -> Matrix:
    """Copia profunda de una matriz de bits."""
    return [list(row) for row in matrix]


def flip_cell(matrix: Matrix, row: int, col: int) -> Matrix:
    """Devuelve una copia de ``matrix`` con la celda (``row``, ``col``) invertida."""
    if not (0 <= row < len(matrix) and 0 <= col < len(matrix[0])):
        raise ValueError(f"La celda ({row}, {col}) está fuera del bloque.")
    out = copy_matrix(matrix)
    out[row][col] ^= 1
    return out


def apply_flips(matrix: Matrix, positions: list[Position]) -> Matrix:
    """Invierte cada posición de la lista (sobre una copia)."""
    out = copy_matrix(matrix)
    for r, c in positions:
        out[r][c] ^= 1
    return out


def _two_distinct(rng: random.Random, n: int) -> tuple[int, int]:
    a, b = rng.sample(range(n), 2)
    return a, b


def error_positions(rows: int, cols: int, kind: ErrorKind, rng: random.Random) -> list[Position]:
    """Posiciones a voltear según el tipo de error.

    * ``one``: 1 bit.
    * ``row``: 2 bits en la misma fila.
    * ``diag``: 2 bits en filas y columnas distintas.
    * ``rect``: las 4 esquinas de un rectángulo.
    * ``L``: 3 esquinas de un rectángulo.
    * ``random``: entre 1 y 4 bits distintos en cualquier lugar.
    """
    if rows < 2 or cols < 2:
        raise ValueError("El bloque debe tener al menos 2 filas y 2 columnas.")
    if kind == "one":
        return [(rng.randrange(rows), rng.randrange(cols))]
    if kind == "row":
        r = rng.randrange(rows)
        a, b = _two_distinct(rng, cols)
        return [(r, a), (r, b)]
    if kind == "diag":
        r1, r2 = _two_distinct(rng, rows)
        c1, c2 = _two_distinct(rng, cols)
        return [(r1, c1), (r2, c2)]
    if kind in ("rect", "L"):
        r1, r2 = _two_distinct(rng, rows)
        c1, c2 = _two_distinct(rng, cols)
        corners = [(r1, c1), (r1, c2), (r2, c1), (r2, c2)]
        if kind == "L":
            corners.pop(rng.randrange(4))
        return corners
    if kind == "random":
        count = rng.randint(1, 4)
        cells = rng.sample(range(rows * cols), count)
        return [divmod(i, cols) for i in cells]
    raise ValueError(f"Tipo de error desconocido: {kind!r}.")


def inject(original: Matrix, kind: ErrorKind, seed: int | None = None) -> tuple[Matrix, list[Position]]:
    """Parte del bloque limpio y le aplica el error pedido.

    Con la misma ``seed`` el resultado es siempre el mismo.
    Devuelve la matriz dañada y las posiciones volteadas.
    """
    rng = random.Random(seed)
    positions = error_positions(len(original), len(original[0]), kind, rng)
    return apply_flips(original, positions), positions
