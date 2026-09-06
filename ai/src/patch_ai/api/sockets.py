import asyncio
import hmac
import time
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from patch_ai.api.execution import WorkflowExecutor
from patch_ai.api.service_auth import ReplayGuard, sign_request
from patch_ai.config import Settings
from patch_ai.schemas.contracts import QuestionRequest, QuestionSocketEvent
from patch_ai.services.answering import answer

router = APIRouter()


@router.websocket("/v1/questions/ws")
async def question_socket(socket: WebSocket) -> None:
    settings: Settings = socket.app.state.settings
    guard: ReplayGuard = socket.app.state.replay_guard
    secret = settings.ai_service_shared_secret.get_secret_value()
    try:
        request_id = str(UUID(socket.headers.get("x-patch-request-id", "")))
        timestamp = int(socket.headers.get("x-patch-timestamp", "0"))
        if (
            len(secret) < 32
            or secret.startswith("replace-with-")
            or socket.headers.get("x-patch-contract-version") != "v1"
            or socket.headers.get("origin") is not None
            or abs(int(time.time()) - timestamp) > settings.ai_service_request_max_skew_seconds
        ):
            raise ValueError("SERVICE_AUTH_INVALID")
        expected = sign_request(
            secret=secret,
            request_id=request_id,
            timestamp=timestamp,
            method="GET",
            path="/v1/questions/ws",
            body=b"",
        )
        if not hmac.compare_digest(expected, socket.headers.get("x-patch-signature", "")):
            raise ValueError("SERVICE_AUTH_INVALID")
        if not await guard.accept(request_id, settings.ai_service_request_max_skew_seconds * 2):
            raise ValueError("REQUEST_REPLAYED")
    except (ValueError, TypeError):
        await socket.close(code=1008)
        return
    await socket.accept()
    try:
        raw = await asyncio.wait_for(socket.receive_text(), timeout=10)
        if len(raw.encode()) > 2_000_000:
            await socket.close(code=1009)
            return
        request = QuestionRequest.model_validate_json(raw)
        if str(request.request_id) != request_id:
            raise ValueError("REQUEST_ID_MISMATCH")
        await socket.send_json(
            QuestionSocketEvent(
                type="question.progress", request_id=request.request_id, stage="retrieving"
            ).model_dump(mode="json", by_alias=True)
        )
        executor: WorkflowExecutor = socket.app.state.executor
        result = await executor.run(
            answer,
            settings.ai_service_request_timeout_seconds,
            request,
            settings,
            socket.app.state.providers,
        )
        await socket.send_json(
            QuestionSocketEvent(
                type="question.result", request_id=request.request_id, result=result
            ).model_dump(mode="json", by_alias=True)
        )
        await socket.close(code=1000)
    except WebSocketDisconnect:
        return
    except Exception:
        try:
            await socket.send_json(
                {"type": "question.error", "requestId": request_id, "code": "WORKFLOW_UNAVAILABLE"}
            )
            await socket.close(code=1011)
        except (WebSocketDisconnect, RuntimeError):
            pass
