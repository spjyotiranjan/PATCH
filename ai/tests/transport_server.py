"""Loopback-only contract fixture. No credentials, dotenv files or provider I/O."""

import socket

import uvicorn
from pydantic import SecretStr

from patch_ai.config import Settings
from patch_ai.main import create_app

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

if __name__ == "__main__":
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    print(f"PATCH_TEST_PORT={sock.getsockname()[1]}", flush=True)
    uvicorn.Server(uvicorn.Config(app, log_level="warning", access_log=False)).run(sockets=[sock])
