from typing import Any

from pydantic import ValidationError

from patch_ai.config import Settings
from patch_ai.schemas.contracts import CitableVectorRecord, QuestionRequest

PineconeFilter = dict[str, Any]


def build_source_chunk_filter(
    request: QuestionRequest, settings: Settings
) -> PineconeFilter | None:
    """Return a closed source filter, or None when querying must not occur."""
    version_ids = sorted(
        {
            item.document_version_id
            for item in request.retrieval_scope_manifest.allowed_document_versions
        }
    )
    if not version_ids:
        return None
    return {
        "$and": [
            {"tenantId": {"$eq": request.actor.tenant_id}},
            {"environment": {"$eq": settings.pinecone_namespace}},
            {"recordType": {"$eq": "SOURCE_CHUNK"}},
            {"documentVersionId": {"$in": version_ids}},
        ]
    }


def build_entity_profile_filter(
    request: QuestionRequest, settings: Settings
) -> PineconeFilter | None:
    """Return a closed profile filter, or None when no profile is authorized."""
    profile_ids = sorted(
        {
            entity.profile_id
            for entity in request.retrieval_scope_manifest.entities
            if entity.profile_id is not None and entity.profile_state != "MISSING"
        }
    )
    if not profile_ids:
        return None
    return {
        "$and": [
            {"tenantId": {"$eq": request.actor.tenant_id}},
            {"environment": {"$eq": settings.pinecone_namespace}},
            {"recordType": {"$eq": "ENTITY_PROFILE"}},
            {"profileId": {"$in": profile_ids}},
        ]
    }


def validate_citable_record(record: dict[str, object]) -> CitableVectorRecord:
    """Only SOURCE_CHUNK records can enter the citation assembly boundary."""
    try:
        return CitableVectorRecord.model_validate(record)
    except ValidationError as error:
        raise ValueError("Only authorized SOURCE_CHUNK records are citable") from error
