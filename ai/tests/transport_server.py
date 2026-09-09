"""Loopback-only contract fixture. No credentials, dotenv files or provider I/O."""

import io
import socket

import uvicorn
from pydantic import SecretStr
from pypdf import PdfWriter

from patch_ai.config import Settings
from patch_ai.main import create_app
from patch_ai.schemas.contracts import SourceFile
from patch_ai.services import visual_assets

settings = Settings(
    _env_file=None,  # pyright: ignore[reportCallIssue]
    ai_service_shared_secret=SecretStr("loopback-contract-fixture-secret-not-for-real-use"),
    openai_api_key=SecretStr(""),
    pinecone_api_key=SecretStr(""),
    source_url_allowed_hosts="",
    sentry_dsn=SecretStr(""),
    otel_exporter_otlp_endpoint="",
)
app = create_app(settings)


def forbidden(*args: object, **kwargs: object) -> None:
    raise RuntimeError("Provider I/O forbidden in transport fixture")


for name in ("model", "upsert", "search", "delete"):
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

if __name__ == "__main__":
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    print(f"PATCH_TEST_PORT={sock.getsockname()[1]}", flush=True)
    uvicorn.Server(uvicorn.Config(app, log_level="warning", access_log=False)).run(sockets=[sock])
