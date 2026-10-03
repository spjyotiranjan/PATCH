import json
from typing import Any
from uuid import uuid4

import pytest
from conftest import signed_request
from fastapi.testclient import TestClient
from test_backend_workflows import FixtureProviders, fixtures
from test_question_sockets import headers

from patch_ai.adapters.providers import Model
from patch_ai.services.answering import EvidenceVerification, GroundedDraft, answer

MARKDOWN = (
    "## Document summary\n\nThe **test display label** is `amber`.\n\n"
    "- This is a synthetic test card.\n- It is not equipment guidance.\n\n"
    "| Field | Documented value |\n| --- | --- |\n| Display label | Amber |"
)


class MarkdownProviders(FixtureProviders):
    def __init__(self) -> None:
        settings, provider, _ = fixtures()
        super().__init__(settings)
        self.records = provider.records
        self.failure = ""

    def model(
        self,
        schema: type[Model],
        system: str,
        data: str,
        *,
        routing: bool = False,
        complex_reasoning: bool = False,
        images: tuple[bytes, ...] = (),
    ) -> Model:
        payload = json.loads(data)
        assert "self-contained" in system and "Markdown" in system
        if schema is GroundedDraft:
            assert "Do not emit source numbers" in system
            return schema.model_validate(
                {
                    "status": "approved",
                    "title": "Test card overview",
                    "claims": [{"text": MARKDOWN, "chunkIds": [payload["sources"][0]["chunkId"]]}],
                    "gaps": [],
                }
            )
        assert schema is EvidenceVerification and complex_reasoning
        assert "Verify EVERY factual statement" in system
        assert payload["draft"]["claims"][0]["text"] == MARKDOWN
        return schema.model_validate(
            {
                "supported": self.failure != "unsupported",
                "conflict": self.failure == "conflict",
                "missingMandatorySafetyEvidence": self.failure == "safety",
            }
        )


def test_markdown_passage_is_verified_and_retains_exact_chunk_binding() -> None:
    settings, _, request = fixtures()
    result = answer(request, settings, MarkdownProviders())
    assert result.status == "approved"
    assert result.answer.summary is None
    assert result.answer.steps[0].text == MARKDOWN
    assert result.answer.steps[0].citation_ids == [result.citations[0].id]
    assert result.citations[0].document_version_id in {
        source.document_version_id
        for source in request.retrieval_scope_manifest.allowed_document_versions
    }


@pytest.mark.parametrize("failure", ["unsupported", "conflict", "safety"])
def test_markdown_cannot_bypass_evidence_rejection(failure: str) -> None:
    settings, _, request = fixtures()
    provider = MarkdownProviders()
    provider.failure = failure
    result = answer(request, settings, provider)
    assert result.status != "approved"
    assert not result.answer.steps and not result.citations
    assert MARKDOWN not in result.model_dump_json()


def test_markdown_survives_existing_signed_rest_and_socket_shapes(client: TestClient) -> None:
    _, _, request = fixtures()
    provider = MarkdownProviders()
    app: Any = client.app
    app.state.providers = provider
    app.state.settings.pinecone_namespace = provider.settings.pinecone_namespace
    response = signed_request(
        client,
        "POST",
        "/v1/questions",
        request.model_dump(mode="json", by_alias=True),
        request_id=str(request.request_id),
    )
    assert response.status_code == 200
    result = response.json()
    assert result["answer"]["steps"][0]["text"] == MARKDOWN
    request.request_id = uuid4()
    with client.websocket_connect(
        "/v1/questions/ws", headers=headers(str(request.request_id))
    ) as ws:
        ws.send_json(request.model_dump(mode="json", by_alias=True))
        assert ws.receive_json()["type"] == "question.progress"
        event = ws.receive_json()
        assert event["type"] == "question.result"
        assert event["result"]["answer"] == result["answer"]
        assert event["result"]["citations"] == result["citations"]
