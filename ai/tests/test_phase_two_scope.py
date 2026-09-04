from copy import deepcopy
from uuid import uuid4

import pytest
from pydantic import ValidationError

from patch_ai.config import Settings
from patch_ai.schemas.contracts import EntityProfileRequest, QuestionRequest
from patch_ai.services.phase_two_profiles import generate_profile_stub
from patch_ai.services.scope_validation import (
    build_entity_profile_filter,
    build_source_chunk_filter,
    validate_citable_record,
)


def question_payload() -> dict[str, object]:
    return {
        "requestId": str(uuid4()),
        "contractVersion": "v1",
        "actor": {"id": "user-1", "tenantId": "tenant-1"},
        "chatSession": {"id": "chat-1", "recentTurns": []},
        "assignedReferences": [{"type": "PROJECT", "id": "project-1"}],
        "question": "Where should retrieval be scoped?",
        "retrievalScopeManifest": {
            "allowedDocumentVersions": [
                {
                    "documentId": "document-1",
                    "documentVersionId": "version-1",
                    "inclusionPaths": ["PROJECT_DIRECT"],
                    "sourceEntityIds": ["project-1"],
                },
                {
                    "documentId": "document-2",
                    "documentVersionId": "version-2",
                    "inclusionPaths": ["EQUIPMENT_DERIVED"],
                    "sourceEntityIds": ["equipment-1", "project-1"],
                },
            ],
            "entities": [
                {
                    "type": "PROJECT",
                    "id": "project-1",
                    "profileId": "profile-project-1",
                    "profileVersion": 2,
                    "profileState": "FRESH",
                    "directDocumentVersionIds": ["version-1"],
                },
                {
                    "type": "EQUIPMENT",
                    "id": "equipment-1",
                    "profileId": "profile-equipment-1",
                    "profileVersion": 3,
                    "profileState": "STALE",
                    "directDocumentVersionIds": ["version-2"],
                },
            ],
            "relationships": [
                {
                    "projectId": "project-1",
                    "equipmentIds": ["equipment-1"],
                    "directDocumentVersionIds": ["version-1"],
                }
            ],
        },
        "retrievalPolicy": {
            "approvedOnly": True,
            "requireSourceLocation": True,
            "allowStructuralFallback": True,
        },
    }


def test_filter_builders_are_tenant_record_type_and_id_bounded() -> None:
    request = QuestionRequest.model_validate(question_payload())
    settings = Settings(pinecone_namespace="test-namespace")

    assert build_source_chunk_filter(request, settings) == {
        "$and": [
            {"tenantId": {"$eq": "tenant-1"}},
            {"environment": {"$eq": "test-namespace"}},
            {"recordType": {"$eq": "SOURCE_CHUNK"}},
            {"documentVersionId": {"$in": ["version-1", "version-2"]}},
        ]
    }
    assert build_entity_profile_filter(request, settings) == {
        "$and": [
            {"tenantId": {"$eq": "tenant-1"}},
            {"environment": {"$eq": "test-namespace"}},
            {"recordType": {"$eq": "ENTITY_PROFILE"}},
            {"profileId": {"$in": ["profile-equipment-1", "profile-project-1"]}},
        ]
    }


def test_empty_scope_disables_queries_instead_of_broadening() -> None:
    payload = question_payload()
    payload["assignedReferences"] = []
    payload["retrievalScopeManifest"] = {
        "allowedDocumentVersions": [],
        "entities": [],
        "relationships": [],
    }
    request = QuestionRequest.model_validate(payload)

    assert build_source_chunk_filter(request, Settings()) is None
    assert build_entity_profile_filter(request, Settings()) is None


@pytest.mark.parametrize(
    "mutation",
    [
        "duplicate_document",
        "unknown_entity_document",
        "unknown_relationship_equipment",
        "non_project_relationship_document",
        "unauthorized_assignment",
    ],
)
def test_invalid_or_inaccessible_scope_is_rejected(mutation: str) -> None:
    payload = question_payload()
    manifest = payload["retrievalScopeManifest"]
    assert isinstance(manifest, dict)
    if mutation == "duplicate_document":
        documents = manifest["allowedDocumentVersions"]
        assert isinstance(documents, list)
        documents.append(dict(documents[0]))
    elif mutation == "unknown_entity_document":
        entities = manifest["entities"]
        assert isinstance(entities, list)
        entities[0]["directDocumentVersionIds"] = ["not-allowed"]
    elif mutation == "unknown_relationship_equipment":
        relationships = manifest["relationships"]
        assert isinstance(relationships, list)
        relationships[0]["equipmentIds"] = ["not-authorized"]
    elif mutation == "non_project_relationship_document":
        relationships = manifest["relationships"]
        assert isinstance(relationships, list)
        relationships[0]["directDocumentVersionIds"] = ["version-2"]
    else:
        payload["assignedReferences"] = [{"type": "EQUIPMENT", "id": "not-authorized"}]

    with pytest.raises(ValidationError):
        QuestionRequest.model_validate(payload)


def test_entity_profile_contract_enforces_provenance_and_project_description() -> None:
    payload = {
        "requestId": str(uuid4()),
        "contractVersion": "v1",
        "tenantId": "tenant-1",
        "inputFingerprint": "c" * 64,
        "entity": {
            "type": "PROJECT",
            "id": "project-1",
            "profileVersion": 4,
            "userDescription": "Replace the north line compressor safely.",
            "includedEquipmentProfiles": [],
            "activeDocuments": [
                {
                    "documentId": "document-1",
                    "documentVersionId": "version-1",
                    "title": "Compressor manual",
                    "documentSummary": "Approved operating coverage.",
                    "inclusion": "PROJECT_DIRECT",
                }
            ],
        },
    }
    request = EntityProfileRequest.model_validate(payload)
    result = generate_profile_stub(request)

    assert result.status == "upserted"
    assert result.profile_fingerprint == "c" * 64
    assert result.provenance.tenant_id == "tenant-1"
    assert result.provenance.document_version_ids == ["version-1"]
    assert result.coverage[0].document_version_ids == ["version-1"]
    assert result.search_hints == ["Compressor manual"]

    invalid_payload = deepcopy(payload)
    invalid_payload["entity"] = {
        **invalid_payload["entity"],
        "userDescription": None,
    }
    with pytest.raises(ValidationError):
        EntityProfileRequest.model_validate(invalid_payload)


def test_entity_profile_records_cannot_enter_citation_boundary() -> None:
    source = validate_citable_record(
        {
            "recordType": "SOURCE_CHUNK",
            "tenantId": "tenant-1",
            "documentVersionId": "version-1",
            "chunkId": "chunk-1",
        }
    )
    assert source.record_type == "SOURCE_CHUNK"

    with pytest.raises(ValueError, match="SOURCE_CHUNK"):
        validate_citable_record(
            {
                "recordType": "ENTITY_PROFILE",
                "tenantId": "tenant-1",
                "documentVersionId": "version-1",
                "chunkId": "profile-1",
            }
        )
