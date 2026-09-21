"""Loopback-only contract fixture. No credentials, dotenv files or provider I/O."""

import io
import socket

import uvicorn
from langchain_core.documents import Document
from PIL import Image
from pydantic import SecretStr
from pypdf import PdfWriter

from patch_ai.adapters import visual_source
from patch_ai.config import Settings
from patch_ai.main import create_app
from patch_ai.schemas.contracts import SourceFile
from patch_ai.services import visual_assets
from patch_ai.services.visual_retrieval import Gate, PixelDraft, PixelVerdict

settings = Settings(
    _env_file=None,  # pyright: ignore[reportCallIssue]
    ai_service_shared_secret=SecretStr("loopback-contract-fixture-secret-not-for-real-use"),
    openai_api_key=SecretStr(""),
    pinecone_api_key=SecretStr(""),
    source_url_allowed_hosts="",
    sentry_dsn=SecretStr(""),
    otel_exporter_otlp_endpoint="",
    visual_retrieval_enabled=True,
)
app = create_app(settings)


def forbidden(*args: object, **kwargs: object) -> None:
    raise RuntimeError("Provider I/O forbidden in transport fixture")


for name in (
    "model",
    "upsert",
    "search",
    "delete",
    "visual_upsert",
    "visual_search",
    "visual_delete",
):
    setattr(app.state.providers, name, forbidden)


def fixture_visual_source(source: SourceFile, settings: Settings) -> bytes:
    # Replace external download only. The signed route and actual PDF renderer run.
    if str(source.url) != "https://fixture.invalid/visual.pdf" or source.sha256 != "a" * 64:
        raise ValueError("UNEXPECTED_TRANSPORT_FIXTURE")
    writer = PdfWriter()
    writer.add_blank_page(width=144, height=72)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


visual_assets.download_source = fixture_visual_source

# An explicit synthetic case exercises the real search + socket + pixel graph.
# These providers are in-memory only; every other query still forbids provider I/O.
visual_records: list[Document] = []
pixels = io.BytesIO()
Image.new("RGB", (16, 16), "red").save(pixels, format="PNG")


def visual_upsert(document: Document, vector_id: str) -> None:
    if document.metadata.get("tenantId") != "fixture":
        forbidden()
    visual_records[:] = [document]


def visual_search(query: str, filters: object, count: int) -> list[tuple[Document, float]]:
    if query != "visual-transport-fixture":
        forbidden()
    return [(d, 0.8) for d in visual_records]


def text_search(query: str, filters: object, count: int) -> list[tuple[Document, float]]:
    if query != "visual-transport-fixture":
        forbidden()
    return []


def visual_model(schema: object, system: str, data: str, **kwargs: object) -> object:
    if "visual-transport-fixture" not in data:
        forbidden()
    if schema is Gate:
        return Gate.model_validate(
            {"visualRequired": False, "items": [{"candidateIndex": 0, "role": "HELPFUL"}]}
        )
    if schema is PixelDraft and kwargs.get("images") == (pixels.getvalue(),):
        return PixelDraft.model_validate(
            {"observations": [{"text": "A red square is visible.", "assetIds": ["a" * 24]}]}
        )
    if schema is PixelVerdict and kwargs.get("images") == (pixels.getvalue(),):
        return PixelVerdict(
            supported=True, operational_instructions=False, injection=False, conflict=False
        )
    forbidden()
    return None


def visual_download(source: SourceFile, config: Settings) -> bytes:
    if str(source.url) != "https://fixture.invalid/phase7.png":
        raise ValueError("UNEXPECTED_TRANSPORT_FIXTURE")
    return pixels.getvalue()


app.state.providers.visual_upsert = visual_upsert
app.state.providers.visual_search = visual_search
app.state.providers.search = text_search
app.state.providers.model = visual_model
visual_source.download_source = visual_download

if __name__ == "__main__":
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    print(f"PATCH_TEST_PORT={sock.getsockname()[1]}", flush=True)
    uvicorn.Server(uvicorn.Config(app, log_level="warning", access_log=False)).run(sockets=[sock])
