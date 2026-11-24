import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.encoding import text_to_bits  # noqa: E402
from app.parity import build_block  # noqa: E402

TEXTS = ["H", "HOLA MUN", "PARIDAD BIDIMENSIONAL 24"]  # 1, 8 y 24 caracteres
assert [len(t) for t in TEXTS] == [1, 8, 24]


@pytest.fixture(params=TEXTS, ids=["1", "8", "24"])
def block(request):
    return build_block(text_to_bits(request.param))
