import hashlib
import io
from typing import Any
from uuid import uuid4

import pytest
from conftest import signed_request
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError

from patch_ai.adapters.providers import Providers
from patch_ai.config import Settings
from patch_ai.schemas.contracts import VisualDescribeRequest, VisualDescribeResult
from patch_ai.services.visual_understanding import describe


def fixture() -> tuple[bytes, VisualDescribeRequest]:
    stream = io.BytesIO()
    Image.new("RGB", (16, 16), "red").save(stream, format="PNG")
    data = stream.getvalue()
    sha = hashlib.sha256(data).hexdigest()
    request = VisualDescribeRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "contractVersion": "v1",
            "tenantId": "test",
            "approvalState": "APPROVED",
            "asset": {
                "assetId": "asset",
                "documentId": "doc",
                "documentVersionId": "version",
                "page": 1,
                "bounds": {},
                "originalSha256": "a" * 64,
                "sha256": sha,
                "byteCount": len(data),
                "width": 16,
                "height": 16,
                "renderDpi": 72,
            },
            "sourceFile": {
                "url": "https://fixture.example/image.png?private=secret",
                "contentType": "image/png",
                "sha256": sha,
            },
        }
    )
    return data, request


@pytest.mark.parametrize("supported,injection", [(True, False), (False, False), (True, True)])
def test_verified_pixels_only_no_source_url_and_fail_closed(
    monkeypatch: pytest.MonkeyPatch,
    ready_settings: Settings,
    supported: bool,
    injection: bool,
) -> None:
    data, request = fixture()
    monkeypatch.setattr("patch_ai.adapters.visual_source.download_source", lambda *_: data)
    calls: list[dict[str, Any]] = []

    def model(self: Providers, schema: Any, system: str, text: str, **kwargs: Any) -> Any:
        assert "untrusted" in system
        assert "private=secret" not in text and "https:" not in text
        assert kwargs["images"] == (data,)
        calls.append(kwargs)
        if schema.__name__ == "Verification":
            return schema(supported=supported, contains_instruction_injection=injection)
        return schema(summary="Red square.", labels=[], relationships=[], uncertainties=[])

    monkeypatch.setattr(Providers, "model", model)
    result = describe(request, ready_settings, Providers(ready_settings))
    assert len(calls) == 2 and calls[1]["complex_reasoning"] is True
    assert result.request_id == request.request_id
    if supported and not injection:
        assert result.status == "described" and result.description is not None
    else:
        assert result.status == "failed" and result.description is None


@pytest.mark.parametrize("damage", ["checksum", "dimensions", "malformed", "length"])
def test_invalid_pixels_never_reach_model(
    monkeypatch: pytest.MonkeyPatch,
    ready_settings: Settings,
    damage: str,
) -> None:
    data, request = fixture()
    if damage == "checksum":
        data = data[:-1] + b"x"
    elif damage == "dimensions":
        request.asset.width = 17
    elif damage == "length":
        request.asset.byte_count += 1
    else:
        data = b"not png"
        request.asset.byte_count = len(data)
        request.asset.sha256 = hashlib.sha256(data).hexdigest()
    monkeypatch.setattr("patch_ai.adapters.visual_source.download_source", lambda *_: data)
    calls: list[int] = []
    monkeypatch.setattr(Providers, "model", lambda *_a, **_k: calls.append(1))
    result = describe(request, ready_settings, Providers(ready_settings))
    assert result.status == "failed" and result.description is None and not calls


def test_request_rejects_mismatched_provenance_and_partial_failure() -> None:
    _, request = fixture()
    payload = request.model_dump()
    payload["source_file"]["sha256"] = "b" * 64
    with pytest.raises(ValidationError):
        VisualDescribeRequest.model_validate(payload)
    with pytest.raises(ValidationError):
        VisualDescribeResult.model_validate(
            {
                "requestId": str(uuid4()),
                "assetId": "asset",
                "sha256": "a" * 64,
                "status": "failed",
                "description": {
                    "summary": "partial",
                    "labels": [],
                    "relationships": [],
                    "uncertainties": [],
                },
            }
        )


def test_description_endpoint_requires_signature_and_hides_failure_details(
    client: TestClient,
) -> None:
    _, request = fixture()
    payload = request.model_dump(mode="json", by_alias=True)
    path = "/v1/visual-assets/describe"
    assert client.post(path, json=payload).status_code == 401
    assert signed_request(client, "POST", path, payload).status_code == 400
    response = signed_request(client, "POST", path, payload, request_id=payload["requestId"])
    assert response.status_code == 200
    assert response.json()["status"] == "failed"
    assert response.json()["description"] is None
    assert "private=secret" not in response.text and "TEST_PROVIDER" not in response.text
