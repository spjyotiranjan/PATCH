import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from patch_ai.api.routes import router
from patch_ai.api.service_auth import REQUEST_ID_HEADER, ServiceAuthenticationMiddleware
from patch_ai.config import Settings, get_settings
from patch_ai.observability import configure_logging, log_event


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", None) or str(uuid4())


def create_app(settings: Settings | None = None) -> FastAPI:
    runtime_settings = settings or get_settings()
    configure_logging(runtime_settings.log_level)
    application = FastAPI(
        title="P.A.T.C.H. AI Service",
        version="1.0.0",
        description="Private ingestion, retrieval, and generation service for P.A.T.C.H.",
        lifespan=lifespan,
    )
    application.state.settings = runtime_settings
    application.add_middleware(
        ServiceAuthenticationMiddleware,
        settings_provider=lambda: runtime_settings,
    )
    application.include_router(router)

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
    )
