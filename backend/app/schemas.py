"""Modelos Pydantic de entrada y salida de la API.

Las validaciones devuelven mensajes en español; ``main.py`` los convierte en
respuestas 422 con un campo ``detail`` legible.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

from .encoding import BITS_PER_CHAR, MAX_CHARS, validate_text
from .errors import ErrorKind

BLOCK_COLS = BITS_PER_CHAR + 1
MAX_BLOCKS = 100_000


def _check_text(v: str) -> str:
    return validate_text(v, MAX_CHARS)


def _check_bits(m: list[list[int]], *, cols: int, min_rows: int, max_rows: int, what: str) -> list[list[int]]:
    if not (min_rows <= len(m) <= max_rows):
        raise ValueError(f"{what} debe tener entre {min_rows} y {max_rows} filas (tiene {len(m)}).")
    for i, row in enumerate(m):
        if len(row) != cols:
            raise ValueError(f"{what}: la fila {i} tiene {len(row)} columnas; deben ser {cols}.")
        if any(b not in (0, 1) for b in row):
            raise ValueError(f"{what}: la fila {i} tiene valores distintos de 0 y 1.")
    return m


def _check_data(m: list[list[int]]) -> list[list[int]]:
    return _check_bits(m, cols=BITS_PER_CHAR, min_rows=1, max_rows=MAX_CHARS, what="La matriz de datos")


def _check_block(m: list[list[int]]) -> list[list[int]]:
    return _check_bits(m, cols=BLOCK_COLS, min_rows=2, max_rows=MAX_CHARS + 1, what="El bloque")


Text = Annotated[str, AfterValidator(_check_text)]
DataMatrix = Annotated[list[list[int]], AfterValidator(_check_data)]
Block = Annotated[list[list[int]], AfterValidator(_check_block)]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ---------- Entradas ----------

class EncodeIn(Strict):
    text: Text


class ParityIn(Strict):
    bits: DataMatrix


class InjectIn(Strict):
    original: Block
    kind: ErrorKind
    seed: int | None = None


class FlipIn(Strict):
    matrix: Block
    row: int = Field(ge=0)
    col: int = Field(ge=0)
    original: Block | None = None

    @model_validator(mode="after")
    def _inside(self) -> "FlipIn":
        if self.row >= len(self.matrix) or self.col >= BLOCK_COLS:
            raise ValueError(f"La celda ({self.row}, {self.col}) está fuera del bloque.")
        if self.original is not None and len(self.original) != len(self.matrix):
            raise ValueError("El bloque original y el recibido deben tener el mismo tamaño.")
        return self


class DiagnoseIn(Strict):
    received: Block
    original: Block | None = None

    @model_validator(mode="after")
    def _same_size(self) -> "DiagnoseIn":
        if self.original is not None and len(self.original) != len(self.received):
            raise ValueError("El bloque original y el recibido deben tener el mismo tamaño.")
        return self


class CorrectIn(Strict):
    received: Block
    original: Block

    @model_validator(mode="after")
    def _same_size(self) -> "CorrectIn":
        if len(self.original) != len(self.received):
            raise ValueError("El bloque original y el recibido deben tener el mismo tamaño.")
        return self


class MonteCarloIn(Strict):
    p: float = Field(ge=0, le=0.5)
    blocks: int = Field(default=10_000, ge=1, le=MAX_BLOCKS)
    seed: int | None = None


# ---------- Salidas ----------

class LetterOut(BaseModel):
    char: str
    code: int
    bits: list[int]


class EncodeOut(BaseModel):
    text: str
    letters: list[LetterOut]


class LineParityOut(BaseModel):
    index: int
    ones: int
    parity: int


class CornerOut(BaseModel):
    value: int
    from_rows: int
    from_cols: int


class ParityOut(BaseModel):
    block: list[list[int]]
    rows: list[LineParityOut]
    cols: list[LineParityOut]
    corner: CornerOut


class ReceivedLetterOut(BaseModel):
    char: str | None
    code: int
    changed: bool


class ViewOut(BaseModel):
    letters: list[ReceivedLetterOut]
    status: Literal["same", "text_same", "different"]
    wrong_cells: list[tuple[int, int]]


class InjectOut(BaseModel):
    matrix: list[list[int]]
    flipped: list[tuple[int, int]]
    view: ViewOut


class FlipOut(BaseModel):
    matrix: list[list[int]]
    view: ViewOut | None


class LineCheckOut(BaseModel):
    index: int
    ones: int
    ok: bool


class SuspectOut(BaseModel):
    row: int
    col: int
    value: int


class DiagnoseOut(BaseModel):
    rows: list[LineCheckOut]
    cols: list[LineCheckOut]
    bad_rows: list[int]
    bad_cols: list[int]
    suspect: SuspectOut | None
    case: Literal["ok", "correctable", "detected_uncorrectable", "undetected"]
    wrong_bits: int | None
    view: ViewOut | None


class PositionOut(BaseModel):
    row: int
    col: int


class CorrectOut(BaseModel):
    matrix: list[list[int]]
    applied: bool
    position: PositionOut | None
    recovered: bool
    miscorrected: bool
    rows: list[LineCheckOut]
    cols: list[LineCheckOut]
    view: ViewOut


class CodeInfoOut(BaseModel):
    k: int
    m: int
    length: int
    dimension: int
    redundancy: int
    rate: float
    distance: int


class SchemeOut(BaseModel):
    key: str
    label: str
    bits_sent: int
    correct: float
    detected: float
    silent: float


class MonteCarloOut(BaseModel):
    p: float
    blocks: int
    data_bits: int
    schemes: list[SchemeOut]


class HealthOut(BaseModel):
    status: Literal["ok"]
    max_chars: int
    version: str
