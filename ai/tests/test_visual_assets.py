import base64
import hashlib
import io
from typing import Any
from uuid import uuid4

import pytest
from conftest import signed_request
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject

from patch_ai.config import Settings
from patch_ai.schemas.contracts import VisualBounds, VisualRenderRequest, VisualRenderResult
from patch_ai.services.visual_assets import render


def source_pdf(rotation: int = 0, width: int = 144) -> bytes:
    writer = PdfWriter()
    page = writer.add_blank_page(width=width, height=72)
    contents = DecodedStreamObject()
    contents.set_data(b"1 0 0 rg 0 0 72 72 re f 0 0 1 rg 72 0 72 72 re f")
    page[NameObject("/Contents")] = writer._add_object(contents)
    if rotation:
        page.rotate(rotation)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def request_for(data: bytes, **extra: Any) -> VisualRenderRequest:
    return VisualRenderRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "contractVersion": "v1",
            "tenantId": "test",
            "assetId": "asset-1",
            "documentId": "doc-1",
            "documentVersionId": "version-1",
            "approvalState": "APPROVED",
            "page": 1,
            "renderDpi": 72,
            "sourceFile": {
                "url": "https://tenant.r2.cloudflarestorage.com/manual.pdf",
                "contentType": "application/pdf",
                "sha256": hashlib.sha256(data).hexdigest(),
            },
            **extra,
        }
    )


def test_renders_exact_page_crop_rotation_and_stable_bytes(
    monkeypatch: pytest.MonkeyPatch,
    ready_settings: Settings,
) -> None:
    for rotation, expected in [(0, (144, 72)), (90, (72, 144))]:
        pdf = source_pdf(rotation)
        monkeypatch.setattr(
            "patch_ai.services.visual_assets.download_source", lambda *_, data=pdf: data
        )
        request = request_for(pdf)
        full = render(request, ready_settings)
        assert full.status == "rendered" and full.asset is not None and full.png_base64
        assert (full.asset.width, full.asset.height) == expected
        assert render(request, ready_settings).png_base64 == full.png_base64
        with Image.open(io.BytesIO(base64.b64decode(full.png_base64))) as image:
            assert image.getpixel((10, 10)) == (255, 0, 0)
        crop = render(request_for(pdf, bounds={"right": 0.5}), ready_settings)
        assert crop.asset is not None and crop.png_base64
        assert crop.asset.width == expected[0] // 2
        png = base64.b64decode(crop.png_base64)
        assert crop.asset.sha256 == hashlib.sha256(png).hexdigest()
        assert crop.asset.original_sha256 == hashlib.sha256(pdf).hexdigest()


@pytest.mark.parametrize(
    "bounds",
    [
        {"left": 0.5, "right": 0.5},
        {"top": 1},
        {"right": 1.1},
        {"left": float("nan")},
        {"bottom": float("inf")},
    ],
)
def test_rejects_invalid_bounds(bounds: dict[str, float]) -> None:
    with pytest.raises(ValidationError):
        VisualBounds.model_validate(bounds)


def test_render_rejects_bad_pages_oversize_and_malformed_source(
    monkeypatch: pytest.MonkeyPatch,
    ready_settings: Settings,
) -> None:
    for pdf, extra in [
        (source_pdf(), {"page": 2}),
        (source_pdf(width=100_000), {}),
        (b"not-a-pdf", {}),
    ]:
        monkeypatch.setattr(
            "patch_ai.services.visual_assets.download_source", lambda *_, data=pdf: data
        )
        result = render(request_for(pdf, **extra), ready_settings)
        assert result.status == "failed"
        assert result.asset is None and result.png_base64 is None
        assert result.errors[0].code == "VISUAL_RENDER_FAILED"


def test_private_render_checks_auth_correlation_and_returns_no_partial_errors(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pdf = source_pdf()
    payload = request_for(pdf).model_dump(mode="json", by_alias=True)
    path = "/v1/visual-assets/render"
    assert client.post(path, json=payload).status_code == 401
    assert signed_request(client, "POST", path, payload).status_code == 400
    monkeypatch.setattr("patch_ai.services.visual_assets.download_source", lambda *_: pdf)
    response = signed_request(client, "POST", path, payload, request_id=payload["requestId"])
    assert response.status_code == 200
    result = VisualRenderResult.model_validate(response.json())
    assert result.asset is not None and result.asset.asset_id == "asset-1"
    payload["requestId"] = str(uuid4())

    def broken(*_: Any) -> bytes:
        raise RuntimeError("private-source-url-and-credentials")

    monkeypatch.setattr("patch_ai.services.visual_assets.download_source", broken)
    failed = signed_request(client, "POST", path, payload, request_id=payload["requestId"])
    assert failed.status_code == 200 and failed.json()["status"] == "failed"
    assert "private-source" not in failed.text and failed.json()["pngBase64"] is None


def test_render_does_not_accept_unapproved_source() -> None:
    with pytest.raises(ValidationError):
        request_for(source_pdf(), approvalState="PENDING")
