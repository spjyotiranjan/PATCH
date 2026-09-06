from uuid import uuid4

from conftest import signed_request
from fastapi.testclient import TestClient

SHA256 = "a" * 64
SOURCE_FILE = {
    "url": "https://tenant.r2.cloudflarestorage.com/source.pdf",
    "contentType": "application/pdf",
    "sha256": SHA256,
}


def contract_request(**payload: object) -> dict[str, object]:
    return {"requestId": str(uuid4()), "contractVersion": "v1", **payload}


def post(client: TestClient, path: str, payload: dict[str, object]):
    return signed_request(
        client,
        "POST",
        path,
        payload,
        request_id=str(payload["requestId"]),
    )


def test_extraction_stub_is_deterministic_and_non_fabricating(client: TestClient) -> None:
    payload = contract_request(
        documentId="doc-1",
        documentVersionId="doc-version-1",
        versionNumber="1",
        sourceFile=SOURCE_FILE,
        declaredMetadata={"title": "Manual", "documentType": "MANUAL"},
    )

    response = post(client, "/v1/ingestions/extract", payload)

    assert response.status_code == 200
    assert response.json() == {
        "requestId": payload["requestId"],
        "status": "failed",
        "documentVersionId": "doc-version-1",
        "extractedMetadata": None,
        "documentSummary": None,
        "extractionQuality": 0.0,
        "errors": [
            {
                "code": "WORKFLOW_UNAVAILABLE",
                "message": "Source processing unavailable; retry or request review.",
            }
        ],
        "pages": [],
    }


def test_index_and_profile_stubs_return_contract_valid_failures(client: TestClient) -> None:
    index_payload = contract_request(
        tenantId="tenant-1",
        originalFileId="file-1",
        documentId="doc-1",
        documentVersionId="doc-version-1",
        approvalState="APPROVED",
        reviewedMetadata={"title": "Manual", "revision": "A"},
        sourceFile=SOURCE_FILE,
    )
    profile_payload = contract_request(
        tenantId="tenant-1",
        inputFingerprint="b" * 64,
        entity={
            "type": "EQUIPMENT",
            "id": "equipment-1",
            "profileVersion": 1,
            "activeDocuments": [],
        },
    )

    index_response = post(client, "/v1/ingestions/index", index_payload)
    profile_response = post(client, "/v1/entity-profiles/upsert", profile_payload)

    assert index_response.status_code == 200
    assert index_response.json()["status"] == "failed"
    assert index_response.json()["chunkCount"] == 0
    assert profile_response.status_code == 200
    assert profile_response.json()["status"] == "failed"
    assert profile_response.json()["profileFingerprint"] == "b" * 64
    assert profile_response.json()["provenance"]["tenantId"] == "tenant-1"


def test_question_stub_returns_no_unsupported_answer_or_citations(client: TestClient) -> None:
    payload = contract_request(
        actor={"id": "user-1", "tenantId": "tenant-1"},
        chatSession={"id": "chat-1", "recentTurns": []},
        assignedReferences=[],
        question="What is the current maintenance status?",
        retrievalScopeManifest={
            "allowedDocumentVersions": [],
            "entities": [],
            "relationships": [],
        },
        retrievalPolicy={
            "approvedOnly": True,
            "requireSourceLocation": True,
            "allowStructuralFallback": True,
        },
    )

    response = post(client, "/v1/questions", payload)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "incomplete"
    assert body["answer"] == {"summary": None, "steps": []}
    assert body["citations"] == []


def test_log_and_procedure_stubs_require_human_work(client: TestClient) -> None:
    log_payload = contract_request(
        projectId="project-1",
        scopeType="PROJECT",
        sourceText="Observed a pressure change.",
        citationIds=[],
    )
    procedure_payload = contract_request(
        tenantId="tenant-1",
        retrievalScopeManifest={
            "allowedDocumentVersions": [
                {
                    "documentId": "doc-1",
                    "documentVersionId": "doc-version-1",
                    "inclusionPaths": ["PROJECT_DIRECT"],
                    "sourceEntityIds": ["project-1"],
                }
            ],
            "entities": [
                {
                    "type": "PROJECT",
                    "id": "project-1",
                    "profileState": "MISSING",
                    "directDocumentVersionIds": ["doc-version-1"],
                }
            ],
            "relationships": [],
        },
        generationRequestId="generation-1",
        projectId="project-1",
        projectDescription="Compressor maintenance",
        inputFingerprint="fingerprint-1",
        timezone="Asia/Calcutta",
        activeSources=[
            {
                "documentVersionId": "doc-version-1",
                "documentTitle": "Manual",
                "revision": "A",
                "inclusionPath": "PROJECT_DIRECT",
            }
        ],
        supplementalEquipmentSources=[],
    )

    log_response = post(client, "/v1/log-drafts", log_payload)
    procedure_response = post(client, "/v1/procedure-drafts", procedure_payload)

    assert log_response.status_code == 200
    assert log_response.json()["status"] == "unavailable"
    assert log_response.json()["draftText"] is None
    assert procedure_response.status_code == 200
    assert procedure_response.json()["status"] == "unavailable"
    assert procedure_response.json()["requiresHumanReview"] is True
    assert procedure_response.json()["reviewAnalysis"]["reviewNeed"] == "SEVERE"


def test_validation_errors_do_not_echo_request_values(client: TestClient) -> None:
    payload = contract_request(
        actor={"id": "user-1", "tenantId": "tenant-1"},
        question="value-that-must-not-be-echoed",
    )

    response = post(client, "/v1/questions", payload)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_REQUEST"
    assert "value-that-must-not-be-echoed" not in response.text
