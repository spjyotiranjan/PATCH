import json
from pathlib import Path

from conftest import signed_request
from fastapi.testclient import TestClient
from pydantic import SecretStr

from patch_ai.config import Settings
from patch_ai.main import create_app


def test_health_is_public_and_reports_only_liveness() -> None:
    with TestClient(create_app(Settings())) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"service": "patch-ai", "status": "available"}
    serialized = json.dumps(response.json()).lower()
    assert "configuration" not in serialized
    assert "secret" not in serialized
    assert "key" not in serialized


def test_readiness_is_private_and_aggregate(client: TestClient) -> None:
    response = signed_request(client, "GET", "/readiness")

    assert response.status_code == 200
    assert response.json() == {"service": "patch-ai", "status": "ready"}


def test_unready_service_does_not_expose_configuration_names() -> None:
    settings = Settings(ai_service_shared_secret=SecretStr("x" * 40))
    with TestClient(create_app(settings)) as client:
        response = signed_request(client, "GET", "/readiness", secret="x" * 40)

    assert response.status_code == 200
    assert response.json() == {"service": "patch-ai", "status": "unavailable"}
    assert set(response.json()) == {"service", "status"}


def test_openapi_is_public_and_contains_complete_phase_one_surface() -> None:
    with TestClient(create_app(Settings())) as client:
        response = client.get("/openapi.json")

    assert response.status_code == 200
    paths = response.json()["paths"]
    assert {
        "/health",
        "/readiness",
        "/v1/ingestions/extract",
        "/v1/ingestions/index",
        "/v1/entity-profiles/upsert",
        "/v1/questions",
        "/v1/log-drafts",
        "/v1/procedure-drafts",
    }.issubset(paths)
    assert "AI_SERVICE_SHARED_SECRET" not in response.text


def test_exported_openapi_artifact_matches_the_application() -> None:
    exported_path = Path(__file__).resolve().parents[1] / "openapi.json"
    exported = json.loads(exported_path.read_text(encoding="utf-8"))

    with TestClient(create_app(Settings())) as client:
        current = client.get("/openapi.json").json()

    assert exported == current


def test_settings_report_safe_service_names_only() -> None:
    settings = Settings()

    assert settings.unavailable_services() == [
        "service-authentication",
        "source-download",
        "openai",
        "pinecone",
    ]
    assert "replace-with" not in json.dumps(settings.unavailable_services())
