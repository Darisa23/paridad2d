"""Pruebas de las funciones puras: codificación, paridad, errores, diagnóstico y análisis."""

import itertools
import random

import pytest

from app.analysis import code_info, hamming74_decode, hamming74_encode, monte_carlo
from app.decoder import correct, diagnose, received_view
from app.encoding import (
    MAX_CHARS,
    bits_to_text,
    char_to_bits,
    encode_text,
    text_to_bits,
    validate_text,
)
from app.errors import apply_flips, error_positions, flip_cell, inject
from app.parity import build_block, column, count_ones, data_of, is_even_block, parity_report

from .conftest import TEXTS


# 1. Codificación ------------------------------------------------------------------

def test_h_is_72():
    (e,) = encode_text("H")
    assert e.code == 72
    assert "".join(map(str, e.bits)) == "1001000"
    assert char_to_bits("H") == [1, 0, 0, 1, 0, 0, 0]


@pytest.mark.parametrize("text", TEXTS + [" ~!?", "".join(chr(c) for c in range(32, 56))])
def test_round_trip(text):
    assert bits_to_text(text_to_bits(text)) == text


@pytest.mark.parametrize("bad", ["", "Señal", "canción", "tab\t", "x" * (MAX_CHARS + 1), "€"])
def test_invalid_text(bad):
    with pytest.raises(ValueError):
        validate_text(bad)


def test_25_chars_rejected_with_clear_message():
    with pytest.raises(ValueError, match="máximo es 24"):
        validate_text("A" * 25)


# 2. Paridad -------------------------------------------------------------------------

def test_every_row_and_column_even(block):
    assert is_even_block(block)
    for row in block:
        assert count_ones(row) % 2 == 0
    for c in range(8):
        assert count_ones(column(block, c)) % 2 == 0


def test_random_blocks_even_and_corner_consistent():
    rng = random.Random(1)
    for _ in range(300):
        rows = rng.randint(1, MAX_CHARS)
        data = [[rng.getrandbits(1) for _ in range(7)] for _ in range(rows)]
        rep = parity_report(data)
        assert is_even_block(rep.block)
        assert rep.corner.from_rows == rep.corner.from_cols == rep.corner.value
        assert rep.block[-1][-1] == rep.corner.value
        assert data_of(rep.block) == data
        for r in rep.rows:
            assert r.ones == sum(data[r.index]) and r.parity == r.ones % 2
        for c in rep.cols:
            assert c.ones == sum(row[c.index] for row in data) and c.parity == c.ones % 2


# 3. Inyección de errores ---------------------------------------------------------------

def _diff(a, b):
    return [(r, c) for r in range(len(a)) for c in range(len(a[0])) if a[r][c] != b[r][c]]


@pytest.mark.parametrize("seed", range(40))
def test_inject_shapes(block, seed):
    one, _ = inject(block, "one", seed)
    assert len(_diff(one, block)) == 1

    row, _ = inject(block, "row", seed)
    d = _diff(row, block)
    assert len(d) == 2 and d[0][0] == d[1][0]

    dg, _ = inject(block, "diag", seed)
    d = _diff(dg, block)
    assert len(d) == 2 and d[0][0] != d[1][0] and d[0][1] != d[1][1]

    rc, _ = inject(block, "rect", seed)
    d = _diff(rc, block)
    assert len(d) == 4 and len({r for r, _ in d}) == 2 and len({c for _, c in d}) == 2

    L, _ = inject(block, "L", seed)
    d = _diff(L, block)
    assert len(d) == 3 and len({r for r, _ in d}) == 2 and len({c for _, c in d}) == 2

    rnd, _ = inject(block, "random", seed)
    assert 1 <= len(_diff(rnd, block)) <= 4


def test_inject_same_seed_same_result(block):
    for kind in ("one", "row", "diag", "rect", "L", "random"):
        assert inject(block, kind, 123) == inject(block, kind, 123)


def test_inject_does_not_mutate_original(block):
    before = [list(r) for r in block]
    inject(block, "rect", 5)
    flip_cell(block, 0, 0)
    assert block == before


def test_flip_cell_out_of_range(block):
    with pytest.raises(ValueError):
        flip_cell(block, len(block), 0)


# 4. Diagnóstico -----------------------------------------------------------------------

def test_diagnose_clean(block):
    d = diagnose(block, block)
    assert d.case == "ok" and not d.bad_rows and not d.bad_cols and d.wrong_bits == 0


def test_one_error_correctable_in_every_cell(block):
    """Un error en cualquier celda (datos, paridad o esquina) se ubica exactamente."""
    for r in range(len(block)):
        for c in range(8):
            rec = flip_cell(block, r, c)
            d = diagnose(rec, block)
            assert d.case == "correctable"
            assert (d.suspect.row, d.suspect.col) == (r, c)
            assert d.suspect.value == rec[r][c]
            fix = correct(rec, block)
            assert fix.recovered and not fix.miscorrected and fix.matrix == block


@pytest.mark.parametrize("seed", range(40))
def test_diagnose_cases(block, seed):
    rec, _ = inject(block, "row", seed)
    d = diagnose(rec, block)
    assert d.bad_rows == [] and len(d.bad_cols) == 2 and d.case == "detected_uncorrectable"

    rec, _ = inject(block, "diag", seed)
    d = diagnose(rec, block)
    assert len(d.bad_rows) == 2 and len(d.bad_cols) == 2 and d.case == "detected_uncorrectable"

    rec, _ = inject(block, "rect", seed)
    d = diagnose(rec, block)
    assert d.bad_rows == [] and d.bad_cols == [] and d.case == "undetected" and d.wrong_bits == 4
    assert diagnose(rec).case == "ok"  # sin el original, el receptor no se entera


# 5. 3 en L: parece corregible pero corrige mal --------------------------------------------

@pytest.mark.parametrize("seed", range(60))
def test_L_miscorrects(block, seed):
    rec, _ = inject(block, "L", seed)
    assert diagnose(rec, block).case == "correctable"
    fix = correct(rec, block)
    assert fix.applied and fix.miscorrected and not fix.recovered
    assert is_even_block(fix.matrix)
    assert received_view(fix.matrix, block).status == "different"


# Vista del recibido -------------------------------------------------------------------

def test_received_view_statuses():
    blk = build_block(text_to_bits("HOLA"))
    assert received_view(blk, blk).status == "same"
    par = flip_cell(blk, 0, 7)  # bit de paridad: texto igual
    v = received_view(par, blk)
    assert v.status == "text_same" and v.wrong_cells == [(0, 7)]
    dat = flip_cell(blk, 0, 6)  # H (72) → I (73)
    v = received_view(dat, blk)
    assert v.status == "different" and v.letters[0].char == "I" and v.letters[0].changed
    ctrl = apply_flips(blk, [(0, 0), (0, 7)])  # 72 → 8: no imprimible
    v = received_view(ctrl, blk)
    assert v.letters[0].char is None and v.letters[0].code == 8


# 6. Fuerza bruta: distancia mínima 4 -----------------------------------------------------

def test_min_distance_is_4_bruteforce():
    rows, cols = 2, 3
    words = []
    for bits in itertools.product((0, 1), repeat=rows * cols):
        data = [list(bits[i * cols : (i + 1) * cols]) for i in range(rows)]
        words.append([b for row in build_block(data) for b in row])
    assert len(words) == 64
    dmin = min(sum(x != y for x, y in zip(a, b)) for a, b in itertools.combinations(words, 2))
    assert dmin == 4


# Análisis -------------------------------------------------------------------------------

def test_code_info():
    ci = code_info(4, 4)
    assert (ci.length, ci.dimension, ci.redundancy, ci.distance) == (25, 16, 9, 4)
    ci = code_info(24, 7)
    assert ci.length == 200 and abs(ci.rate - 0.84) < 1e-9
    assert abs(code_info(8, 7).rate - 56 / 72) < 1e-9


def test_hamming74_corrects_any_single_error():
    for d in itertools.product((0, 1), repeat=4):
        w = hamming74_encode(list(d))
        assert hamming74_decode(w) == list(d)
        for i in range(7):
            e = list(w)
            e[i] ^= 1
            assert hamming74_decode(e) == list(d)


def test_monte_carlo_matches_reference_values():
    res = {r.key: r for r in monte_carlo(0.01, 40_000, seed=7)}
    for r in res.values():
        assert abs(r.correct + r.detected + r.silent - 100) < 1e-9
    assert abs(res["none"].correct - 85.1) < 0.8 and res["none"].detected == 0
    assert abs(res["detect"].correct - 77.8) < 0.8 and abs(res["detect"].detected - 22.2) < 0.8
    assert abs(res["correct"].correct - 97.4) < 0.4 and abs(res["correct"].detected - 2.5) < 0.4
    assert res["correct"].silent < 0.15
    assert abs(res["hamming"].correct - 99.2) < 0.25 and res["hamming"].detected == 0


def test_monte_carlo_deterministic_and_p_zero():
    assert monte_carlo(0.05, 500, seed=3) == monte_carlo(0.05, 500, seed=3)
    assert all(r.correct == 100 for r in monte_carlo(0.0, 200, seed=1))


def test_monte_carlo_rejects_bad_p():
    with pytest.raises(ValueError):
        monte_carlo(0.7, 10)
