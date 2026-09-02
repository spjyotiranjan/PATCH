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


class ExtractResult(ApiModel):
    request_id: UUID
    status: Literal["needs_review", "failed"]
    document_version_id: Identifier
    extracted_metadata: ExtractedMetadata | None = None
    document_summary: DocumentSummary | None = None
    extraction_quality: float = Field(ge=0, le=1)
    errors: list[ServiceError] = Field(default_factory=list)


class ReviewedMetadata(ApiModel):
    title: str = Field(min_length=1, max_length=500)
    revision: str = Field(min_length=1, max_length=100)


class IndexRequest(ContractRequest):
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
    profile_fingerprint: Identifier
    freshness_state: Literal["FRESH", "STALE"]
    generated_description: str
    coverage_topics: list[str] = Field(default_factory=list)


class ActiveDocument(ApiModel):
    document_id: Identifier
    document_version_id: Identifier
    title: str
    document_summary: str
    inclusion: Literal["EQUIPMENT_DIRECT", "PROJECT_DIRECT", "EQUIPMENT_DERIVED"]


class EntityProfileInput(ApiModel):
    type: Literal["EQUIPMENT", "PROJECT"]
    id: Identifier
    profile_version: int = Field(ge=1)
    user_description: str | None = None
    included_equipment_profiles: list[IncludedEquipmentProfile] = Field(default_factory=list)
    active_documents: list[ActiveDocument] = Field(default_factory=list)


class EntityProfileRequest(ContractRequest):
    entity: EntityProfileInput


class ProfileCoverage(ApiModel):
    topic: str
    document_version_ids: list[Identifier]


class EntityProfileResult(ApiModel):
    request_id: UUID
    status: Literal["upserted", "failed"]
    entity_id: Identifier
    profile_version: int = Field(ge=1)
    profile_id: Identifier
    generated_description: str
    coverage: list[ProfileCoverage] = Field(default_factory=list)
    profile_fingerprint: str
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
    inclusion_paths: list[str]
    source_entity_ids: list[Identifier] = Field(default_factory=list)


class ManifestEntity(ApiModel):
    type: Literal["EQUIPMENT", "PROJECT"]
    id: Identifier
    profile_id: Identifier | None = None
    profile_version: int | None = Field(default=None, ge=1)
    profile_state: Literal["FRESH", "STALE", "MISSING"]
    direct_document_version_ids: list[Identifier] = Field(default_factory=list)


class ManifestRelationship(ApiModel):
    project_id: Identifier
    equipment_ids: list[Identifier] = Field(default_factory=list)
    direct_document_version_ids: list[Identifier] = Field(default_factory=list)


class RetrievalScopeManifest(ApiModel):
    allowed_document_versions: list[AllowedDocumentVersion] = Field(default_factory=list)
    entities: list[ManifestEntity] = Field(default_factory=list)
    relationships: list[ManifestRelationship] = Field(default_factory=list)


class RetrievalPolicy(ApiModel):
    approved_only: Literal[True] = True
    require_source_location: Literal[True] = True
    allow_structural_fallback: bool = True


class QuestionRequest(ContractRequest):
    actor: Actor
    chat_session: ChatSessionInput
    assigned_references: list[AssignedReference] = Field(default_factory=list)
    question: str = Field(min_length=1, max_length=10_000)
    retrieval_scope_manifest: RetrievalScopeManifest
    retrieval_policy: RetrievalPolicy


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
    generation_request_id: Identifier
    project_id: Identifier
    project_description: str = Field(min_length=1, max_length=20_000)
    input_fingerprint: Identifier
    timezone: str = Field(min_length=1, max_length=100)
    active_sources: list[ProcedureSource] = Field(min_length=1)
    supplemental_equipment_sources: list[SupplementalEquipmentSource] = Field(default_factory=list)


class ReviewAnalysis(ApiModel):
    review_need: Literal["LOW", "MODERATE", "HIGH", "SEVERE"]
    source_coverage: str
    conflicts: str
    freshness: str
    hardware_criticality: str
    blocking_findings: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)


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
