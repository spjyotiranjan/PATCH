"""Bounded OCR word geometry; no diagram semantics or provider inference."""

import statistics
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from PIL import Image, ImageChops, ImageOps


@dataclass
class Word:
    text: str
    confidence: float
    left: int
    top: int
    width: int
    height: int


def words(data: dict[str, Any], size: tuple[int, int]) -> list[Word]:
    if len(data["text"]) > 20000:
        raise ValueError("OCR_WORD_LIMIT_EXCEEDED")
    result = []
    for i, value in enumerate(data["text"]):
        text = str(value).strip()
        if not text:
            continue
        x, y, w, h = (int(data[k][i]) for k in ("left", "top", "width", "height"))
        if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > size[0] or y + h > size[1]:
            raise ValueError("OCR_GEOMETRY_INVALID")
        result.append(Word(text, float(data["conf"][i]), x, y, w, h))
        if len(result) > 2000:
            raise ValueError("OCR_WORD_LIMIT_EXCEEDED")
    return result


def transcribe(
    image: Image.Image,
    recognize: Callable[[Image.Image, str], dict[str, Any]],
    pixel_limit: int,
) -> str:
    tokens = words(recognize(image, "--psm 6"), image.size)
    # Supplement colour-only warnings by geometry, not whole-line string dedup:
    # a second reading must not reintroduce a conflicting duplicate chart label.
    with image.convert("RGB") as rgb:
        red, green, blue = rgb.split()
        try:
            with ImageChops.difference(red, green) as difference:
                coloured = difference.getbbox() is not None
            if coloured:
                for candidate in words(recognize(red, "--psm 6"), image.size):
                    if not any(overlaps(candidate, existing) for existing in tokens):
                        tokens.append(candidate)
        finally:
            red.close()
            green.close()
            blue.close()
    # Prioritize the weakest readings, never retry an unbounded dense page.
    for token in sorted(tokens, key=lambda t: t.confidence)[:8]:
        if not 0 <= token.confidence < 60 or len(token.text) > 32:
            continue
        w, h = token.width + 24, token.height + 24
        if w * h * 4 > pixel_limit:
            continue
        box = (token.left, token.top, token.left + token.width, token.top + token.height)
        with image.crop(box) as crop, ImageOps.expand(crop, border=12, fill="white") as padded:
            first = words(recognize(padded, "--psm 7"), padded.size)
            with padded.resize((w * 2, h * 2)) as scaled:
                second = words(recognize(scaled, "--psm 7"), scaled.size)
        # Agreement does not certify truth; human review remains mandatory.
        if (
            len(first) == len(second) == 1
            and first[0].text == second[0].text
            and min(first[0].confidence, second[0].confidence) >= 80
        ):
            token.text = first[0].text
    return layout(tokens, image.width)


def overlaps(a: Word, b: Word) -> bool:
    width = max(0, min(a.left + a.width, b.left + b.width) - max(a.left, b.left))
    height = max(0, min(a.top + a.height, b.top + b.height) - max(a.top, b.top))
    return width * height >= min(a.width * a.height, b.width * b.height) * 0.5


def layout(tokens: list[Word], width: int) -> str:
    if not tokens:
        return ""
    # Preserve horizontal alignment even when values occupy different rows.
    unit = max(width / 240, statistics.median(t.width / len(t.text) for t in tokens), 1)
    rows: list[list[Word]] = []
    for token in sorted(tokens, key=lambda t: (t.top + t.height / 2, t.left)):
        if (
            rows
            and abs(token.top + token.height / 2 - (rows[-1][0].top + rows[-1][0].height / 2))
            <= min(token.height, rows[-1][0].height) * 0.5
        ):
            rows[-1].append(token)
        else:
            rows.append([token])
    lines = []
    for row in rows:
        line = ""
        for token in sorted(row, key=lambda t: t.left):
            column = round(token.left / unit)
            line += " " * max(1 if line else 0, column - len(line)) + token.text
        lines.append(line.rstrip())
    return "\n".join(lines)
