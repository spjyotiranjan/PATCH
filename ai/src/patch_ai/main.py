import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from patch_ai.adapters.providers import Providers
from patch_ai.api.execution import WorkflowCapacityError, WorkflowExecutor
from patch_ai.api.routes import router
from patch_ai.api.service_auth import (
    REQUEST_ID_HEADER,
    ReplayGuard,
    ServiceAuthenticationMiddleware,
)
from patch_ai.api.sockets import router as socket_router
from patch_ai.config import Settings, get_settings
from patch_ai.observability import configure_logging, configure_tracing, log_event
from patch_ai.schemas.contracts import QuestionSocketEvent


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", None) or str(uuid4())


def create_app(settings: Settings | None = None) -> FastAPI:
    runtime_settings = settings or get_settings()
    configure_logging(runtime_settings.log_level)
    configure_tracing(
        runtime_settings.otel_exporter_otlp_endpoint, runtime_settings.otel_service_name
    )
    # HTTPX INFO logs contain complete presigned URLs. Never enable these logs.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpx2").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    application = FastAPI(
        title="P.A.T.C.H. AI Service",
        version="1.0.0",
        description="Private ingestion, retrieval, and generation service for P.A.T.C.H.",
        lifespan=lifespan,
    )
    application.state.settings = runtime_settings
    application.state.providers = Providers(runtime_settings)
    application.state.executor = WorkflowExecutor()
    application.state.replay_guard = ReplayGuard()
    application.add_middleware(
        ServiceAuthenticationMiddleware,
        settings_provider=lambda: runtime_settings,
        replay_guard=application.state.replay_guard,
    )
    application.include_router(router)
    application.include_router(socket_router)
    original_openapi = application.openapi

    def openapi_with_sockets() -> dict[str, Any]:
        schema = original_openapi()
        header_schemes = dict(
            zip(
                ("ServiceContract", "ServiceRequest", "ServiceTimestamp", "ServiceSignature"),
                (
                    "x-patch-contract-version",
                    "x-patch-request-id",
                    "x-patch-timestamp",
                    "x-patch-signature",
                ),
                strict=True,
            )
        )
        schema["components"]["securitySchemes"] = {
            name: {
                "type": "apiKey",
                "in": "header",
                "name": header,
                "description": "Exact single-use HMAC header; see Backend_Manual_Testing.md",
            }
            for name, header in header_schemes.items()
        }
        for path, methods in schema["paths"].items():
            if path == "/health":
                continue
            for method, operation in methods.items():
                if method not in {"get", "post"}:
                    continue
                operation["security"] = [{name: [] for name in header_schemes}]
        socket_schema = QuestionSocketEvent.model_json_schema(
            by_alias=True, ref_template="#/components/schemas/{model}"
        )
        definitions = socket_schema.pop("$defs", {})
        schema["components"]["schemas"].update(definitions)
        schema["components"]["schemas"]["QuestionSocketEvent"] = socket_schema
        schema["x-websocket-channels"] = {
            "/v1/questions/ws": {
                "request": {"$ref": "#/components/schemas/QuestionRequest"},
                "event": {"$ref": "#/components/schemas/QuestionSocketEvent"},
                "authentication": "HMAC GET with empty handshake body; requestId binds first frame",
            }
        }
        return schema

    application.openapi = openapi_with_sockets  # type: ignore[method-assign]

    @application.exception_handler(RequestValidationError)
    async def request_validation_error(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        request_id = _request_id(request)
        fields = [
            ".".join(str(part) for part in item["loc"] if part != "body") for item in error.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={
                "error": {"code": "INVALID_REQUEST", "fields": fields},
                "requestId": request_id,
            },
            headers={REQUEST_ID_HEADER: request_id},
        )

    @application.exception_handler(WorkflowCapacityError)
    async def capacity_error(request: Request, _: WorkflowCapacityError) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={"error": {"code": "WORKFLOW_UNAVAILABLE"}, "requestId": _request_id(request)},
            headers={REQUEST_ID_HEADER: _request_id(request)},
        )

    @application.exception_handler(Exception)
    async def unexpected_error(request: Request, error: Exception) -> JSONResponse:
        request_id = _request_id(request)
        log_event(
            logging.ERROR,
            "patch_ai.request.failed",
            requestId=request_id,
            errorType=type(error).__name__,
        )
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "INTERNAL_ERROR"}, "requestId": request_id},
            headers={REQUEST_ID_HEADER: request_id},
        )

    FastAPIInstrumentor.instrument_app(application)
    return application


app = create_app()


def run() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "patch_ai.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.app_env.lower() == "development",
        ws_max_size=2_000_000,
        ws_per_message_deflate=False,
    )
