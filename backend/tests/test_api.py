"""Pruebas de la API con TestClient: cada ruta, flujo completo y entradas inválidas."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

from .conftest import TEXTS

client = TestClient(app, raise_server_exceptions=False)


def _block(text: str):
    enc = client.post("/api/encode", json={"text": text}).json()
    bits = [l["bits"] for l in enc["letters"]]
    return client.post("/api/parity", json={"bits": bits}).json()["block"]


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok" and r.json()["max_chars"] == 24


def test_encode_h():
    r = client.post("/api/encode", json={"text": "H"})
    assert r.status_code == 200
    assert r.json()["letters"] == [{"char": "H", "code": 72, "bits": [1, 0, 0, 1, 0, 0, 0]}]


def test_parity_counts():
    r = client.post("/api/parity", json={"bits": [[1, 0, 0, 1, 0, 0, 0], [1, 0, 0, 1, 1, 1, 1]]})
    assert r.status_code == 200
    j = r.json()
    assert j["rows"][0] == {"index": 0, "ones": 2, "parity": 0}
    assert j["rows"][1] == {"index": 1, "ones": 5, "parity": 1}
    assert j["cols"][0] == {"index": 0, "ones": 2, "parity": 0}
    assert j["corner"]["from_rows"] == j["corner"]["from_cols"] == j["corner"]["value"] == 1
    assert len(j["block"]) == 3 and all(len(r) == 8 for r in j["block"])


@pytest.mark.parametrize("text", TEXTS)
def test_full_flow_one_error(text):
    blk = _block(text)
    inj = client.post("/api/inject", json={"original": blk, "kind": "one", "seed": 4}).json()
    (r, c), = inj["flipped"]
    d = client.post("/api/diagnose", json={"received": inj["matrix"], "original": blk}).json()
    assert d["case"] == "correctable" and d["suspect"]["row"] == r and d["suspect"]["col"] == c
    assert len(d["rows"]) == len(blk) and len(d["cols"]) == 8 and d["view"] is not None
    fix = client.post("/api/correct", json={"received": inj["matrix"], "original": blk}).json()
    assert fix["recovered"] and not fix["miscorrected"] and fix["matrix"] == blk
    assert all(x["ok"] for x in fix["rows"] + fix["cols"]) and fix["view"]["status"] == "same"


def test_flow_L_miscorrected():
    blk = _block("HOLA")
    inj = client.post("/api/inject", json={"original": blk, "kind": "L", "seed": 9}).json()
    d = client.post("/api/diagnose", json={"received": inj["matrix"], "original": blk}).json()
    assert d["case"] == "correctable"
    fix = client.post("/api/correct", json={"received": inj["matrix"], "original": blk}).json()
    assert fix["miscorrected"] and not fix["recovered"] and fix["view"]["status"] == "different"


def test_rect_undetected_and_row_uncorrectable():
    blk = _block("HOLA")
    inj = client.post("/api/inject", json={"original": blk, "kind": "rect", "seed": 1}).json()
    d = client.post("/api/diagnose", json={"received": inj["matrix"], "original": blk}).json()
    assert d["case"] == "undetected" and d["wrong_bits"] == 4
    d2 = client.post("/api/diagnose", json={"received": inj["matrix"]}).json()
    assert d2["case"] == "ok" and d2["view"] is None
    inj = client.post("/api/inject", json={"original": blk, "kind": "row", "seed": 1}).json()
    d = client.post("/api/diagnose", json={"received": inj["matrix"], "original": blk}).json()
    assert d["case"] == "detected_uncorrectable" and d["bad_rows"] == [] and len(d["bad_cols"]) == 2


def test_flip():
    blk = _block("HI")
    r = client.post("/api/flip", json={"matrix": blk, "row": 0, "col": 6, "original": blk})
    assert r.status_code == 200
    j = r.json()
    assert j["matrix"][0][6] != blk[0][6]
    assert j["view"]["letters"][0] == {"char": "I", "code": 73, "changed": True}
    assert j["view"]["wrong_cells"] == [[0, 6]]


def test_code_info_and_montecarlo():
    r = client.get("/api/code-info", params={"k": 4, "m": 4}).json()
    assert r["length"] == 25 and r["dimension"] == 16 and r["redundancy"] == 9 and r["distance"] == 4
    m = client.post("/api/montecarlo", json={"p": 0.01, "blocks": 2000, "seed": 1})
    assert m.status_code == 200
    keys = [s["key"] for s in m.json()["schemes"]]
    assert keys == ["none", "detect", "correct", "hamming"] and m.json()["data_bits"] == 16


def test_24_ok_25_rejected():
    assert client.post("/api/encode", json={"text": "X" * 24}).status_code == 200
    r = client.post("/api/encode", json={"text": "X" * 25})
    assert r.status_code == 422 and "máximo es 24" in r.json()["detail"]


BAD = [
    ("/api/encode", {"text": ""}, "al menos un carácter"),
    ("/api/encode", {"text": "Señal"}, "ASCII"),
    ("/api/encode", {}, None),
    ("/api/encode", {"text": 5}, None),
    ("/api/parity", {"bits": [[1, 0, 1]]}, "columnas"),
    ("/api/parity", {"bits": [[2, 0, 0, 0, 0, 0, 0]]}, "0 y 1"),
    ("/api/parity", {"bits": []}, "filas"),
    ("/api/parity", {"bits": [[0] * 7] * 25}, "filas"),
    ("/api/inject", {"original": [[0] * 8] * 3, "kind": "boom"}, None),
    ("/api/inject", {"original": [[1] + [0] * 7] * 3, "kind": "one"}, "paridad par"),
    ("/api/flip", {"matrix": [[0] * 8] * 3, "row": 9, "col": 0}, "fuera del bloque"),
    ("/api/flip", {"matrix": [[0] * 8] * 3, "row": -1, "col": 0}, None),
    ("/api/diagnose", {"received": [[0] * 8, [0] * 7]}, "columnas"),
    ("/api/diagnose", {"received": [[0] * 8] * 3, "original": [[0] * 8] * 4}, "mismo tamaño"),
    ("/api/correct", {"received": [[0] * 8] * 3}, None),
    ("/api/montecarlo", {"p": 0.9, "blocks": 10}, None),
    ("/api/montecarlo", {"p": 0.01, "blocks": 10**7}, None),
]


@pytest.mark.parametrize("path,body,expect", BAD)
def test_invalid_inputs_give_clear_422(path, body, expect):
    r = client.post(path, json=body)
    assert r.status_code == 422, r.text
    detail = r.json()["detail"]
    assert isinstance(detail, str) and detail
    if expect:
        assert expect in detail


def test_invalid_json_and_code_info_range():
    r = client.post("/api/encode", content=b"{no json", headers={"Content-Type": "application/json"})
    assert r.status_code == 422 and isinstance(r.json()["detail"], str)
    assert client.get("/api/code-info", params={"k": 0}).status_code == 422


def test_vercel_entrypoint_imports():
    import importlib.util
    from pathlib import Path

    path = Path(__file__).resolve().parents[2] / "api" / "index.py"
    spec = importlib.util.spec_from_file_location("vercel_index", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert TestClient(mod.app).get("/api/health").status_code == 200
