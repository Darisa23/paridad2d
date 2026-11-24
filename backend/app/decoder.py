"""Diagnóstico del bloque recibido, ubicación del bit sospechoso y corrección.

Casos:

* ``ok``: todas las paridades cuadran (y, si se conoce el original, no hay bits mal).
* ``correctable``: exactamente una fila y una columna malas → el cruce es el sospechoso.
* ``detected_uncorrectable``: hay filas o columnas malas pero no un cruce único.
* ``undetected``: todo cuadra pero hay bits mal (solo se sabe si se pasa el original).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .encoding import BITS_PER_CHAR, bits_to_code, code_to_char
from .parity import column, count_ones

Bit = int
Matrix = list[list[Bit]]
Case = Literal["ok", "correctable", "detected_uncorrectable", "undetected"]
Status = Literal["same", "text_same", "different"]


@dataclass(frozen=True, slots=True)
class LineCheck:
    """Revisión de una fila o columna del bloque completo."""

    index: int
    ones: int
    ok: bool


@dataclass(frozen=True, slots=True)
class Suspect:
    """Celda del cruce entre la única fila mala y la única columna mala."""

    row: int
    col: int
    value: Bit


@dataclass(frozen=True, slots=True)
class Diagnosis:
    """Resultado completo de revisar paridades."""

    rows: list[LineCheck]
    cols: list[LineCheck]
    bad_rows: list[int]
    bad_cols: list[int]
    suspect: Suspect | None
    case: Case
    wrong_bits: int | None


@dataclass(frozen=True, slots=True)
class ReceivedLetter:
    """Una letra tal como llega: carácter (``None`` si no es imprimible), código y si cambió."""

    char: str | None
    code: int
    changed: bool


@dataclass(frozen=True, slots=True)
class ReceivedView:
    """Lo que el panel Recibido necesita mostrar."""

    letters: list[ReceivedLetter]
    status: Status
    wrong_cells: list[tuple[int, int]]


@dataclass(frozen=True, slots=True)
class Correction:
    """Resultado de intentar corregir."""

    matrix: Matrix
    applied: bool
    position: tuple[int, int] | None
    recovered: bool
    miscorrected: bool


def check_rows(block: Matrix) -> list[LineCheck]:
    """Unos y paridad de cada fila del bloque completo."""
    return [LineCheck(r, count_ones(row), count_ones(row) % 2 == 0) for r, row in enumerate(block)]


def check_cols(block: Matrix) -> list[LineCheck]:
    """Unos y paridad de cada columna del bloque completo."""
    out = []
    for c in range(len(block[0])):
        ones = count_ones(column(block, c))
        out.append(LineCheck(c, ones, ones % 2 == 0))
    return out


def locate_suspect(bad_rows: list[int], bad_cols: list[int]) -> tuple[int, int] | None:
    """El cruce, si hay exactamente una fila y una columna malas."""
    if len(bad_rows) == 1 and len(bad_cols) == 1:
        return bad_rows[0], bad_cols[0]
    return None


def wrong_cells(received: Matrix, original: Matrix) -> list[tuple[int, int]]:
    """Posiciones donde lo recibido difiere del original."""
    return [
        (r, c)
        for r, (rr, ro) in enumerate(zip(received, original))
        for c, (a, b) in enumerate(zip(rr, ro))
        if a != b
    ]


def classify(bad_rows: list[int], bad_cols: list[int], wrong: int | None) -> Case:
    """Clasifica el caso a partir de filas/columnas malas y, si se conoce, los bits mal."""
    if not bad_rows and not bad_cols:
        return "undetected" if wrong else "ok"
    if locate_suspect(bad_rows, bad_cols) is not None:
        return "correctable"
    return "detected_uncorrectable"


def diagnose(received: Matrix, original: Matrix | None = None) -> Diagnosis:
    """Revisa todas las filas y columnas del bloque recibido y clasifica el caso."""
    rows = check_rows(received)
    cols = check_cols(received)
    bad_rows = [x.index for x in rows if not x.ok]
    bad_cols = [x.index for x in cols if not x.ok]
    pos = locate_suspect(bad_rows, bad_cols)
    suspect = Suspect(pos[0], pos[1], received[pos[0]][pos[1]]) if pos else None
    wrong = len(wrong_cells(received, original)) if original is not None else None
    return Diagnosis(rows, cols, bad_rows, bad_cols, suspect, classify(bad_rows, bad_cols, wrong), wrong)


def correct(received: Matrix, original: Matrix) -> Correction:
    """Si hay un cruce único, invierte ese bit. Informa si se recuperó el original o se corrigió mal.

    ``miscorrected`` es ``True`` cuando se aplicó la corrección y el bloque sigue distinto
    al original (caso típico: 3 errores en L, que al «corregir» completan un rectángulo).
    """
    d = diagnose(received)
    matrix = [list(r) for r in received]
    pos: tuple[int, int] | None = None
    if d.suspect is not None:
        pos = (d.suspect.row, d.suspect.col)
        matrix[pos[0]][pos[1]] ^= 1
    recovered = matrix == original
    return Correction(matrix, pos is not None, pos, recovered, pos is not None and not recovered)


def received_view(received: Matrix, original: Matrix) -> ReceivedView:
    """Letras recibidas (decodificadas de las filas de datos) y estado frente a lo enviado."""
    letters = []
    for rr, ro in zip(received[:-1], original[:-1]):
        code = bits_to_code(rr[:BITS_PER_CHAR])
        letters.append(ReceivedLetter(code_to_char(code), code, code != bits_to_code(ro[:BITS_PER_CHAR])))
    wrong = wrong_cells(received, original)
    if not wrong:
        status: Status = "same"
    elif not any(x.changed for x in letters):
        status = "text_same"
    else:
        status = "different"
    return ReceivedView(letters, status, wrong)
