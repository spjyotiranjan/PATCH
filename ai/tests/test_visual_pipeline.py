import hashlib
import io
import json
import logging
from typing import Any
from uuid import uuid4

import pytest
from conftest import signed_request
from fastapi.testclient import TestClient
from langchain_core.documents import Document
from pydantic import ValidationError
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject
from test_visual_understanding import fixture

from patch_ai.adapters.providers import Providers
from patch_ai.config import Settings
from patch_ai.schemas.contracts import (
    Answer,
    ChatSessionResult,
    QuestionRequest,
    QuestionResult,
    RoutingResult,
    VisualDescription,
    VisualDocumentRequest,
    VisualIndexRequest,
    VisualSearchResult,
    VisualSelection,
)
from patch_ai.services import visual_ingestion, visual_retrieval


def setup() -> tuple[bytes, QuestionRequest, VisualIndexRequest, Settings]:
    pixels, source = fixture()
    description = VisualDescription(
        summary="A red test square.", labels=[], relationships=[], uncertainties=[]
    )
    index = VisualIndexRequest(
        request_id=uuid4(),
        contract_version="v1",
        tenant_id="test",
        approval_state="APPROVED",
        asset=source.asset,
        description=description,
        description_fingerprint="a" * 64,
        visual_class="DIAGRAM",
    )
    index.description_fingerprint = visual_ingestion.description_fingerprint(index)
    request = QuestionRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "contractVersion": "v1",
            "actor": {"id": "user", "tenantId": "test"},
            "chatSession": {"id": "session"},
            "question": "Explain this diagram",
            "retrievalPolicy": {},
            "retrievalScopeManifest": {
                "allowedDocumentVersions": [
                    {
                        "documentId": "doc",
                        "documentVersionId": "version",
                        "inclusionPaths": ["PERSONAL"],
                    }
                ]
            },
            "visualScopeManifest": [
                {
                    "asset": source.asset.model_dump(),
                    "descriptionFingerprint": index.description_fingerprint,
                    "visualClass": "DIAGRAM",
                    "embeddingModel": "text-embedding-3-large",
                }
            ],
        }
    )
    return pixels, request, index, Settings(visual_retrieval_enabled=True)


def test_index_is_stable_scoped_and_contains_no_pixels_or_urls(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, request, index, settings = setup()
    records: dict[str, Document] = {}
    monkeypatch.setattr(
        Providers, "visual_upsert", lambda _self, doc, key: records.update({key: doc})
    )
    for _ in range(2):
        assert visual_ingestion.index(index, settings, Providers(settings)).status == "indexed"
    assert len(records) == 1
    doc = next(iter(records.values()))
    assert doc.metadata["recordType"] == "IMAGE_REGION"
    assert doc.metadata["tenantId"] == request.actor.tenant_id
    assert "https:" not in doc.page_content and "base64" not in str(doc.metadata)
    index.description_fingerprint = "f" * 64
    assert visual_ingestion.index(index, settings, Providers(settings)).status == "failed"
    assert len(records) == 1


@pytest.mark.parametrize(
    "damage",
    [
        "tenantId",
        "documentId",
        "sha256",
        "descriptionFingerprint",
        "embeddingModel",
        "page",
        "left",
    ],
)
def test_fusion_rejects_stale_or_tampered_projections(
    monkeypatch: pytest.MonkeyPatch, damage: str
) -> None:
    _, request, index, settings = setup()
    stored: list[Document] = []
    monkeypatch.setattr(Providers, "visual_upsert", lambda _s, d, _i: stored.append(d))
    visual_ingestion.index(index, settings, Providers(settings))
    entries = {e.asset.asset_id: e for e in request.visual_scope_manifest}
    assert visual_retrieval.fuse(entries, [(stored[0], 0.1)], [], settings, "test")
    stored[0].metadata[damage] = "tampered"
    assert not visual_retrieval.fuse(entries, [(stored[0], 100)], [], settings, "test")


@pytest.mark.parametrize("role", ["HELPFUL", "REQUIRED", "NOT_RELEVANT", "invented"])
def test_gate_controls_selection_without_loading_pixels(
    monkeypatch: pytest.MonkeyPatch, role: str
) -> None:
    _, request, index, settings = setup()
    stored: list[Document] = []
    monkeypatch.setattr(Providers, "visual_upsert", lambda _s, d, _i: stored.append(d))
    visual_ingestion.index(index, settings, Providers(settings))
    queries: list[dict[str, Any]] = []

    def search(
        _self: Providers, _query: str, filters: dict[str, Any], _count: int
    ) -> list[tuple[Document, float]]:
        queries.append(filters)
        return [(stored[0], 0.9)]

    monkeypatch.setattr(Providers, "visual_search", search)
    monkeypatch.setattr("patch_ai.services.answering.retrieve", lambda *_: [])

    def gate(_s: Providers, schema: Any, _system: str, _text: str, **kwargs: Any) -> Any:
        assert kwargs == {"routing": True}
        return schema(
            visual_required=role == "REQUIRED",
            items=[
                {
                    "candidateIndex": 1 if role == "invented" else 0,
                    "role": "HELPFUL" if role == "invented" else role,
                }
            ],
        )

    monkeypatch.setattr(Providers, "model", gate)
    result = visual_retrieval.search(request, settings, Providers(settings))
    assert queries and {"recordType": {"$eq": "IMAGE_REGION"}} in queries[0]["$and"]
    assert bool(result.selected) == (role in {"REQUIRED", "HELPFUL"})
    if role == "invented":
        assert result.state == "UNAVAILABLE"


def test_gate_reuses_bounded_text_context_without_promoting_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, request, index, settings = setup()
    request.question = "What card ID is recorded?"
    stored: list[Document] = []
    monkeypatch.setattr(Providers, "visual_upsert", lambda _s, d, _i: stored.append(d))
    visual_ingestion.index(index, settings, Providers(settings))
    monkeypatch.setattr(Providers, "visual_search", lambda *_: [(stored[0], 0.9)])
    retrieval_calls: list[bool] = []

    def retrieve(*_args: Any) -> list[Document]:
        retrieval_calls.append(True)
        return [
            Document(
                page_content="Card ID: TEST. " + "x" * 2500,
                metadata={"documentVersionId": "version", "page": i, "private": "excluded"},
            )
            for i in range(1, 7)
        ]

    monkeypatch.setattr("patch_ai.services.answering.retrieve", retrieve)

    def gate(_s: Providers, schema: Any, system: str, data: str, **kwargs: Any) -> Any:
        assert schema is visual_retrieval.Gate and kwargs == {"routing": True}
        context = json.loads(data)
        excerpts = context["currentTextContextOnly"]
        assert len(excerpts) == 4
        assert all(len(e["excerpt"]) == 2000 for e in excerpts)
        assert all(set(e) == {"documentVersionId", "page", "excerpt"} for e in excerpts)
        assert "untrusted relevance context" in system
        assert "duplicates that text is NOT_RELEVANT" in system
        return schema(
            visual_required=False,
            items=[visual_retrieval.GateItem(candidate_index=0, role="NOT_RELEVANT")],
        )

    monkeypatch.setattr(Providers, "model", gate)
    result = visual_retrieval.search(request, settings, Providers(settings))
    assert retrieval_calls == [True]
    assert result.state == "TEXT_ONLY" and not result.selected and not result.visual_required


@pytest.mark.parametrize("indices", [[1, 0], [0, 0], [0], [0, 2]])
def test_gate_maps_local_handles_and_rejects_incomplete_or_duplicate_selection(
    monkeypatch: pytest.MonkeyPatch, indices: list[int]
) -> None:
    _, request, _, settings = setup()
    candidates = [
        Document(
            page_content=f"figure-{i}",
            metadata={"assetId": "a" * 23 + str(i), "page": i + 1, "visualClass": "DIAGRAM"},
        )
        for i in range(2)
    ]
    monkeypatch.setattr(Providers, "visual_search", lambda *_: [])
    monkeypatch.setattr("patch_ai.services.answering.retrieve", lambda *_: [])
    monkeypatch.setattr(visual_retrieval, "fuse", lambda *_: candidates)

    def gate(_s: Providers, schema: Any, _system: str, data: str, **_kwargs: Any) -> Any:
        proposed = json.loads(data)["candidates"]
        assert [p["candidateIndex"] for p in proposed] == [0, 1]
        assert all("assetId" not in p for p in proposed)
        return schema(
            visual_required=True,
            items=[
                {"candidateIndex": i, "role": "REQUIRED" if i == 1 else "NOT_RELEVANT"}
                for i in indices
            ],
        )

    monkeypatch.setattr(Providers, "model", gate)
    result = visual_retrieval.search(request, settings, Providers(settings))
    if indices == [1, 0]:
        assert result.state == "AVAILABLE"
        assert [s.asset_id for s in result.selected] == ["a" * 23 + "1"]
    else:
        assert result.state == "UNAVAILABLE" and not result.selected


@pytest.mark.parametrize(
    "damage", ["none", "injection", "operational", "source", "citation", "conflict", "reason"]
)
def test_pixels_verified_in_same_turn_and_failures_keep_text(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture, damage: str
) -> None:
    caplog.set_level(logging.INFO, logger="patch_ai")
    pixels, request, _, settings = setup()
    _, source = fixture()
    # fixture creates deterministic bytes and asset metadata.
    request.visual_sources = [source]
    request.visual_selection = VisualSearchResult(
        request_id=request.request_id,
        state="AVAILABLE",
        selected=[VisualSelection(asset_id="asset", relevance_role="REQUIRED")],
        visual_required=True,
    )
    monkeypatch.setattr(
        "patch_ai.adapters.visual_source.download_source",
        lambda *_: pixels if damage != "source" else b"wrong",
    )
    calls: list[str] = []

    def model(_s: Providers, schema: Any, _sys: str, _data: str, **kwargs: Any) -> Any:
        assert kwargs["images"] == (pixels,)
        calls.append(schema.__name__)
        if schema is visual_retrieval.PixelDraft:
            assert "text-context-sentinel" not in _data
            assert "textAnswer" not in json.loads(_data)
            return schema.model_validate(
                {
                    "observations": [
                        {
                            "text": "A red square is visible.",
                            "assetIds": ["wrong" if damage == "citation" else "asset"],
                        }
                    ]
                }
            )
        assert kwargs["complex_reasoning"]
        assert "text-context-sentinel" in _data
        assert "separatelyVerifiedTextContext" in _data
        assert "evidence gap, not a contradiction" in _sys
        return schema(
            supported=True,
            operational_instructions=damage == "operational",
            injection=damage == "injection",
            conflict=damage == "conflict",
            unsupported_reasons=["LABEL"] if damage == "reason" else [],
        )

    monkeypatch.setattr(Providers, "model", model)
    baseline = QuestionResult(
        request_id=request.request_id,
        chat_session=ChatSessionResult(id="session", suggested_title="Test"),
        turn_id="turn",
        status="approved",
        routing=RoutingResult(used_structural_fallback=True),
        answer=Answer(summary="text-context-sentinel"),
        follow_up_allowed=True,
    )
    result = visual_retrieval.enrich(request, baseline, settings, Providers(settings))
    if damage == "none":
        assert result.visual_citations[0].sha256 == hashlib.sha256(pixels).hexdigest()
        assert result.visual_observations[0].visual_citation_ids == ["visual-asset"]
    else:
        assert result.visual_evidence_state == "UNAVAILABLE" and not result.visual_citations
        assert result.status == "incomplete"
    if damage == "source":
        assert not calls
    else:
        verdicts = [
            json.loads(r.message)
            for r in caplog.records
            if json.loads(r.message).get("event") == "patch_ai.visual_pixels.verdict"
        ]
        assert len(verdicts) == 1
        assert verdicts[0]["injection"] == (damage == "injection")
        assert verdicts[0]["operationalInstructions"] == (damage == "operational")
    assert "A red square is visible" not in caplog.text


def test_visual_failure_logs_do_not_expose_provider_errors(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO, logger="patch_ai")
    _, request, _, settings = setup()

    def fail(*_args: Any) -> Any:
        raise ValueError("private-provider-content https://private.example/signed?secret=value")

    monkeypatch.setattr(Providers, "visual_search", fail)
    monkeypatch.setattr("patch_ai.services.answering.retrieve", lambda *_: [])
    result = visual_retrieval.search(request, settings, Providers(settings))
    assert result.state == "UNAVAILABLE"
    assert "VISUAL_SEARCH_FAILED" in caplog.text
    assert "private-provider-content" not in caplog.text
    assert "private.example" not in caplog.text


def test_manifest_and_namespace_isolation() -> None:
    _, request, _, _ = setup()
    payload = request.model_dump()
    payload["visual_scope_manifest"][0]["asset"]["document_version_id"] = "outside"
    with pytest.raises(ValidationError):
        QuestionRequest.model_validate(payload)
    with pytest.raises(ValidationError):
        Settings(pinecone_namespace="same", pinecone_visual_namespace="same")
    assert not visual_retrieval.search(request, Settings(), Providers(Settings())).selected


@pytest.mark.parametrize("pages,drawings,expected", [(1, False, "complete"), (13, True, "partial")])
def test_local_triage_no_model_calls_and_explicit_caps(
    monkeypatch: pytest.MonkeyPatch, pages: int, drawings: bool, expected: str
) -> None:
    writer = PdfWriter()
    for _ in range(pages):
        page = writer.add_blank_page(width=200, height=200)
        stream = DecodedStreamObject()
        stream.set_data(b"0 0 1 rg 10 10 10 10 re f " * (10 if drawings else 1))
        page[NameObject("/Contents")] = writer._add_object(stream)
    buffer = io.BytesIO()
    writer.write(buffer)
    data = buffer.getvalue()
    monkeypatch.setattr("patch_ai.services.visual_ingestion.download_source", lambda *_: data)
    request = VisualDocumentRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "contractVersion": "v1",
            "tenantId": "test",
            "documentId": "doc",
            "documentVersionId": "version",
            "approvalState": "APPROVED",
            "sourceFile": {
                "url": "https://fixture.example/pdf",
                "contentType": "application/pdf",
                "sha256": hashlib.sha256(data).hexdigest(),
            },
        }
    )
    result = visual_ingestion.triage(request, Settings())
    assert result.status == expected
    assert len(result.pages) == (12 if drawings else 0)


def test_visual_search_endpoint_is_authenticated(client: TestClient) -> None:
    _, request, _, _ = setup()
    payload = request.model_dump(mode="json", by_alias=True)
    path = "/v1/visual-assets/search"
    assert client.post(path, json=payload).status_code == 401
    response = signed_request(client, "POST", path, payload, request_id=payload["requestId"])
    assert response.status_code == 200 and response.json()["state"] == "UNAVAILABLE"
    assert response.json()["visualRequired"] is True


@pytest.mark.parametrize("invalid", [False, True])
def test_discovery_renders_only_one_preview_and_validates_proposals(
    monkeypatch: pytest.MonkeyPatch,
    invalid: bool,
) -> None:
    from patch_ai.schemas.contracts import VisualDiscoverRequest

    _, _, index, settings = setup()
    writer = PdfWriter()
    writer.add_blank_page(width=144, height=72)
    buffer = io.BytesIO()
    writer.write(buffer)
    monkeypatch.setattr(visual_ingestion, "download_source", lambda *_: buffer.getvalue())
    request = VisualDiscoverRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "contractVersion": "v1",
            "tenantId": "test",
            "documentId": "doc",
            "documentVersionId": "version",
            "approvalState": "APPROVED",
            "page": 1,
            "sourceFile": {
                "url": "https://fixture.example/pdf",
                "sha256": index.asset.original_sha256,
                "contentType": "application/pdf",
            },
        }
    )
    calls = []

    def detect(_s: Providers, schema: Any, _sys: str, _data: str, **kwargs: Any) -> Any:
        calls.append(kwargs)
        assert kwargs["routing"] and len(kwargs["images"]) == 1
        return schema.model_validate(
            {
                "moreRegions": True,
                "regions": [
                    {
                        "bounds": {
                            "left": 0.9 if invalid else 0.1,
                            "top": 0.1,
                            "right": 0.8,
                            "bottom": 0.8,
                        },
                        "visualClass": "DIAGRAM",
                        "confidence": 0.8,
                        "uncertainty": "",
                    }
                ],
            }
        )

    monkeypatch.setattr(Providers, "model", detect)
    result = visual_ingestion.discover(request, settings, Providers(settings))
    assert len(calls) == 1
    assert result.status == ("failed" if invalid else "partial")
    assert len(result.regions) == (0 if invalid else 1)


def test_optional_pixel_timeout_preserves_text_and_resets_deadline(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import time

    from patch_ai.api.budget import workflow_deadline

    _, request, _, settings = setup()
    request.question = "What connections exist?"
    _, source = fixture()
    request.visual_sources = [source]
    request.visual_selection = VisualSearchResult(
        request_id=request.request_id,
        state="AVAILABLE",
        selected=[VisualSelection(asset_id="asset", relevance_role="HELPFUL")],
    )
    baseline = QuestionResult(
        request_id=request.request_id,
        chat_session=ChatSessionResult(id="session", suggested_title="Test"),
        turn_id="turn",
        status="approved",
        routing=RoutingResult(used_structural_fallback=True),
        answer=Answer(summary="Previously grounded text."),
        follow_up_allowed=True,
    )
    deadline = time.monotonic() + 1
    token = workflow_deadline.set(deadline)
    try:
        result = visual_retrieval.enrich(request, baseline, settings, Providers(settings))
        assert result.status == "approved" and result.visual_evidence_state == "UNAVAILABLE"
        assert result.answer.summary == "Previously grounded text."
        assert workflow_deadline.get() == deadline
    finally:
        workflow_deadline.reset(token)
