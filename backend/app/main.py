"""Rutas FastAPI. Sin estado: el front manda las matrices en cada petición."""

from __future__ import annotations

import os
from dataclasses import asdict

from fastapi import APIRouter, FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import analysis, decoder, encoding, errors, parity
from .schemas import (
    CodeInfoOut,
    CorrectIn,
    CorrectOut,
    DiagnoseIn,
    DiagnoseOut,
    EncodeIn,
    EncodeOut,
    FlipIn,
    FlipOut,
    HealthOut,
    InjectIn,
    InjectOut,
    MonteCarloIn,
    MonteCarloOut,
    ParityIn,
    ParityOut,
)

VERSION = "1.0.0"

app = FastAPI(title="Simulador de paridad bidimensional", version=VERSION)

_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


_TYPE_MSG = {
    "missing": "falta este campo",
    "string_type": "debe ser texto",
    "int_type": "debe ser un número entero",
    "int_parsing": "debe ser un número entero",
    "int_from_float": "debe ser un número entero",
    "float_type": "debe ser un número",
    "float_parsing": "debe ser un número",
    "list_type": "debe ser una lista",
    "bool_type": "debe ser verdadero o falso",
    "extra_forbidden": "campo no permitido",
    "model_attributes_type": "debe ser un objeto JSON",
    "dict_type": "debe ser un objeto JSON",
}


def to_spanish(err: dict) -> str:
    """Convierte un error de Pydantic en un mensaje claro en español."""
    kind = str(err.get("type", ""))
    ctx = err.get("ctx") or {}
    loc = ".".join(str(x) for x in err.get("loc", ()) if x not in ("body", "query"))
    where = f"«{loc}»: " if loc else ""
    if kind == "json_invalid":
        return "El cuerpo de la petición no es un JSON válido."
    if kind == "value_error":
        return str(err.get("msg", "")).removeprefix("Value error, ")
    if kind == "literal_error":
        return f"{where}debe ser uno de {ctx.get('expected', 'los valores permitidos')}"
    if kind == "greater_than_equal":
        return f"{where}debe ser mayor o igual que {ctx.get('ge')}"
    if kind == "less_than_equal":
        return f"{where}debe ser menor o igual que {ctx.get('le')}"
    return f"{where}{_TYPE_MSG.get(kind, 'valor inválido')}"


@app.exception_handler(RequestValidationError)
async def _validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    msgs = [to_spanish(e) for e in exc.errors()] or ["Petición inválida."]
    detail = msgs[0][0].upper() + msgs[0][1:]
    if not detail.endswith("."):
        detail += "."
    return JSONResponse(status_code=422, content={"detail": detail, "errors": msgs})


@app.exception_handler(Exception)
async def _unexpected_handler(_: Request, exc: Exception) -> JSONResponse:  # pragma: no cover
    return JSONResponse(status_code=500, content={"detail": "Error interno del servidor."})


api = APIRouter(prefix="/api")


def _view(received: list[list[int]], original: list[list[int]]) -> dict:
    return asdict(decoder.received_view(received, original))


def _require_valid_original(original: list[list[int]]) -> None:
    if not parity.is_even_block(original):
        raise RequestValidationError([{"type": "value_error", "loc": ("body", "original"),
                                       "msg": "El bloque original no tiene paridad par en todas sus filas y columnas."}])


@api.get("/health", response_model=HealthOut)
def health() -> HealthOut:
    """Estado del servicio y largo máximo del mensaje."""
    return HealthOut(status="ok", max_chars=encoding.MAX_CHARS, version=VERSION)


@api.post("/encode", response_model=EncodeOut)
def encode(body: EncodeIn) -> EncodeOut:
    """Texto → por letra: carácter, código y 7 bits."""
    letters = encoding.encode_text(body.text)
    return EncodeOut(text=body.text, letters=[{"char": e.char, "code": e.code, "bits": list(e.bits)} for e in letters])


@api.post("/parity", response_model=ParityOut)
def parity_route(body: ParityIn) -> ParityOut:
    """Paridades de columna y de fila con el conteo de unos, esquina y bloque completo."""
    return ParityOut.model_validate(asdict(parity.parity_report(body.bits)))


@api.post("/inject", response_model=InjectOut)
def inject(body: InjectIn) -> InjectOut:
    """Parte del bloque limpio y le aplica el tipo de error pedido."""
    _require_valid_original(body.original)
    matrix, flipped = errors.inject(body.original, body.kind, body.seed)
    return InjectOut(matrix=matrix, flipped=flipped, view=_view(matrix, body.original))


@api.post("/flip", response_model=FlipOut)
def flip(body: FlipIn) -> FlipOut:
    """Invierte una celda del bloque recibido."""
    matrix = errors.flip_cell(body.matrix, body.row, body.col)
    return FlipOut(matrix=matrix, view=_view(matrix, body.original) if body.original else None)


@api.post("/diagnose", response_model=DiagnoseOut)
def diagnose(body: DiagnoseIn) -> DiagnoseOut:
    """Revisa filas y columnas, ubica el sospechoso y clasifica el caso."""
    d = decoder.diagnose(body.received, body.original)
    out = asdict(d)
    out["view"] = _view(body.received, body.original) if body.original else None
    return DiagnoseOut.model_validate(out)


@api.post("/correct", response_model=CorrectOut)
def correct(body: CorrectIn) -> CorrectOut:
    """Invierte el bit del cruce (si lo hay) e informa si se recuperó o se corrigió mal."""
    _require_valid_original(body.original)
    c = decoder.correct(body.received, body.original)
    return CorrectOut(
        matrix=c.matrix,
        applied=c.applied,
        position={"row": c.position[0], "col": c.position[1]} if c.position else None,
        recovered=c.recovered,
        miscorrected=c.miscorrected,
        rows=[asdict(x) for x in decoder.check_rows(c.matrix)],
        cols=[asdict(x) for x in decoder.check_cols(c.matrix)],
        view=_view(c.matrix, body.original),
    )


@api.get("/code-info", response_model=CodeInfoOut)
def code_info(k: int = Query(4, ge=1, le=1000), m: int = Query(4, ge=1, le=1000)) -> CodeInfoOut:
    """Parámetros del código producto con k×m datos."""
    return CodeInfoOut.model_validate(asdict(analysis.code_info(k, m)))


@api.post("/montecarlo", response_model=MonteCarloOut)
def montecarlo(body: MonteCarloIn) -> MonteCarloOut:
    """Simulación sobre 16 bits de datos: sin código, producto (detectar/corregir) y Hamming (7,4)×4."""
    res = analysis.monte_carlo(body.p, body.blocks, body.seed)
    return MonteCarloOut(p=body.p, blocks=body.blocks, data_bits=analysis.MC_DATA_BITS, schemes=[asdict(r) for r in res])


app.include_router(api)
