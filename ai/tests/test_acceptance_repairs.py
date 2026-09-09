import io
import json
from pathlib import Path
from typing import Any

import pytest
from PIL import Image
from pypdf import PdfWriter
from test_backend_workflows import FixtureProviders, fixtures

from patch_ai.adapters import ocr
from patch_ai.adapters.ocr import available as check_ocr_available
from patch_ai.adapters.providers import Model
from patch_ai.adapters.source_loader import VerifiedSourceLoader
from patch_ai.config import Settings
from patch_ai.services import answering
from patch_ai.services.answering import EvidenceVerification, GroundedDraft

PACK = Path(__file__).resolve().parents[2] / "Manual Testing/ui-less-test/pdfs/fixtures"


def test_scanned_pdf_uses_full_page_render_and_physical_anchor(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    image_sizes = []

    def recognize(image: Image.Image, settings: Settings) -> str:
        image_sizes.append(image.size)
        return "Synthetic observation CW-17, PT-101, 3.1 bar(g)."

    monkeypatch.setattr(ocr, "image_text", recognize)
    pages = VerifiedSourceLoader(
        (PACK / "05_OCR_Shift_Inspection_Card.pdf").read_bytes(), "application/pdf"
    ).load()
    assert len(pages) == 1 and image_sizes[0][0] > 1000
    assert pages[0].metadata == {"page": 1, "section": "Page 1", "extractionQuality": 0.6}
    assert "CW-17" in pages[0].page_content


def test_mixed_native_page_does_not_drop_raster_labels(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ocr, "image_text", lambda image, settings: "RASTER-ONLY observation")
    pages = VerifiedSourceLoader(
        (PACK / "04_Multimodal_Control_Loop_Diagnostic.pdf").read_bytes(), "application/pdf"
    ).load()
    raster_pages = [p for p in pages if "RASTER-ONLY" in p.page_content]
    assert raster_pages
    assert all(p.metadata["extractionQuality"] == 0.6 for p in raster_pages)
    assert any("PT-101" in p.page_content for p in pages)


def test_render_rejects_oversized_page_before_bitmap_allocation() -> None:
    writer = PdfWriter()
    writer.add_blank_page(width=100000, height=100000)
    data = io.BytesIO()
    writer.write(data)
    with pytest.raises(ValueError, match="SOURCE_IMAGE_TOO_LARGE"):
        ocr.render_page(data.getvalue(), 0, Settings())


def test_explicit_missing_ocr_path_does_not_fall_back(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ocr.shutil, "which", lambda value: None)
    with pytest.raises(ValueError, match="OCR_UNAVAILABLE"):
        ocr.executable(Settings(ocr_tesseract_cmd="missing-ocr-executable"))


def test_ocr_restores_wrapper_configuration_after_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    import pytesseract

    previous = pytesseract.pytesseract.tesseract_cmd
    monkeypatch.setattr(ocr, "executable", lambda settings: "test-ocr")

    def timeout(*args: Any, **kwargs: Any) -> str:
        raise RuntimeError("OCR timeout")

    monkeypatch.setattr(pytesseract, "image_to_string", timeout)
    with Image.new("RGB", (32, 32)) as image, pytest.raises(RuntimeError, match="OCR timeout"):
        ocr.image_text(image, Settings())
    assert pytesseract.pytesseract.tesseract_cmd == previous
    assert not ocr._ocr_lock.locked()


def test_colour_pass_preserves_primary_text_and_recovers_new_warning(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import pytesseract

    monkeypatch.setattr(ocr, "executable", lambda settings: "test-ocr")
    readings = iter(["CW-17\n09:40 IST", "cw-17\n09:40 IST\nTEST ONLY"])
    monkeypatch.setattr(pytesseract, "image_to_string", lambda *a, **k: next(readings))
    with Image.new("RGB", (32, 32), color=(255, 200, 0)) as image:
        assert ocr.image_text(image, Settings()) == "CW-17\n09:40 IST\n\nTEST ONLY"


def test_readiness_requires_every_requested_language(monkeypatch: pytest.MonkeyPatch) -> None:
    from types import SimpleNamespace

    monkeypatch.setattr(ocr, "executable", lambda settings: "test-ocr")
    monkeypatch.setattr(
        ocr.subprocess,
        "run",
        lambda *a, **k: SimpleNamespace(stdout="List of available languages (1):\neng\n"),
    )
    assert check_ocr_available(Settings(ocr_languages="eng"))
    assert not check_ocr_available(Settings(ocr_languages="eng+deu"))


def test_readiness_includes_missing_ocr_without_exposing_details(
    client: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from conftest import signed_request

    monkeypatch.setattr(ocr, "available", lambda settings: False)
    response = signed_request(client, "GET", "/readiness")
    assert response.json() == {"service": "patch-ai", "status": "unavailable"}


class ContextProviders(FixtureProviders):
    safety_gap = False

    def model(
        self,
        schema: type[Model],
        system: str,
        data: str,
        *,
        routing: bool = False,
        complex_reasoning: bool = False,
        images: tuple[bytes, ...] = (),
    ) -> Model:
        if schema in {GroundedDraft, EvidenceVerification}:
            payload = json.loads(data)
            assert payload["question"]
            assert "document-fact lookup" in system
            assert "not plant safety certification" in system
            assert all(
                s["currentVersion"] and s["approvalState"] == "APPROVED" for s in payload["sources"]
            )
        if schema is EvidenceVerification and self.safety_gap:
            return schema.model_validate(
                {"supported": True, "conflict": False, "missingMandatorySafetyEvidence": True}
            )
        return super().model(
            schema, system, data, routing=routing, complex_reasoning=complex_reasoning
        )


def test_question_context_reaches_verifier_without_weakening_safety() -> None:
    settings, fixture, request = fixtures()
    providers = ContextProviders(settings)
    providers.records = fixture.records
    assert answering.answer(request, settings, providers).status == "approved"
    providers.safety_gap = True
    result = answering.answer(request, settings, providers)
    assert result.status == "incomplete" and not result.answer.steps and not result.citations
