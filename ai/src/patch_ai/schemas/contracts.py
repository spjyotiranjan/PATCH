from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, StringConstraints, model_validator


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


Identifier = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Sha256 = Annotated[str, StringConstraints(pattern=r"^[a-fA-F0-9]{64}$")]


class HealthStatus(ApiModel):
    service: Literal["patch-ai"] = "patch-ai"
    status: Literal["available"] = "available"


class ReadinessStatus(ApiModel):
    service: Literal["patch-ai"] = "patch-ai"
    status: Literal["ready", "unavailable"]


class ErrorDetail(ApiModel):
    code: str
    fields: list[str] | None = None


class ApiErrorResponse(ApiModel):
    error: ErrorDetail
    request_id: UUID


class ServiceError(ApiModel):
    code: str
    message: str


class ContractRequest(ApiModel):
    request_id: UUID
    contract_version: Literal["v1"]


class SourceFile(ApiModel):
    url: AnyHttpUrl
    content_type: str
    sha256: Sha256


class VisualBounds(ApiModel):
    """Top-left origin, normalized to the displayed (rotation-applied) PDF page."""

    left: float = Field(default=0, ge=0, le=1, allow_inf_nan=False)
    top: float = Field(default=0, ge=0, le=1, allow_inf_nan=False)
    right: float = Field(default=1, ge=0, le=1, allow_inf_nan=False)
    bottom: float = Field(default=1, ge=0, le=1, allow_inf_nan=False)

    @model_validator(mode="after")
    def validate_area(self) -> "VisualBounds":
        if self.left >= self.right or self.top >= self.bottom:
            raise ValueError("visual bounds must have positive area")
        return self


class VisualRenderRequest(ContractRequest):
    tenant_id: Identifier
    asset_id: Identifier
    document_id: Identifier
    document_version_id: Identifier
    approval_state: Literal["APPROVED"]
    source_file: SourceFile
    page: int = Field(ge=1, le=500)
    bounds: VisualBounds = Field(default_factory=VisualBounds)
    render_dpi: int = Field(ge=72, le=200)
    renderer_version: Literal["pdfium-png-v1"] = "pdfium-png-v1"


class VisualSourceAsset(ApiModel):
    asset_id: Identifier
    document_id: Identifier
    document_version_id: Identifier
    page: int = Field(ge=1, le=500)
    bounds: VisualBounds
    original_sha256: Sha256
    sha256: Sha256
    content_type: Literal["image/png"] = "image/png"
    byte_count: int = Field(ge=1, le=2_000_000)
    width: int = Field(ge=1, le=4096)
    height: int = Field(ge=1, le=4096)
    render_dpi: int = Field(ge=72, le=200)
    renderer_version: Literal["pdfium-png-v1"] = "pdfium-png-v1"


class VisualRenderResult(ApiModel):
    request_id: UUID
    status: Literal["rendered", "failed"]
    asset: VisualSourceAsset | None = None
    png_base64: str | None = Field(default=None, max_length=2_666_668)
    errors: list[ServiceError] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def validate_result(self) -> "VisualRenderResult":
        if self.status == "rendered":
            if self.asset is None or not self.png_base64 or self.errors:
                raise ValueError("rendered result requires a complete asset")
        elif self.asset is not None or self.png_base64 is not None:
            raise ValueError("failed render cannot expose partial content")
        return self


class VisualDescription(ApiModel):
    description_version: Literal["vision-description-v1"] = "vision-description-v1"
    summary: str = Field(min_length=1, max_length=4000)
    labels: list[Annotated[str, Field(min_length=1, max_length=200)]] = Field(max_length=50)
    relationships: list[Annotated[str, Field(min_length=1, max_length=500)]] = Field(max_length=30)
    uncertainties: list[Annotated[str, Field(min_length=1, max_length=500)]] = Field(max_length=20)


class VisualDescribeRequest(ContractRequest):
    tenant_id: Identifier
    approval_state: Literal["APPROVED"]
    asset: VisualSourceAsset
    source_file: SourceFile

    @model_validator(mode="after")
    def validate_source(self) -> "VisualDescribeRequest":
        if (
            self.source_file.content_type != "image/png"
            or self.source_file.sha256.lower() != self.asset.sha256.lower()
            or self.asset.width * self.asset.height > 4_000_000
        ):
            raise ValueError("visual source provenance mismatch")
        return self


class VisualDescribeResult(ApiModel):
    request_id: UUID
    asset_id: Identifier
    sha256: Sha256
    status: Literal["described", "failed"]
    description: VisualDescription | None = None
    errors: list[ServiceError] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def validate_description(self) -> "VisualDescribeResult":
        if self.status == "described":
            if self.description is None or self.errors:
                raise ValueError("described result requires a complete description")
        elif self.description is not None:
            raise ValueError("failed description cannot expose partial content")
        return self


class DeclaredMetadata(ApiModel):
    title: str = Field(min_length=1, max_length=500)
    document_type: str = Field(min_length=1, max_length=100)


class DocumentSummary(ApiModel):
    summary: str
    capabilities: list[str] = Field(default_factory=list)
    systems: list[str] = Field(default_factory=list)
    search_hints: list[str] = Field(default_factory=list)


class ExtractRequest(ContractRequest):
    document_id: Identifier
    document_version_id: Identifier
    version_number: Identifier
    source_file: SourceFile
    declared_metadata: DeclaredMetadata


class ExtractedMetadata(ApiModel):
    title: str
    language: str | None = None
    page_count: int | None = Field(default=None, ge=0)
    sections: list[str] = Field(default_factory=list)


class ExtractedPage(ApiModel):
    page: int = Field(ge=1)
    section: str
    text: str = Field(max_length=200_000)
    quality: float = Field(ge=0, le=1)


class ExtractResult(ApiModel):
    request_id: UUID
    status: Literal["needs_review", "failed"]
    document_version_id: Identifier
    extracted_metadata: ExtractedMetadata | None = None
    document_summary: DocumentSummary | None = None
    extraction_quality: float = Field(ge=0, le=1)
    errors: list[ServiceError] = Field(default_factory=list)
    pages: list[ExtractedPage] = Field(default_factory=list, max_length=500)


class ReviewedMetadata(ApiModel):
    title: str = Field(min_length=1, max_length=500)
    revision: str = Field(min_length=1, max_length=100)
    document_type: str = Field(default="MANUAL", max_length=100)


class IndexRequest(ContractRequest):
    tenant_id: Identifier
    original_file_id: Identifier
    document_id: Identifier
    document_version_id: Identifier
    approval_state: Literal["APPROVED"]
    reviewed_metadata: ReviewedMetadata
    source_file: SourceFile


class SourceLocation(ApiModel):
    page: int | None = Field(default=None, ge=1)
    section: str | None = None


class IndexResult(ApiModel):
    request_id: UUID
    status: Literal["indexed", "failed"]
    document_version_id: Identifier
    chunk_count: int = Field(ge=0)
    index_reference: str | None = None
    source_locations: list[SourceLocation] = Field(default_factory=list)
    content_fingerprint: str | None = None
    errors: list[ServiceError] = Field(default_factory=list)


class IncludedEquipmentProfile(ApiModel):
    equipment_id: Identifier
    profile_id: Identifier
    profile_version: int = Field(ge=1)
    profile_fingerprint: Sha256
    freshness_state: Literal["FRESH", "STALE"]
    generated_description: str = Field(min_length=1, max_length=20_000)
    coverage_topics: list[str] = Field(default_factory=list, max_length=100)


class ActiveDocument(ApiModel):
    document_id: Identifier
    document_version_id: Identifier
    title: str = Field(min_length=1, max_length=500)
    document_summary: str = Field(min_length=1, max_length=20_000)
    inclusion: Literal["EQUIPMENT_DIRECT", "PROJECT_DIRECT", "EQUIPMENT_DERIVED"]


class EntityProfileInput(ApiModel):
    type: Literal["EQUIPMENT", "PROJECT"]
    id: Identifier
    profile_version: int = Field(ge=1)
    user_description: str | None = Field(default=None, max_length=20_000)
    included_equipment_profiles: list[IncludedEquipmentProfile] = Field(
        default_factory=list, max_length=100
    )
    active_documents: list[ActiveDocument] = Field(default_factory=list, max_length=500)
    workflow_coverage: list[Annotated[str, StringConstraints(min_length=1, max_length=500)]] = (
        Field(default_factory=list, max_length=100)
    )

    @model_validator(mode="after")
    def validate_profile_scope(self) -> "EntityProfileInput":
        equipment_ids = [item.equipment_id for item in self.included_equipment_profiles]
        profile_ids = [item.profile_id for item in self.included_equipment_profiles]
        document_ids = [item.document_id for item in self.active_documents]
        version_ids = [item.document_version_id for item in self.active_documents]
        if len(set(equipment_ids)) != len(equipment_ids) or len(set(profile_ids)) != len(
            profile_ids
        ):
            raise ValueError("included Equipment profiles must be unique")
        if len(set(document_ids)) != len(document_ids) or len(set(version_ids)) != len(version_ids):
            raise ValueError("active documents must be unique")
        if self.type == "PROJECT" and not (self.user_description or "").strip():
            raise ValueError("userDescription is required for PROJECT profiles")
        if self.type == "EQUIPMENT" and self.included_equipment_profiles:
            raise ValueError("EQUIPMENT profiles cannot include Equipment profiles")
        if self.type == "EQUIPMENT" and self.workflow_coverage:
            raise ValueError("workflow coverage belongs to PROJECT profiles")
        return self


class EntityProfileRequest(ContractRequest):
    tenant_id: Identifier
    input_fingerprint: Sha256
    entity: EntityProfileInput


class ProfileCoverage(ApiModel):
    topic: str = Field(min_length=1, max_length=500)
    document_version_ids: list[Identifier] = Field(max_length=500)


class ProfileProvenance(ApiModel):
    tenant_id: Identifier
    input_fingerprint: Sha256
    document_version_ids: list[Identifier] = Field(default_factory=list)
    included_equipment_profile_fingerprints: list[Sha256] = Field(default_factory=list)


class EntityProfileResult(ApiModel):
    request_id: UUID
    status: Literal["upserted", "failed"]
    entity_id: Identifier
    profile_version: int = Field(ge=1)
    profile_id: Identifier
    generated_description: str = Field(min_length=1, max_length=20_000)
    systems: list[str] = Field(default_factory=list, max_length=100)
    components: list[str] = Field(default_factory=list, max_length=200)
    capabilities: list[str] = Field(default_factory=list, max_length=200)
    failure_modes: list[str] = Field(default_factory=list, max_length=200)
    search_hints: list[str] = Field(default_factory=list, max_length=200)
    coverage: list[ProfileCoverage] = Field(default_factory=list, max_length=500)
    profile_fingerprint: Sha256
    provenance: ProfileProvenance
    errors: list[ServiceError] = Field(default_factory=list)


class Actor(ApiModel):
    id: Identifier
    tenant_id: Identifier


class ChatTurnContext(ApiModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=20_000)


class ChatSessionInput(ApiModel):
    id: Identifier
    recent_turns: list[ChatTurnContext] = Field(default_factory=list, max_length=20)


class AssignedReference(ApiModel):
    type: Literal["DOCUMENT", "EQUIPMENT", "PROJECT", "ENTITY"]
    id: Identifier


class AllowedDocumentVersion(ApiModel):
    document_id: Identifier
    document_version_id: Identifier
    inclusion_paths: list[
        Literal[
            "PERSONAL",
            "PROJECT_DIRECT",
            "EQUIPMENT_DERIVED",
            "PROJECT_PROCEDURE",
            "PROJECT_LOG",
        ]
    ] = Field(min_length=1)
    source_entity_ids: list[Identifier] = Field(default_factory=list, max_length=200)

    @model_validator(mode="after")
    def validate_unique_paths(self) -> "AllowedDocumentVersion":
        if len(set(self.inclusion_paths)) != len(self.inclusion_paths):
            raise ValueError("inclusionPaths must be unique")
        if len(set(self.source_entity_ids)) != len(self.source_entity_ids):
            raise ValueError("sourceEntityIds must be unique")
        return self


class ManifestEntity(ApiModel):
    type: Literal["EQUIPMENT", "PROJECT"]
    id: Identifier
    profile_id: Identifier | None = None
    profile_version: int | None = Field(default=None, ge=1)
    profile_state: Literal["FRESH", "STALE", "MISSING"]
    direct_document_version_ids: list[Identifier] = Field(default_factory=list, max_length=500)

    @model_validator(mode="after")
    def validate_profile_reference(self) -> "ManifestEntity":
        if len(set(self.direct_document_version_ids)) != len(self.direct_document_version_ids):
            raise ValueError("directDocumentVersionIds must be unique")
        if self.profile_state == "MISSING":
            if self.profile_id is not None or self.profile_version is not None:
                raise ValueError("MISSING profiles cannot include a profile reference")
        elif self.profile_id is None or self.profile_version is None:
            raise ValueError("FRESH or STALE profiles require an id and version")
        return self


class ManifestRelationship(ApiModel):
    project_id: Identifier
    equipment_ids: list[Identifier] = Field(default_factory=list, max_length=200)
    direct_document_version_ids: list[Identifier] = Field(default_factory=list, max_length=500)

    @model_validator(mode="after")
    def validate_unique_relationship_values(self) -> "ManifestRelationship":
        if len(set(self.equipment_ids)) != len(self.equipment_ids):
            raise ValueError("equipmentIds must be unique")
        if len(set(self.direct_document_version_ids)) != len(self.direct_document_version_ids):
            raise ValueError("directDocumentVersionIds must be unique")
        return self


class RetrievalScopeManifest(ApiModel):
    allowed_document_versions: list[AllowedDocumentVersion] = Field(
        default_factory=list, max_length=1_000
    )
    entities: list[ManifestEntity] = Field(default_factory=list, max_length=500)
    relationships: list[ManifestRelationship] = Field(default_factory=list, max_length=200)

    @model_validator(mode="after")
    def validate_scope_graph(self) -> "RetrievalScopeManifest":
        document_ids = [item.document_id for item in self.allowed_document_versions]
        version_ids = [item.document_version_id for item in self.allowed_document_versions]
        entity_keys = [(item.type, item.id) for item in self.entities]
        profile_ids = [item.profile_id for item in self.entities if item.profile_id]
        project_ids = [item.project_id for item in self.relationships]

        if len(set(document_ids)) != len(document_ids) or len(set(version_ids)) != len(version_ids):
            raise ValueError("allowed document versions must be unique")
        if len(set(entity_keys)) != len(entity_keys):
            raise ValueError("manifest entities must be unique")
        if len(set(profile_ids)) != len(profile_ids):
            raise ValueError("profileIds must be unique")
        if len(set(project_ids)) != len(project_ids):
            raise ValueError("manifest relationships must be unique by projectId")

        allowed_versions = set(version_ids)
        known_entity_ids = {item.id for item in self.entities}
        equipment_ids = {item.id for item in self.entities if item.type == "EQUIPMENT"}
        projects = {item.id for item in self.entities if item.type == "PROJECT"}
        entity_documents = {
            item.id: set(item.direct_document_version_ids) for item in self.entities
        }

        for document in self.allowed_document_versions:
            if not set(document.source_entity_ids).issubset(known_entity_ids):
                raise ValueError("document sourceEntityIds must reference manifest entities")
        for entity in self.entities:
            if not set(entity.direct_document_version_ids).issubset(allowed_versions):
                raise ValueError("entity documents must be allowed document versions")
        for relationship in self.relationships:
            if relationship.project_id not in projects:
                raise ValueError("relationship projectId must reference a PROJECT entity")
            if not set(relationship.equipment_ids).issubset(equipment_ids):
                raise ValueError("relationship equipmentIds must reference EQUIPMENT entities")
            if not set(relationship.direct_document_version_ids).issubset(allowed_versions):
                raise ValueError("relationship documents must be allowed document versions")
            if not set(relationship.direct_document_version_ids).issubset(
                entity_documents[relationship.project_id]
            ):
                raise ValueError("relationship documents must be direct Project documents")
        return self


class RetrievalPolicy(ApiModel):
    approved_only: Literal[True] = True
    require_source_location: Literal[True] = True
    allow_structural_fallback: bool = True


class QuestionRequest(ContractRequest):
    actor: Actor
    chat_session: ChatSessionInput
    assigned_references: list[AssignedReference] = Field(default_factory=list, max_length=50)
    question: str = Field(min_length=1, max_length=10_000)
    retrieval_scope_manifest: RetrievalScopeManifest
    retrieval_policy: RetrievalPolicy

    @model_validator(mode="after")
    def validate_assigned_references(self) -> "QuestionRequest":
        references = [(item.type, item.id) for item in self.assigned_references]
        if len(set(references)) != len(references):
            raise ValueError("assignedReferences must be unique")

        manifest = self.retrieval_scope_manifest
        document_ids = {item.document_id for item in manifest.allowed_document_versions}
        version_ids = {item.document_version_id for item in manifest.allowed_document_versions}
        equipment_ids = {item.id for item in manifest.entities if item.type == "EQUIPMENT"}
        project_ids = {item.id for item in manifest.entities if item.type == "PROJECT"}
        entity_ids = equipment_ids | project_ids
        for reference in self.assigned_references:
            allowed = (
                reference.id in document_ids | version_ids
                if reference.type == "DOCUMENT"
                else reference.id in equipment_ids
                if reference.type == "EQUIPMENT"
                else reference.id in project_ids
                if reference.type == "PROJECT"
                else reference.id in entity_ids
            )
            if not allowed:
                raise ValueError("assigned reference is outside the authorized manifest")
        return self


class CitableVectorRecord(ApiModel):
    record_type: Literal["SOURCE_CHUNK"]
    tenant_id: Identifier
    document_version_id: Identifier
    chunk_id: Identifier


class ChatSessionResult(ApiModel):
    id: Identifier
    suggested_title: str


class RoutedEntity(ApiModel):
    type: Literal["EQUIPMENT", "PROJECT"]
    id: Identifier
    reason: str


class RoutingResult(ApiModel):
    selected_entities: list[RoutedEntity] = Field(default_factory=list)
    used_structural_fallback: bool
    profile_versions: list[int] = Field(default_factory=list)


class AnswerStep(ApiModel):
    id: Identifier
    text: str
    citation_ids: list[Identifier]


class Answer(ApiModel):
    summary: str | None = None
    steps: list[AnswerStep] = Field(default_factory=list)


class Citation(ApiModel):
    id: Identifier
    document_id: Identifier | None = None
    chunk_id: Identifier | None = None
    document_version_id: Identifier
    document_title: str | None = None
    revision: str | None = None
    page: int | None = Field(default=None, ge=1)
    section: str | None = None
    excerpt: str
    approval_state: Literal["APPROVED"] | None = None


class QuestionResult(ApiModel):
    request_id: UUID
    chat_session: ChatSessionResult
    turn_id: Identifier
    status: Literal["approved", "incomplete", "conflicting", "outdated", "unavailable"]
    routing: RoutingResult
    answer: Answer
    citations: list[Citation] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    follow_up_allowed: bool


class LogScope(StrEnum):
    PROJECT = "PROJECT"
    EQUIPMENT = "EQUIPMENT"


class LogDraftRequest(ContractRequest):
    project_id: Identifier
    scope_type: LogScope
    equipment_id: Identifier | None = None
    source_text: str = Field(min_length=1, max_length=20_000)
    citation_ids: list[Identifier] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_scope(self) -> "LogDraftRequest":
        if self.scope_type == LogScope.EQUIPMENT and not self.equipment_id:
            raise ValueError("equipmentId is required for EQUIPMENT scope")
        if self.scope_type == LogScope.PROJECT and self.equipment_id is not None:
            raise ValueError("equipmentId must be absent for PROJECT scope")
        return self


class LogDraftResult(ApiModel):
    request_id: UUID
    status: Literal["drafted", "unavailable"]
    draft_text: str | None = None
    suggested_fields: dict[str, str] = Field(default_factory=dict)
    citation_ids: list[Identifier] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ProcedureSource(ApiModel):
    document_version_id: Identifier
    document_title: str
    revision: str
    inclusion_path: Literal["PROJECT_DIRECT"]


class SupplementalEquipmentSource(ApiModel):
    equipment_id: Identifier
    document_version_id: Identifier
    applicability: str = Field(min_length=1)


class ProcedureDraftRequest(ContractRequest):
    tenant_id: Identifier
    retrieval_scope_manifest: RetrievalScopeManifest
    generation_request_id: Identifier
    project_id: Identifier
    project_description: str = Field(min_length=1, max_length=20_000)
    input_fingerprint: Identifier
    timezone: str = Field(min_length=1, max_length=100)
    active_sources: list[ProcedureSource] = Field(min_length=1, max_length=500)
    supplemental_equipment_sources: list[SupplementalEquipmentSource] = Field(
        default_factory=list, max_length=100
    )

    @model_validator(mode="after")
    def source_scope(self) -> "ProcedureDraftRequest":
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        try:
            ZoneInfo(self.timezone)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise ValueError("valid IANA timezone required") from error
        direct = {
            item.document_version_id
            for item in self.retrieval_scope_manifest.allowed_document_versions
            if "PROJECT_DIRECT" in item.inclusion_paths
            and self.project_id in item.source_entity_ids
        }
        ids = [item.document_version_id for item in self.active_sources]
        if len(ids) != len(set(ids)) or not set(ids).issubset(direct):
            raise ValueError("procedure sources must be unique current direct Project sources")
        allowed = {
            item.document_version_id: item
            for item in self.retrieval_scope_manifest.allowed_document_versions
        }
        included = {
            equipment_id
            for relation in self.retrieval_scope_manifest.relationships
            if relation.project_id == self.project_id
            for equipment_id in relation.equipment_ids
        }
        supplemental_ids = [s.document_version_id for s in self.supplemental_equipment_sources]
        if len(supplemental_ids) != len(set(supplemental_ids)):
            raise ValueError("supplemental sources must be unique")
        for source in self.supplemental_equipment_sources:
            item = allowed.get(source.document_version_id)
            if (
                item is None
                or source.equipment_id not in included
                or source.equipment_id not in item.source_entity_ids
                or "EQUIPMENT_DERIVED" not in item.inclusion_paths
            ):
                raise ValueError("supplemental source is outside scope")
        return self


class ReviewAnalysis(ApiModel):
    review_need: Literal["LOW", "MODERATE", "HIGH", "SEVERE"]
    source_coverage: str
    conflicts: str
    freshness: str
    hardware_criticality: str
    blocking_findings: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)
    applicability: str = "UNKNOWN"
    required_topics: list[str] = Field(default_factory=list, max_length=100)
    missing_topics: list[str] = Field(default_factory=list, max_length=100)


class ProcedureStep(ApiModel):
    step_id: Identifier
    position: int = Field(ge=1)
    title: str
    instructions: str
    required: bool
    citation_ids: list[Identifier]
    evidence_state: str


class ProcedureDraftResult(ApiModel):
    request_id: UUID
    generation_request_id: Identifier
    input_fingerprint: Identifier
    status: Literal["generated", "unavailable"]
    title: str | None = None
    review_analysis: ReviewAnalysis
    steps: list[ProcedureStep] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    requires_human_review: Literal[True] = True


class RevalidationRequest(ProcedureDraftRequest):
    steps: list[ProcedureStep] = Field(min_length=1, max_length=100)


class StepCitationBinding(ApiModel):
    step_id: Identifier
    citation_ids: list[Identifier] = Field(min_length=1, max_length=8)


class RevalidationResult(ApiModel):
    step_citations: list[StepCitationBinding] = Field(default_factory=list, max_length=100)
    request_id: UUID
    status: Literal["validated", "needs_review", "unavailable"]
    supported_step_ids: list[Identifier] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    review_analysis: ReviewAnalysis


class DeleteVectorsRequest(ContractRequest):
    tenant_id: Identifier
    document_version_id: Identifier


class DeleteVectorsResult(ApiModel):
    request_id: UUID
    status: Literal["deleted", "failed"]


class QuestionSocketEvent(ApiModel):
    type: Literal["question.progress", "question.result", "question.error"]
    request_id: UUID
    stage: Literal["retrieving", "verifying"] | None = None
    result: QuestionResult | None = None
    code: str | None = None
