"""Texto → códigos ASCII → bits (y de vuelta).

Cada carácter se representa con 7 bits (b6…b0, el más significativo primero),
porque el ASCII imprimible (32–126) cabe en 7 bits.
"""

from __future__ import annotations

from dataclasses import dataclass

MAX_CHARS: int = 24
"""Único lugar donde se fija el largo máximo del mensaje."""

BITS_PER_CHAR: int = 7
PRINTABLE_MIN: int = 32
PRINTABLE_MAX: int = 126

Bit = int
Row = list[Bit]


@dataclass(frozen=True, slots=True)
class EncodedChar:
    """Una letra del mensaje con su código ASCII y sus 7 bits."""

    char: str
    code: int
    bits: tuple[Bit, ...]


def is_printable_ascii(ch: str) -> bool:
    """Indica si ``ch`` es un único carácter ASCII imprimible (32–126)."""
    return len(ch) == 1 and PRINTABLE_MIN <= ord(ch) <= PRINTABLE_MAX


def validate_text(text: str, max_chars: int = MAX_CHARS) -> str:
    """Devuelve ``text`` si es válido; si no, lanza ``ValueError`` con un mensaje en español.

    Reglas: no vacío, a lo sumo ``max_chars`` caracteres y solo ASCII imprimible.
    """
    if len(text) == 0:
        raise ValueError("Escribe al menos un carácter.")
    if len(text) > max_chars:
        raise ValueError(
            f"El mensaje tiene {len(text)} caracteres; el máximo es {max_chars}."
        )
    for ch in text:
        if not is_printable_ascii(ch):
            shown = repr(ch) if not ch.isprintable() else f"«{ch}»"
            raise ValueError(
                f"El carácter {shown} no existe en ASCII de 7 bits: la ñ y las tildes "
                "no existen en ASCII. Usa solo letras sin tilde, números, espacios y signos básicos."
            )
    return text


def code_to_bits(code: int, width: int = BITS_PER_CHAR) -> list[Bit]:
    """Convierte un entero en ``width`` bits, el más significativo primero."""
    if not 0 <= code < (1 << width):
        raise ValueError(f"El código {code} no cabe en {width} bits.")
    return [(code >> i) & 1 for i in range(width - 1, -1, -1)]


def bits_to_code(bits: list[Bit] | tuple[Bit, ...]) -> int:
    """Convierte una lista de bits (más significativo primero) en entero."""
    value = 0
    for b in bits:
        value = (value << 1) | (b & 1)
    return value


def char_to_bits(ch: str) -> list[Bit]:
    """Los 7 bits ASCII de un carácter imprimible. Ej.: ``'H'`` → ``[1,0,0,1,0,0,0]``."""
    if not is_printable_ascii(ch):
        raise ValueError(f"{ch!r} no es ASCII imprimible.")
    return code_to_bits(ord(ch))


def code_to_char(code: int) -> str | None:
    """El carácter de un código si es imprimible; ``None`` si no lo es."""
    return chr(code) if PRINTABLE_MIN <= code <= PRINTABLE_MAX else None


def encode_text(text: str, max_chars: int = MAX_CHARS) -> list[EncodedChar]:
    """Valida el texto y devuelve, por letra, carácter, código y bits."""
    validate_text(text, max_chars)
    return [EncodedChar(ch, ord(ch), tuple(char_to_bits(ch))) for ch in text]


def text_to_bits(text: str, max_chars: int = MAX_CHARS) -> list[Row]:
    """Matriz de datos: una fila de 7 bits por letra."""
    return [list(e.bits) for e in encode_text(text, max_chars)]


def bits_to_text(rows: list[Row], unknown: str = "?") -> str:
    """Decodifica filas de 7 bits en texto; los códigos no imprimibles se muestran como ``unknown``."""
    out = []
    for row in rows:
        ch = code_to_char(bits_to_code(row[:BITS_PER_CHAR]))
        out.append(ch if ch is not None else unknown)
    return "".join(out)
