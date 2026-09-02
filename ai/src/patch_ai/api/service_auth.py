import asyncio
import hashlib
import hmac
import json
import logging
import time
from collections.abc import Callable
from uuid import UUID, uuid4

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse
from starlette.types import ASGIApp

from patch_ai.config import Settings
from patch_ai.observability import log_event

CONTRACT_VERSION = "v1"
CONTRACT_VERSION_HEADER = "x-patch-contract-version"
REQUEST_ID_HEADER = "x-patch-request-id"
TIMESTAMP_HEADER = "x-patch-timestamp"
SIGNATURE_HEADER = "x-patch-signature"

PUBLIC_PATHS = frozenset({"/health", "/docs", "/redoc", "/openapi.json"})


def canonical_request(
    *, request_id: str, timestamp: int, method: str, path: str, body: bytes
) -> bytes:
    body_hash = hashlib.sha256(body).hexdigest()
    return (
        f"{CONTRACT_VERSION}.{timestamp}.{request_id}.{method.upper()}.{path}.{body_hash}"
    ).encode()


def sign_request(
    *, secret: str, request_id: str, timestamp: int, method: str, path: str, body: bytes
) -> str:
    signature = hmac.new(
        secret.encode(),
        canonical_request(
            request_id=request_id,
            timestamp=timestamp,
            method=method,
            path=path,
            body=body,
        ),
        hashlib.sha256,
    ).hexdigest()
    return f"v1={signature}"


class ReplayGuard:
    def __init__(self) -> None:
        self._seen: dict[str, float] = {}
        self._lock = asyncio.Lock()

    async def accept(self, request_id: str, ttl_seconds: int) -> bool:
        now = time.monotonic()
        async with self._lock:
            self._seen = {
                seen_id: expires_at
                for seen_id, expires_at in self._seen.items()
                if expires_at > now
            }
            if request_id in self._seen:
                return False
            self._seen[request_id] = now + ttl_seconds
            return True


def _error(status: int, code: str, request_id: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code}, "requestId": request_id},
        headers={REQUEST_ID_HEADER: request_id},
    )


class ServiceAuthenticationMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: ASGIApp,
        *,
        settings_provider: Callable[[], Settings],
        replay_guard: ReplayGuard | None = None,
    ) -> None:
        super().__init__(app)
        self._settings_provider = settings_provider
        self._replay_guard = replay_guard or ReplayGuard()

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        started_at = time.perf_counter()
        if request.url.path in PUBLIC_PATHS:
            public_request_id = _valid_request_id(request.headers.get(REQUEST_ID_HEADER)) or str(
                uuid4()
            )
            request.state.request_id = public_request_id
            response = await call_next(request)
            response.headers[REQUEST_ID_HEADER] = public_request_id
            return response

        settings = self._settings_provider()
        request_id = _valid_request_id(request.headers.get(REQUEST_ID_HEADER))
        response_request_id = request_id or str(uuid4())
        secret = settings.ai_service_shared_secret.get_secret_value()
        if len(secret) < 32 or secret.startswith("replace-with-"):
            log_event(
                logging.ERROR,
                "patch_ai.service_auth.unavailable",
                unavailableServices=["service-authentication"],
            )
            return _error(503, "SERVICE_UNAVAILABLE", response_request_id)

        contract_version = request.headers.get(CONTRACT_VERSION_HEADER)
        raw_timestamp = request.headers.get(TIMESTAMP_HEADER)
        supplied_signature = request.headers.get(SIGNATURE_HEADER)
        if (
            not request_id
            or contract_version != CONTRACT_VERSION
            or not raw_timestamp
            or not supplied_signature
        ):
            return _error(401, "SERVICE_AUTH_REQUIRED", response_request_id)

        try:
            timestamp = int(raw_timestamp)
        except ValueError:
            return _error(401, "SERVICE_AUTH_INVALID", response_request_id)

        current_timestamp = int(time.time())
        if abs(current_timestamp - timestamp) > settings.ai_service_request_max_skew_seconds:
            return _error(401, "SERVICE_AUTH_EXPIRED", response_request_id)

        body = await request.body()
        expected_signature = sign_request(
            secret=secret,
            request_id=request_id,
            timestamp=timestamp,
            method=request.method,
            path=request.url.path,
            body=body,
        )
        if not hmac.compare_digest(expected_signature, supplied_signature):
            return _error(401, "SERVICE_AUTH_INVALID", response_request_id)

        if not _body_request_id_matches(body, request_id):
            return _error(400, "REQUEST_ID_MISMATCH", response_request_id)

        if not await self._replay_guard.accept(
            request_id, settings.ai_service_request_max_skew_seconds
        ):
            return _error(409, "REQUEST_REPLAYED", response_request_id)

        request.state.request_id = request_id
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        log_event(
            logging.INFO,
            "patch_ai.request.completed",
            requestId=request_id,
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            durationMs=round((time.perf_counter() - started_at) * 1000),
        )
        return response


def _valid_request_id(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return str(UUID(value))
    except ValueError:
        return None


def _body_request_id_matches(body: bytes, request_id: str) -> bool:
    if not body:
        return True
    try:
        payload = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return True
    body_request_id = payload.get("requestId") if isinstance(payload, dict) else None
    return body_request_id is None or str(body_request_id) == request_id
