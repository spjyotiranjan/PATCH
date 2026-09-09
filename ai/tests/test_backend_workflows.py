import hashlib
import io
import json
import socket
from typing import Any
from uuid import uuid4

import httpx
import pytest
import respx
from langchain_core.documents import Document
from pypdf import PdfWriter
from test_phase_two_scope import question_payload

from patch_ai.adapters.providers import Model, Providers
from patch_ai.adapters.source_loader import (
    SourceRejected,
    VerifiedSourceLoader,
    download_source,
    validate_source_url,
)
from patch_ai.config import Settings
from patch_ai.schemas.contracts import (
    DeclaredMetadata,
    EntityProfileRequest,
    ExtractRequest,
    IndexRequest,
    ProcedureDraftRequest,
    QuestionRequest,
)
from patch_ai.services import answering, drafting, ingestion
from patch_ai.services.answering import EvidenceVerification, GroundedDraft
from patch_ai.services.drafting import ProcedureCandidate, ProcedureEvidenceVerification
from patch_ai.services.ingestion import ProfileDescription

TEXT = "Synthetic test card only. The test display label is amber. This is not equipment guidance."


class FixtureProviders(Providers):
    def __init__(self, settings: Settings) -> None:
        super().__init__(settings)
        self.records: dict[str, Document] = {}
        self.queries: list[dict[str, Any]] = []
        self.conflict = False
        self.unsupported = False
        self.verified_criticality = False

    def upsert(self, documents: list[Document], ids: list[str]) -> None:
        self.records.update(zip(ids, documents, strict=True))

    def search(
        self, query: str, filters: dict[str, Any], count: int
    ) -> list[tuple[Document, float]]:
        self.queries.append(filters)
        conditions = {key: value for clause in filters["$and"] for key, value in clause.items()}
        matches = []
        for record in self.records.values():
            if all(
                record.metadata.get(key) in value["$in"]
                if "$in" in value
                else record.metadata.get(key) == value["$eq"]
                for key, value in conditions.items()
            ):
                matches.append((record, 0.9))
        return matches[:count]

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
        assert "untrusted" in system
        payload: dict[str, Any]
        if schema is GroundedDraft:
            sources = json.loads(data)["sources"]
            payload = {
                "status": "conflicting" if self.conflict else "approved",
                "title": "Test label",
                "claims": [
                    {
                        "text": "The test display label is amber.",
                        "chunkIds": ["invented" if self.unsupported else sources[0]["chunkId"]],
                    }
                ],
                "gaps": [],
            }
        elif schema in {EvidenceVerification, ProcedureEvidenceVerification}:
            payload = {
                "supported": not self.unsupported,
                "conflict": self.conflict,
                "missingMandatorySafetyEvidence": False,
            }
            if schema is ProcedureEvidenceVerification:
                payload["highCriticality"] = self.verified_criticality
        elif schema is ProfileDescription:
            payload = {
                "generatedDescription": "Synthetic routing profile",
                "systems": [],
                "components": [],
                "capabilities": [],
                "failureModes": [],
                "searchHints": [],
                "coverage": [],
            }
        elif schema is ProcedureCandidate:
            source = json.loads(data)["sources"][0]
            payload = {
                "title": "Synthetic label check",
                "steps": [
                    {
                        "title": "Observe test card",
                        "instructions": "The test display label is amber.",
                        "chunkIds": [source["chunkId"]],
                        "required": True,
                    }
                ],
                "requiredTopics": ["test label"],
                "missingTopics": [],
                "conflict": self.conflict,
                "missingMandatorySafetyEvidence": False,
                "applicable": True,
                "highCriticality": False,
            }
        else:
            payload = {
                "summary": "Synthetic test label coverage",
                "capabilities": [],
                "systems": [],
                "searchHints": [],
            }
        return schema.model_validate(payload)


def index_request() -> IndexRequest:
    return IndexRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "contractVersion": "v1",
            "tenantId": "tenant-1",
            "originalFileId": "file-1",
            "documentId": "document-1",
            "documentVersionId": "version-1",
            "approvalState": "APPROVED",
            "reviewedMetadata": {"title": "Test card", "revision": "1"},
            "sourceFile": {
                "url": "https://tenant.r2.cloudflarestorage.com/test.txt",
                "contentType": "text/plain",
                "sha256": hashlib.sha256(TEXT.encode()).hexdigest(),
            },
        }
    )


def fixtures() -> tuple[Settings, FixtureProviders, QuestionRequest]:
    settings = Settings(_env_file=None, pinecone_namespace="tests")  # pyright: ignore[reportCallIssue]
    providers = FixtureProviders(settings)
    request = index_request()
    chunks = ingestion.source_chunks(
        VerifiedSourceLoader(TEXT.encode(), "text/plain").load(), request, settings
    )
    providers.upsert(chunks, [c.metadata["chunkId"] for c in chunks])
    question = QuestionRequest.model_validate(question_payload())
    return settings, providers, question


def test_source_loader_anchors_and_rejects_unsafe_documents() -> None:
    pages = VerifiedSourceLoader(TEXT.encode(), "text/plain").load()
    assert pages[0].metadata["page"] == 1
    assert pages[0].page_content == TEXT
    for data, mime in [
        (b"", "text/plain"),
        (b"\x00", "text/plain"),
        (b"<script>", "text/html"),
        (b"bad", "application/pdf"),
    ]:
        with pytest.raises((SourceRejected, ValueError)):
            VerifiedSourceLoader(data, mime).load()
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.encrypt("secret")
    buffer = io.BytesIO()
    writer.write(buffer)
    with pytest.raises(SourceRejected):
        VerifiedSourceLoader(buffer.getvalue(), "application/pdf").load()


@pytest.mark.parametrize(
    "url",
    [
        "http://tenant.r2.cloudflarestorage.com/a",
        "https://evil.test/a",
        "https://user:password@tenant.r2.cloudflarestorage.com/a",
        "https://tenant.r2.cloudflarestorage.com:444/a",
    ],
)
def test_download_url_validation(url: str) -> None:
    with pytest.raises(SourceRejected):
        validate_source_url(
            url, Settings(source_url_allowed_hosts="tenant.r2.cloudflarestorage.com")
        )


def test_download_rejects_private_dns(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        socket, "getaddrinfo", lambda *a, **k: [(None, None, None, None, ("127.0.0.1", 443))]
    )
    with pytest.raises(SourceRejected):
        validate_source_url(
            "https://tenant.r2.cloudflarestorage.com/a",
            Settings(source_url_allowed_hosts="tenant.r2.cloudflarestorage.com"),
        )


@respx.mock
def test_download_checks_bytes_hash_type_and_redirects(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        socket, "getaddrinfo", lambda *a, **k: [(None, None, None, None, ("1.1.1.1", 443))]
    )
    source = index_request().source_file
    settings = Settings(source_url_allowed_hosts="tenant.r2.cloudflarestorage.com")
    respx.get(str(source.url)).mock(
        return_value=httpx.Response(200, content=TEXT, headers={"Content-Type": "text/plain"})
    )
    assert download_source(source, settings) == TEXT.encode()
    with pytest.raises(SourceRejected):
        download_source(source.model_copy(update={"sha256": "0" * 64}), settings)
    with pytest.raises(SourceRejected):
        download_source(source, settings.model_copy(update={"source_download_max_bytes": 2}))
    respx.get(str(source.url)).mock(
        return_value=httpx.Response(302, headers={"location": "https://evil.test"})
    )
    with pytest.raises(SourceRejected):
        download_source(source, settings)


def test_index_idempotency_and_source_provenance(monkeypatch: pytest.MonkeyPatch) -> None:
    settings, providers, _ = fixtures()
    monkeypatch.setattr(ingestion, "download_source", lambda *a: TEXT.encode())
    request = index_request()
    result = ingestion.index(request, settings, providers)
    assert result.status == "indexed"
    ids = set(providers.records)
    assert ingestion.index(request, settings, providers).status == "indexed"
    assert set(providers.records) == ids
    assert all(
        d.metadata["originalFileId"] == "file-1" and d.metadata["recordType"] == "SOURCE_CHUNK"
        for d in providers.records.values()
    )


def test_extraction_and_profile_graphs(monkeypatch: pytest.MonkeyPatch) -> None:
    settings, providers, _ = fixtures()
    monkeypatch.setattr(ingestion, "download_source", lambda *a: TEXT.encode())
    request = ExtractRequest(
        request_id=uuid4(),
        contract_version="v1",
        document_id="document-1",
        document_version_id="version-1",
        version_number="1",
        source_file=index_request().source_file,
        declared_metadata=DeclaredMetadata(title="Test", document_type="MANUAL"),
    )
    result = ingestion.extract(request, settings, providers)
    assert result.status == "needs_review" and result.pages[0].text == TEXT
    profile = EntityProfileRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "contractVersion": "v1",
            "tenantId": "tenant-1",
            "inputFingerprint": "a" * 64,
            "entity": {"type": "EQUIPMENT", "id": "equipment-1", "profileVersion": 1},
        }
    )
    first = ingestion.profile(profile, settings, providers)
    second = ingestion.profile(profile, settings, providers)
    assert first.status == "upserted" and first.profile_id == second.profile_id
    assert providers.records[first.profile_id].metadata["recordType"] == "ENTITY_PROFILE"


def test_grounded_answer_and_source_filter() -> None:
    settings, providers, request = fixtures()
    result = answering.answer(request, settings, providers)
    assert result.status == "approved", result
    assert result.citations[0].excerpt == TEXT
    assert result.citations[0].document_version_id == "version-1"
    filters = str(providers.queries)
    for expected in ("tenantId", "environment", "SOURCE_CHUNK", "APPROVED", "version-1"):
        assert expected in filters


def test_assignment_narrows_and_stale_profiles_fall_back() -> None:
    settings, providers, request = fixtures()
    request.assigned_references = []
    result = answering.answer(
        request, settings.model_copy(update={"entity_routing_enabled": True}), providers
    )
    assert result.routing.used_structural_fallback
    assert all("ENTITY_PROFILE" not in str(q) for q in providers.queries)
    request = QuestionRequest.model_validate(
        {**question_payload(), "assignedReferences": [{"type": "DOCUMENT", "id": "document-1"}]}
    )
    assert answering.assigned_versions(request) == {"version-1"}


def test_unknown_citations_and_conflicts_cannot_return_actions() -> None:
    settings, providers, request = fixtures()
    providers.unsupported = True
    result = answering.answer(request, settings, providers)
    assert result.status == "incomplete" and not result.answer.steps
    providers.unsupported = False
    providers.conflict = True
    result = answering.answer(request, settings, providers)
    assert result.status == "conflicting" and not result.answer.steps and not result.citations


def test_empty_manifest_and_provider_outage() -> None:
    settings, providers, request = fixtures()
    request = QuestionRequest.model_validate(
        {
            **question_payload(),
            "assignedReferences": [],
            "retrievalScopeManifest": {
                "allowedDocumentVersions": [],
                "entities": [],
                "relationships": [],
            },
        }
    )
    assert answering.answer(request, settings, providers).status == "incomplete"
    assert not providers.queries
    full = QuestionRequest.model_validate(question_payload())
    assert answering.answer(full, settings, Providers(settings)).status == "unavailable"


def test_severe_procedure_candidate_omits_conflicting_steps() -> None:
    settings, providers, question = fixtures()
    request = ProcedureDraftRequest.model_validate(
        {
            "requestId": str(uuid4()),
            "contractVersion": "v1",
            "tenantId": "tenant-1",
            "projectId": "project-1",
            "projectDescription": "Synthetic test card review",
            "generationRequestId": "generation-1",
            "inputFingerprint": "a" * 64,
            "timezone": "Asia/Kolkata",
            "retrievalScopeManifest": question.retrieval_scope_manifest.model_dump(by_alias=True),
            "activeSources": [
                {
                    "documentVersionId": "version-1",
                    "documentTitle": "Test card",
                    "revision": "1",
                    "inclusionPath": "PROJECT_DIRECT",
                }
            ],
        }
    )
    result = drafting.draft_procedure(request, settings, providers)
    assert result.status == "generated" and result.steps and result.requires_human_review
    providers.verified_criticality = True
    assert (
        drafting.draft_procedure(request, settings, providers).review_analysis.review_need == "HIGH"
    )
    providers.conflict = True
    result = drafting.draft_procedure(request, settings, providers)
    assert result.review_analysis.review_need == "SEVERE"
    assert result.review_analysis.blocking_findings and not result.steps


def test_returned_wrong_tenant_or_profile_chunk_is_not_citable() -> None:
    settings, _, request = fixtures()
    chunk = Document(
        page_content=TEXT, metadata={"recordType": "ENTITY_PROFILE", "tenantId": "other"}
    )
    assert not answering.valid_chunk(chunk, request, settings, {"version-1"})
