import logging
from typing import Any

from fastapi import APIRouter, Request

from patch_ai.config import Settings
from patch_ai.observability import log_event
from patch_ai.schemas.contracts import (
    ApiErrorResponse,
    EntityProfileRequest,
    EntityProfileResult,
    ExtractRequest,
    ExtractResult,
    HealthStatus,
    IndexRequest,
    IndexResult,
    LogDraftRequest,
    LogDraftResult,
    ProcedureDraftRequest,
    ProcedureDraftResult,
    QuestionRequest,
    QuestionResult,
    ReadinessStatus,
)
from patch_ai.services.phase_one_stubs import (
    extract_stub,
    index_stub,
    log_draft_stub,
    procedure_draft_stub,
    question_stub,
)
from patch_ai.services.phase_two_profiles import generate_profile_stub

router = APIRouter()

CONTRACT_ERRORS: dict[int | str, dict[str, Any]] = {
    400: {"model": ApiErrorResponse, "description": "Request correlation mismatch."},
    401: {"model": ApiErrorResponse, "description": "Service authentication failed."},
    409: {"model": ApiErrorResponse, "description": "Request ID replay detected."},
    422: {"model": ApiErrorResponse, "description": "Request schema validation failed."},
    500: {"model": ApiErrorResponse, "description": "Unexpected internal failure."},
    503: {"model": ApiErrorResponse, "description": "Service authentication unavailable."},
}


@router.get("/health", response_model=HealthStatus, tags=["system"])
async def health() -> HealthStatus:
    """Process liveness. This endpoint intentionally does not inspect dependencies."""
    return HealthStatus()


@router.get(
    "/readiness",
    response_model=ReadinessStatus,
    responses=CONTRACT_ERRORS,
    tags=["system"],
)
async def readiness(request: Request) -> ReadinessStatus:
    """Aggregate runtime readiness without exposing configuration names or values."""
    settings: Settings = request.app.state.settings
    unavailable_services = settings.unavailable_services()
    if unavailable_services:
        log_event(
            logging.ERROR,
            "patch_ai.readiness.unavailable",
            unavailableServices=unavailable_services,
        )
        return ReadinessStatus(status="unavailable")
    return ReadinessStatus(status="ready")


@router.post(
    "/v1/ingestions/extract",
    response_model=ExtractResult,
    responses=CONTRACT_ERRORS,
    tags=["ingestion"],
)
async def extract_document(request: ExtractRequest) -> ExtractResult:
    return extract_stub(request)


@router.post(
    "/v1/ingestions/index",
    response_model=IndexResult,
    responses=CONTRACT_ERRORS,
    tags=["ingestion"],
)
async def index_document(request: IndexRequest) -> IndexResult:
    return index_stub(request)


@router.post(
    "/v1/entity-profiles/upsert",
    response_model=EntityProfileResult,
    responses=CONTRACT_ERRORS,
    tags=["entity-profiles"],
)
async def upsert_entity_profile(request: EntityProfileRequest) -> EntityProfileResult:
    return generate_profile_stub(request)


@router.post(
    "/v1/questions",
    response_model=QuestionResult,
    responses=CONTRACT_ERRORS,
    tags=["questions"],
)
async def answer_question(request: QuestionRequest) -> QuestionResult:
    return question_stub(request)


@router.post(
    "/v1/log-drafts",
    response_model=LogDraftResult,
    responses=CONTRACT_ERRORS,
    tags=["drafts"],
)
async def draft_log(request: LogDraftRequest) -> LogDraftResult:
    return log_draft_stub(request)


@router.post(
    "/v1/procedure-drafts",
    response_model=ProcedureDraftResult,
    responses=CONTRACT_ERRORS,
    tags=["drafts"],
)
async def draft_procedure(request: ProcedureDraftRequest) -> ProcedureDraftResult:
    return procedure_draft_stub(request)
