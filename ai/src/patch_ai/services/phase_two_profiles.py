from patch_ai.schemas.contracts import (
    EntityProfileRequest,
    EntityProfileResult,
    ProfileCoverage,
    ProfileProvenance,
)


def generate_profile_stub(request: EntityProfileRequest) -> EntityProfileResult:
    """Build deterministic routing metadata without calling a model or vector store."""
    entity = request.entity
    coverage = [
        ProfileCoverage(
            topic=document.title,
            document_version_ids=[document.document_version_id],
        )
        for document in entity.active_documents
    ]
    description_parts = [
        entity.user_description.strip()
        if entity.user_description
        else f"{entity.type.title()} {entity.id} has no user description.",
    ]
    if entity.active_documents:
        description_parts.append(
            "Active source coverage: "
            + ", ".join(document.title for document in entity.active_documents)
            + "."
        )
    else:
        description_parts.append("No active source summaries are currently attached.")

    return EntityProfileResult(
        request_id=request.request_id,
        status="upserted",
        entity_id=entity.id,
        profile_version=entity.profile_version,
        profile_id=(f"entity-profile:{entity.type.lower()}:{entity.id}:{entity.profile_version}"),
        generated_description=" ".join(description_parts),
        systems=[],
        components=[],
        capabilities=[],
        failure_modes=[],
        search_hints=[document.title for document in entity.active_documents],
        coverage=coverage,
        profile_fingerprint=request.input_fingerprint.lower(),
        provenance=ProfileProvenance(
            tenant_id=request.tenant_id,
            input_fingerprint=request.input_fingerprint.lower(),
            document_version_ids=[
                document.document_version_id for document in entity.active_documents
            ],
            included_equipment_profile_fingerprints=[
                profile.profile_fingerprint for profile in entity.included_equipment_profiles
            ],
        ),
        errors=[],
    )
