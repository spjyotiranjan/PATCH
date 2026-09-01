from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from patch_ai.config import get_settings


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield


app = FastAPI(
    title="P.A.T.C.H. AI Service",
    version="0.1.0",
    description="Private ingestion, retrieval, and generation service for P.A.T.C.H.",
    lifespan=lifespan,
)


@app.get("/health", tags=["system"])
async def health() -> dict[str, object]:
    settings = get_settings()
    missing = settings.missing_runtime_configuration()
    return {
        "service": settings.service_name,
        "status": "ready" if not missing else "configuration_required",
        "missingConfiguration": missing,
    }


def run() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run("patch_ai.main:app", host=settings.host, port=settings.port, reload=True)
