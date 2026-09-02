import hashlib
from uuid import NAMESPACE_URL, uuid5

from patch_ai.schemas.contracts import (
    Answer,
    ChatSessionResult,
    EntityProfileRequest,
    EntityProfileResult,
    ExtractRequest,
    ExtractResult,
    IndexRequest,
    IndexResult,
    LogDraftRequest,
    LogDraftResult,
    ProcedureDraftRequest,
    ProcedureDraftResult,
    QuestionRequest,
    QuestionResult,
    ReviewAnalysis,
    RoutingResult,
    ServiceError,
)

PHASE_ONE_UNAVAILABLE = ServiceError(
    code="PHASE_1_STUB",
    message="The workflow contract is available; provider execution starts in its delivery phase.",
)


def extract_stub(request: ExtractRequest) -> ExtractResult:
    return ExtractResult(
        request_id=request.request_id,
        status="failed",
        document_version_id=request.document_version_id,
        extraction_quality=0,
        errors=[PHASE_ONE_UNAVAILABLE],
    )


def index_stub(request: IndexRequest) -> IndexResult:
    return IndexResult(
        request_id=request.request_id,
        status="failed",
        document_version_id=request.document_version_id,
        chunk_count=0,
        errors=[PHASE_ONE_UNAVAILABLE],
    )


def entity_profile_stub(request: EntityProfileRequest) -> EntityProfileResult:
    entity = request.entity
    fingerprint = hashlib.sha256(
        request.model_dump_json(by_alias=True, exclude={"request_id"}).encode()
    ).hexdigest()
    return EntityProfileResult(
        request_id=request.request_id,
        status="failed",
        entity_id=entity.id,
        profile_version=entity.profile_version,
        profile_id=f"entity-profile:{entity.id}:{entity.profile_version}",
        generated_description="",
        profile_fingerprint=fingerprint,
        errors=[PHASE_ONE_UNAVAILABLE],
    )


def question_stub(request: QuestionRequest) -> QuestionResult:
    turn_id = str(uuid5(NAMESPACE_URL, f"patch:question:{request.request_id}"))
    return QuestionResult(
        request_id=request.request_id,
        chat_session=ChatSessionResult(
            id=request.chat_session.id,
            suggested_title="New maintenance question",
        ),
        turn_id=turn_id,
        status="unavailable",
        routing=RoutingResult(selected_entities=[], used_structural_fallback=False),
        answer=Answer(summary=None, steps=[]),
        citations=[],
        warnings=[PHASE_ONE_UNAVAILABLE.message],
        follow_up_allowed=True,
    )


def log_draft_stub(request: LogDraftRequest) -> LogDraftResult:
    return LogDraftResult(
        request_id=request.request_id,
        status="unavailable",
        draft_text=None,
        citation_ids=[],
        warnings=[PHASE_ONE_UNAVAILABLE.message],
    )


def procedure_draft_stub(request: ProcedureDraftRequest) -> ProcedureDraftResult:
    return ProcedureDraftResult(
        request_id=request.request_id,
        generation_request_id=request.generation_request_id,
        input_fingerprint=request.input_fingerprint,
        status="unavailable",
        title=None,
        review_analysis=ReviewAnalysis(
            review_need="SEVERE",
            source_coverage="NOT_EVALUATED",
            conflicts="NOT_EVALUATED",
            freshness="NOT_EVALUATED",
            hardware_criticality="NOT_EVALUATED",
            blocking_findings=["Procedure generation is unavailable."],
            reasons=[PHASE_ONE_UNAVAILABLE.message],
        ),
        steps=[],
        citations=[],
        requires_human_review=True,
    )
