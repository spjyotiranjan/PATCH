import json
import time
from collections.abc import Iterator
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from patch_ai.api.service_auth import (
    CONTRACT_VERSION_HEADER,
    REQUEST_ID_HEADER,
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
    sign_request,
)
from patch_ai.config import Settings
from patch_ai.main import create_app

TEST_SECRET = "phase-one-test-service-secret-that-is-long-enough"


@pytest.fixture
def ready_settings() -> Settings:
    return Settings(
        ai_service_shared_secret=SecretStr(TEST_SECRET),
        source_url_allowed_hosts="tenant.r2.cloudflarestorage.com",
        openai_api_key=SecretStr("test-openai-key"),
        pinecone_api_key=SecretStr("test-pinecone-key"),
        pinecone_index_name="patch-test",
    )


@pytest.fixture
def client(ready_settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(ready_settings)) as test_client:
        yield test_client


def signed_request(
    client: TestClient,
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
    *,
    request_id: str | None = None,
    timestamp: int | None = None,
    secret: str = TEST_SECRET,
):
    resolved_request_id = request_id or str(uuid4())
    resolved_timestamp = timestamp or int(time.time())
    body = json.dumps(payload, separators=(",", ":")).encode() if payload is not None else b""
    headers = {
        CONTRACT_VERSION_HEADER: "v1",
        REQUEST_ID_HEADER: resolved_request_id,
        TIMESTAMP_HEADER: str(resolved_timestamp),
        SIGNATURE_HEADER: sign_request(
            secret=secret,
            request_id=resolved_request_id,
            timestamp=resolved_timestamp,
            method=method,
            path=path,
            body=body,
        ),
    }
    if payload is not None:
        headers["content-type"] = "application/json"
    return client.request(method, path, content=body, headers=headers)
