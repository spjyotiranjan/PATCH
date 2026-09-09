import asyncio
import logging
from collections.abc import Callable
from typing import Any

from fastapi import APIRouter, Request

from patch_ai.adapters import ocr
from patch_ai.adapters.providers import Providers
from patch_ai.api.execution import WorkflowExecutor
from patch_ai.config import Settings
from patch_ai.observability import log_event
from patch_ai.schemas.contracts import (
    ApiErrorResponse,
    DeleteVectorsRequest,
    DeleteVectorsResult,
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
    RevalidationRequest,
    RevalidationResult,
    VisualDescribeRequest,
    VisualDescribeResult,
    VisualRenderRequest,
    VisualRenderResult,
)
from patch_ai.services import answering, drafting, ingestion, visual_assets, visual_understanding

router = APIRouter()


async def run_workflow[**P, T](
    http: Request, function: Callable[P, T], *args: P.args, **kwargs: P.kwargs
) -> T:
    executor: WorkflowExecutor = http.app.state.executor
    settings: Settings = http.app.state.settings
    return await executor.run(
        function, settings.ai_service_request_timeout_seconds, *args, **kwargs
    )


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
    if not await asyncio.to_thread(ocr.available, settings):
        unavailable_services.append("ocr")
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
async def extract_document(request: ExtractRequest, http: Request) -> ExtractResult:
    return await run_workflow(
        http, ingestion.extract, request, http.app.state.settings, http.app.state.providers
    )


@router.post(
    "/v1/ingestions/index",
    response_model=IndexResult,
    responses=CONTRACT_ERRORS,
    tags=["ingestion"],
)
async def index_document(request: IndexRequest, http: Request) -> IndexResult:
    return await run_workflow(
        http, ingestion.index, request, http.app.state.settings, http.app.state.providers
    )


@router.post(
    "/v1/visual-assets/describe",
    response_model=VisualDescribeResult,
    responses=CONTRACT_ERRORS,
    tags=["visual-assets"],
)
async def describe_visual_asset(
    request: VisualDescribeRequest, http: Request
) -> VisualDescribeResult:
    return await run_workflow(
        http,
        visual_understanding.describe,
        request,
        http.app.state.settings,
        http.app.state.providers,
    )


@router.post(
    "/v1/visual-assets/render",
    response_model=VisualRenderResult,
    responses=CONTRACT_ERRORS,
    tags=["visual-assets"],
)
async def render_visual_asset(request: VisualRenderRequest, http: Request) -> VisualRenderResult:
    return await run_workflow(http, visual_assets.render, request, http.app.state.settings)


@router.post(
    "/v1/entity-profiles/upsert",
    response_model=EntityProfileResult,
    responses=CONTRACT_ERRORS,
    tags=["entity-profiles"],
)
async def upsert_entity_profile(
    request: EntityProfileRequest, http: Request
) -> EntityProfileResult:
    return await run_workflow(
        http, ingestion.profile, request, http.app.state.settings, http.app.state.providers
    )


@router.post(
    "/v1/questions",
    response_model=QuestionResult,
    responses=CONTRACT_ERRORS,
    tags=["questions"],
)
async def answer_question(request: QuestionRequest, http: Request) -> QuestionResult:
    return await run_workflow(
        http, answering.answer, request, http.app.state.settings, http.app.state.providers
    )


@router.post(
    "/v1/log-drafts",
    response_model=LogDraftResult,
    responses=CONTRACT_ERRORS,
    tags=["drafts"],
)
async def draft_log(request: LogDraftRequest, http: Request) -> LogDraftResult:
    return await run_workflow(http, drafting.draft_log, request, http.app.state.providers)


@router.post(
    "/v1/procedure-drafts",
    response_model=ProcedureDraftResult,
    responses=CONTRACT_ERRORS,
    tags=["drafts"],
)
async def draft_procedure(request: ProcedureDraftRequest, http: Request) -> ProcedureDraftResult:
    return await run_workflow(
        http, drafting.draft_procedure, request, http.app.state.settings, http.app.state.providers
    )


@router.post(
    "/v1/procedure-drafts/revalidate",
    response_model=RevalidationResult,
    responses=CONTRACT_ERRORS,
    tags=["drafts"],
)
async def revalidate_procedure(request: RevalidationRequest, http: Request) -> RevalidationResult:
    return await run_workflow(
        http, drafting.revalidate, request, http.app.state.settings, http.app.state.providers
    )


@router.post(
    "/v1/ingestions/delete-vectors",
    response_model=DeleteVectorsResult,
    responses=CONTRACT_ERRORS,
    tags=["ingestion"],
)
async def delete_vectors(request: DeleteVectorsRequest, http: Request) -> DeleteVectorsResult:
    providers: Providers = http.app.state.providers
    try:
        await run_workflow(
            http,
            providers.delete,
            answering.filter_sources(
                request.tenant_id, [request.document_version_id], http.app.state.settings
            ),
        )
        return DeleteVectorsResult(request_id=request.request_id, status="deleted")
    except Exception:
        return DeleteVectorsResult(request_id=request.request_id, status="failed")
