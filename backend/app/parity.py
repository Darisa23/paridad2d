"""Paridad par por columnas, por filas, esquina y bloque completo.

Convención del bloque (igual que el prototipo), con L filas de datos y m columnas:

* filas 0…L-1, columnas 0…m-1: datos;
* columna m: paridad de cada fila;
* fila L: paridad de cada columna;
* celda (L, m): esquina = paridad de las paridades.

Toda fila y toda columna del bloque completo queda con cantidad par de unos.
"""

from __future__ import annotations

from dataclasses import dataclass

Bit = int
Matrix = list[list[Bit]]


@dataclass(frozen=True, slots=True)
class LineParity:
    """Una fila o columna de datos: cuántos unos tiene y qué bit de paridad le toca."""

    index: int
    ones: int
    parity: Bit


@dataclass(frozen=True, slots=True)
class Corner:
    """La esquina calculada de las dos formas (deben coincidir)."""

    value: Bit
    from_rows: Bit
    from_cols: Bit


@dataclass(frozen=True, slots=True)
class ParityReport:
    """Todo lo necesario para narrar el cálculo de paridades."""

    block: Matrix
    rows: list[LineParity]
    cols: list[LineParity]
    corner: Corner


def count_ones(bits: list[Bit] | tuple[Bit, ...]) -> int:
    """Cantidad de unos en una secuencia de bits."""
    return sum(1 for b in bits if b)


def even_parity_bit(bits: list[Bit] | tuple[Bit, ...]) -> Bit:
    """Bit que hace par el total de unos (0 si ya es par, 1 si es impar)."""
    return count_ones(bits) % 2


def column(matrix: Matrix, c: int) -> list[Bit]:
    """La columna ``c`` de una matriz."""
    return [row[c] for row in matrix]


def column_parities(data: Matrix) -> list[Bit]:
    """Paridad par de cada columna de datos."""
    width = len(data[0])
    return [even_parity_bit(column(data, c)) for c in range(width)]


def row_parities(data: Matrix) -> list[Bit]:
    """Paridad par de cada fila de datos."""
    return [even_parity_bit(row) for row in data]


def corner_bit(col_par: list[Bit], row_par: list[Bit]) -> Corner:
    """Esquina: XOR de las paridades de columna, comprobado contra las de fila."""
    return Corner(
        value=even_parity_bit(col_par),
        from_rows=even_parity_bit(row_par),
        from_cols=even_parity_bit(col_par),
    )


def build_block(data: Matrix) -> Matrix:
    """Agrega paridad de filas (columna derecha), de columnas (fila de abajo) y esquina."""
    rp = row_parities(data)
    cp = column_parities(data)
    corner = corner_bit(cp, rp).value
    block = [list(row) + [p] for row, p in zip(data, rp)]
    block.append(list(cp) + [corner])
    return block


def is_even_block(block: Matrix) -> bool:
    """``True`` si toda fila y toda columna del bloque tiene cantidad par de unos."""
    width = len(block[0])
    return all(count_ones(r) % 2 == 0 for r in block) and all(
        count_ones(column(block, c)) % 2 == 0 for c in range(width)
    )


def data_of(block: Matrix) -> Matrix:
    """Quita la fila y la columna de paridad: deja solo los datos."""
    return [row[:-1] for row in block[:-1]]


def parity_report(data: Matrix) -> ParityReport:
    """Bloque completo más el conteo de unos de cada fila y columna de datos."""
    width = len(data[0])
    rows = [LineParity(r, count_ones(row), even_parity_bit(row)) for r, row in enumerate(data)]
    cols = []
    for c in range(width):
        col = column(data, c)
        cols.append(LineParity(c, count_ones(col), even_parity_bit(col)))
    corner = corner_bit([c.parity for c in cols], [r.parity for r in rows])
    return ParityReport(build_block(data), rows, cols, corner)
