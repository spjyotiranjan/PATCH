from fastapi.testclient import TestClient

from patch_ai.main import app


def test_health_reports_service_identity() -> None:
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json()["service"] == "patch-ai"
