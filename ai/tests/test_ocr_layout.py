from typing import Any

import pytest
from langchain_core.documents import Document
from PIL import Image
from test_backend_workflows import index_request

from patch_ai.adapters.ocr_layout import Word, layout, transcribe, words
from patch_ai.config import Settings
from patch_ai.services.ingestion import source_chunks


def data(text: str, confidence: int = 95) -> dict[str, Any]:
    return {
        "text": [text],
        "conf": [confidence],
        "left": [4],
        "top": [4],
        "width": [20],
        "height": [20],
    }


def test_low_confidence_reread_requires_two_confident_matching_readings() -> None:
    readings = iter([data("Cc", 48), data("C"), data("C")])
    calls = []

    def recognize(image: Image.Image, config: str) -> dict[str, Any]:
        calls.append((image.size, config))
        return next(readings)

    with Image.new("RGB", (100, 100), "white") as image:
        assert transcribe(image, recognize, 30000000).strip() == "C"
    assert calls == [((100, 100), "--psm 6"), ((44, 44), "--psm 7"), ((88, 88), "--psm 7")]


@pytest.mark.parametrize("second", [data("G"), data("C", 50)])
def test_disagreement_or_low_confidence_never_replaces_original(second: dict[str, Any]) -> None:
    readings = iter([data("Cc", 48), data("C"), second])
    with Image.new("RGB", (100, 100), "white") as image:
        assert transcribe(image, lambda *_: next(readings), 30000000).strip() == "Cc"


def test_colour_pass_uses_geometry_to_avoid_conflicting_duplicate() -> None:
    extra = {
        "text": ["Cc", "WARNING"],
        "conf": [95, 95],
        "left": [4, 4],
        "top": [4, 50],
        "width": [20, 80],
        "height": [20, 20],
    }
    readings = iter([data("C"), extra])
    with Image.new("RGB", (100, 100), "red") as image:
        text = transcribe(image, lambda *_: next(readings), 30000000)
    assert "WARNING" in text and "Cc" not in text


def test_layout_preserves_columns_across_different_rows_without_inferring_pairs() -> None:
    text = layout(
        [
            Word("5", 90, 60, 10, 10, 10),
            Word("3", 90, 90, 30, 10, 10),
            Word("2", 90, 30, 50, 10, 10),
            Word("A", 90, 30, 70, 10, 10),
            Word("B", 90, 60, 70, 10, 10),
            Word("C", 90, 90, 70, 10, 10),
        ],
        120,
    )
    lines = text.splitlines()
    assert lines[0].index("5") == lines[3].index("B")
    assert lines[1].index("3") == lines[3].index("C")
    assert lines[2].index("2") == lines[3].index("A")
    assert "=" not in text


def test_pixel_cap_skips_enlarged_crop() -> None:
    with Image.new("RGB", (100, 100), "white") as image:
        assert transcribe(image, lambda *_: data("Cc", 48), 100).strip() == "Cc"


def test_bad_boxes_and_excessive_data_fail_closed() -> None:
    with pytest.raises(ValueError, match="OCR_GEOMETRY_INVALID"):
        words(data("word"), (10, 10))
    with pytest.raises(ValueError, match="OCR_WORD_LIMIT_EXCEEDED"):
        words({"text": [""] * 20001}, (100, 100))


def test_retry_count_is_bounded() -> None:
    initial = {
        "text": ["x"] * 12,
        "conf": [40] * 12,
        "left": [4] * 12,
        "top": list(range(0, 240, 20)),
        "width": [20] * 12,
        "height": [20] * 12,
    }
    calls = []

    def recognize(image: Image.Image, config: str) -> dict[str, Any]:
        calls.append(config)
        return initial if len(calls) == 1 else data("x")

    with Image.new("RGB", (100, 300), "white") as image:
        transcribe(image, recognize, 30000000)
    assert len(calls) == 17


def test_indexing_preserves_reviewed_layout_inside_page_chunk() -> None:
    text = "Figure review\n\n      5\n         3\n   2\n   A  B  C\nDocument cards only."
    pages = [
        Document(
            page_content=text, metadata={"page": 2, "section": "Page 2", "extractionQuality": 0.6}
        )
    ]
    chunks = source_chunks(pages, index_request(), Settings())
    assert len(chunks) == 1 and chunks[0].page_content == text
    assert chunks[0].metadata["pipelineVersion"] == "4"
    assert chunks[0].metadata["page"] == 2
