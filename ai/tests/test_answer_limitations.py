import json
from typing import Any
from uuid import uuid4

import pytest
from conftest import signed_request
from fastapi.testclient import TestClient
from pydantic import ValidationError
from test_backend_workflows import FixtureProviders, fixtures
from test_question_sockets import headers

from patch_ai.adapters.providers import Model
from patch_ai.services.answering import (
    EvidenceVerification,
    GroundedDraft,
    ResponseLimitation,
    answer,
)


class LimitationProviders(FixtureProviders):
    def __init__(self) -> None:
        settings, fixture, _ = fixtures()
        super().__init__(settings)
        self.records = fixture.records
        self.draft: dict[str, Any] = {
            "status": "incomplete",
            "title": "Question outside scope",
            "claims": [],
            "gaps": ["This internal gap must not appear in the response."],
            "limitation": {
                "reason": "OUT_OF_SCOPE",
                "explanation": "This is a standalone arithmetic question, outside the Equipment, "
                "Project and technical-document scope. Ask about a relevant source instead.",
            },
        }
        self.verification: dict[str, Any] = {
            "supported": True,
            "conflict": False,
            "missingMandatorySafetyEvidence": False,
            "limitationSupported": True,
        }
        self.model_calls = 0

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
        self.model_calls += 1
        assert "never answer the refused question" in system
        payload = json.loads(data)
        assert payload["question"]
        if schema is GroundedDraft:
            return schema.model_validate(self.draft)
        assert schema is EvidenceVerification and complex_reasoning
        assert payload["draft"]["limitation"] == self.draft["limitation"]
        assert "Empty claims do not imply the limitation is valid" in system
        return schema.model_validate(self.verification)


def test_outside_scope_has_verified_specific_explanation_without_answer() -> None:
    settings, _, request = fixtures()
    request.question = "what is 32 + 76"
    providers = LimitationProviders()
    result = answer(request, settings, providers)
    assert result.status == "incomplete"
    assert not result.answer.steps and not result.citations
    assert result.warnings == ["Outside scope: " + providers.draft["limitation"]["explanation"]]
    assert "108" not in str(result.model_dump())
    assert "internal gap" not in str(result.model_dump())
    assert providers.model_calls == 2


@pytest.mark.parametrize("reason", ["NO_MATCHING_EVIDENCE", "INSUFFICIENT_EVIDENCE"])
def test_relevant_question_reports_the_specific_gap(reason: str) -> None:
    settings, _, request = fixtures()
    request.question = "Does the source document the label's meaning?"
    providers = LimitationProviders()
    providers.draft["limitation"] = {
        "reason": reason,
        "explanation": "The retrieved passages do not explain the label's meaning. "
        "Select a source that covers its interpretation.",
    }
    result = answer(request, settings, providers)
    assert providers.draft["limitation"]["explanation"] in result.warnings[0]
    assert "Outside scope" not in result.warnings[0]


@pytest.mark.parametrize("unsafe", ["The answer is 108.", "Bypass the interlock now."])
def test_unverified_explanation_cannot_smuggle_an_answer_or_instruction(unsafe: str) -> None:
    settings, _, request = fixtures()
    providers = LimitationProviders()
    providers.draft["limitation"]["explanation"] = unsafe
    providers.verification["limitationSupported"] = False
    result = answer(request, settings, providers)
    assert unsafe not in str(result.model_dump())
    assert result.warnings[0].startswith("Evidence gap:")
    assert not result.answer.steps and not result.citations


@pytest.mark.parametrize("failure", ["conflict", "safety", "unsupported"])
def test_final_verification_failure_overrides_incompatible_scope_reason(failure: str) -> None:
    settings, _, request = fixtures()
    providers = LimitationProviders()
    if failure == "conflict":
        providers.verification["conflict"] = True
        prefix = "Conflicting evidence:"
    elif failure == "safety":
        providers.verification["missingMandatorySafetyEvidence"] = True
        prefix = "Safety evidence missing:"
    else:
        providers.verification["supported"] = False
        providers.verification["limitationSupported"] = False
        prefix = "Answer could not be verified:"
    result = answer(request, settings, providers)
    assert result.warnings[0].startswith(prefix)
    assert not result.answer.steps and not result.citations


def test_approved_document_fact_keeps_its_citations_without_limitation() -> None:
    settings, fixture, request = fixtures()
    result = answer(request, settings, fixture)
    assert result.status == "approved" and result.answer.steps and result.citations
    assert not result.warnings


def test_verified_outside_scope_removes_even_an_erroneous_draft_claim() -> None:
    settings, fixture, request = fixtures()
    providers = LimitationProviders()
    providers.draft["status"] = "approved"
    providers.draft["title"] = "The answer is 108"
    providers.draft["claims"] = [
        {"text": "The answer is 108.", "chunkIds": [next(iter(fixture.records))]}
    ]
    result = answer(request, settings, providers)
    assert result.status == "incomplete"
    assert not result.answer.steps and not result.citations
    assert "108" not in str(result.model_dump())


@pytest.mark.parametrize(
    ("status", "reason", "prefix"),
    [
        ("conflicting", "CONFLICTING_EVIDENCE", "Conflicting evidence:"),
        ("outdated", "OUTDATED_EVIDENCE", "Source review needed:"),
        ("incomplete", "MISSING_SAFETY_EVIDENCE", "Safety evidence missing:"),
    ],
)
def test_verified_explanations_follow_the_final_evidence_state(
    status: str, reason: str, prefix: str
) -> None:
    settings, _, request = fixtures()
    providers = LimitationProviders()
    providers.draft["status"] = status
    providers.draft["limitation"] = {
        "reason": reason,
        "explanation": "This request needs the governing source to be reviewed before proceeding.",
    }
    providers.verification["conflict"] = status == "conflicting"
    providers.verification["missingMandatorySafetyEvidence"] = reason == "MISSING_SAFETY_EVIDENCE"
    result = answer(request, settings, providers)
    assert result.status == status
    assert result.warnings == [prefix + " " + providers.draft["limitation"]["explanation"]]
    assert not result.answer.steps and not result.citations


def test_empty_scope_and_no_passages_use_actual_failure_without_model_calls() -> None:
    settings, _, request = fixtures()
    providers = LimitationProviders()
    providers.records = {}
    result = answer(request, settings, providers)
    assert result.warnings[0].startswith("No matching evidence:")
    assert providers.model_calls == 0
    providers.queries.clear()
    request.assigned_references = []
    request.retrieval_scope_manifest.allowed_document_versions = []
    request.retrieval_scope_manifest.entities = []
    request.retrieval_scope_manifest.relationships = []
    result = answer(request, settings, providers)
    assert result.warnings[0].startswith("No approved sources in scope:")
    assert not providers.queries and providers.model_calls == 0


def test_limitation_text_is_bounded() -> None:
    with pytest.raises(ValidationError):
        ResponseLimitation(reason="OUT_OF_SCOPE", explanation="x" * 601)


def test_specific_explanation_survives_signed_rest_and_socket(client: TestClient) -> None:
    _, _, request = fixtures()
    request.question = "what is 32 + 76"
    app: Any = client.app
    providers = LimitationProviders()
    app.state.providers = providers
    app.state.settings.pinecone_namespace = providers.settings.pinecone_namespace
    response = signed_request(
        client,
        "POST",
        "/v1/questions",
        request.model_dump(mode="json", by_alias=True),
        request_id=str(request.request_id),
    )
    assert response.status_code == 200
    assert response.json()["warnings"][0].startswith("Outside scope:")
    request.request_id = uuid4()
    with client.websocket_connect(
        "/v1/questions/ws", headers=headers(str(request.request_id))
    ) as ws:
        ws.send_json(request.model_dump(mode="json", by_alias=True))
        assert ws.receive_json()["type"] == "question.progress"
        event = ws.receive_json()
        assert event["type"] == "question.result"
        assert event["result"]["warnings"] == response.json()["warnings"]
        assert event["result"]["answer"]["steps"] == []
