import time
from uuid import uuid4

from conftest import TEST_SECRET, signed_request
from fastapi.testclient import TestClient

from patch_ai.api.service_auth import sign_request


def test_cross_language_signature_vector() -> None:
    signature = sign_request(
        secret=TEST_SECRET,
        request_id="123e4567-e89b-12d3-a456-426614174000",
        timestamp=1_700_000_000,
        method="POST",
        path="/v1/questions",
        body=b'{"question":"status"}',
    )

    assert signature == "v1=fee49640534c5f5e100300284061261b35fec5c9aeaab6ed78c7919df6ed4b1d"


def test_missing_authentication_is_rejected(client: TestClient) -> None:
    response = client.get("/readiness")

    assert response.status_code == 401
    assert response.json()["error"] == {"code": "SERVICE_AUTH_REQUIRED"}


def test_invalid_signature_is_rejected(client: TestClient) -> None:
    response = signed_request(
        client,
        "GET",
        "/readiness",
        secret="different-service-secret-that-is-also-long-enough",
    )

    assert response.status_code == 401
    assert response.json()["error"] == {"code": "SERVICE_AUTH_INVALID"}


def test_expired_signature_is_rejected(client: TestClient) -> None:
    response = signed_request(
        client,
        "GET",
        "/readiness",
        timestamp=int(time.time()) - 1_000,
    )

    assert response.status_code == 401
    assert response.json()["error"] == {"code": "SERVICE_AUTH_EXPIRED"}


def test_request_replay_is_rejected(client: TestClient) -> None:
    request_id = str(uuid4())
    timestamp = int(time.time())

    first = signed_request(
        client,
        "GET",
        "/readiness",
        request_id=request_id,
        timestamp=timestamp,
    )
    replay = signed_request(
        client,
        "GET",
        "/readiness",
        request_id=request_id,
        timestamp=timestamp,
    )

    assert first.status_code == 200
    assert replay.status_code == 409
    assert replay.json()["error"] == {"code": "REQUEST_REPLAYED"}


def test_body_request_id_must_match_header(client: TestClient) -> None:
    response = signed_request(
        client,
        "POST",
        "/v1/questions",
        {"requestId": str(uuid4())},
        request_id=str(uuid4()),
    )

    assert response.status_code == 400
    assert response.json()["error"] == {"code": "REQUEST_ID_MISMATCH"}
