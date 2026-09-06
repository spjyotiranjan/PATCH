import time
from uuid import uuid4

import pytest
from conftest import TEST_SECRET
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from patch_ai.api.service_auth import sign_request


def headers(request_id: str, timestamp: int | None = None) -> dict[str, str]:
    stamp = timestamp or int(time.time())
    return {
        "x-patch-contract-version": "v1",
        "x-patch-request-id": request_id,
        "x-patch-timestamp": str(stamp),
        "x-patch-signature": sign_request(
            secret=TEST_SECRET,
            request_id=request_id,
            timestamp=stamp,
            method="GET",
            path="/v1/questions/ws",
            body=b"",
        ),
    }


def payload(request_id: str) -> dict[str, object]:
    return {
        "requestId": request_id,
        "contractVersion": "v1",
        "actor": {"id": "user-1", "tenantId": "tenant-1"},
        "chatSession": {"id": "chat-1"},
        "question": "What evidence is available?",
        "retrievalScopeManifest": {
            "allowedDocumentVersions": [],
            "entities": [],
            "relationships": [],
        },
        "retrievalPolicy": {
            "approvedOnly": True,
            "requireSourceLocation": True,
            "allowStructuralFallback": True,
        },
    }


def test_socket_signed_empty_scope_and_replay(client: TestClient) -> None:
    request_id = str(uuid4())
    auth = headers(request_id)
    with client.websocket_connect("/v1/questions/ws", headers=auth) as ws:
        ws.send_json(payload(request_id))
        assert ws.receive_json()["type"] == "question.progress"
        result = ws.receive_json()
        assert result["type"] == "question.result"
        assert result["result"]["status"] == "incomplete"
        assert result["result"]["citations"] == []
    with (
        pytest.raises(WebSocketDisconnect),
        client.websocket_connect("/v1/questions/ws", headers=auth),
    ):
        pass


@pytest.mark.parametrize("kind", ["missing", "expired", "bad_signature", "browser_origin"])
def test_socket_rejects_invalid_auth(client: TestClient, kind: str) -> None:
    auth = headers(str(uuid4()), int(time.time()) - 1000 if kind == "expired" else None)
    if kind == "missing":
        auth = {}
    elif kind == "bad_signature":
        auth["x-patch-signature"] = "v1=wrong"
    elif kind == "browser_origin":
        auth["origin"] = "https://example.test"
    with (
        pytest.raises(WebSocketDisconnect),
        client.websocket_connect("/v1/questions/ws", headers=auth),
    ):
        pass


def test_socket_request_id_binding(client: TestClient) -> None:
    with client.websocket_connect("/v1/questions/ws", headers=headers(str(uuid4()))) as ws:
        ws.send_json(payload(str(uuid4())))
        assert ws.receive_json()["type"] == "question.error"
