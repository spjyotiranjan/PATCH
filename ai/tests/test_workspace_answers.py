import json
from typing import Any
from uuid import uuid4

import pytest
from conftest import signed_request
from fastapi.testclient import TestClient
from test_backend_workflows import FixtureProviders, fixtures
from test_question_sockets import headers

from patch_ai.adapters.providers import Model
from patch_ai.schemas.contracts import WorkspaceCatalog
from patch_ai.services.answering import answer
from patch_ai.services.workspace_answering import WorkspaceIntent, WorkspaceIntentVerification


def catalog() -> WorkspaceCatalog:
    return WorkspaceCatalog.model_validate(
        {
            "entities": [
                {
                    "id": "project-1",
                    "type": "PROJECT",
                    "name": "Cooling water",
                    "description": "Saved synthetic project",
                    "status": "ACTIVE",
                    "equipmentIds": [],
                }
            ],
            "documents": [],
            "partial": False,
            "workflowRecords": [
                {
                    "id": "log-1",
                    "type": "LOG",
                    "projectId": "project-1",
                    "title": "Project maintenance log",
                    "text": "Synthetic display check recorded.",
                    "status": "SUBMITTED",
                }
            ],
            "help": [
                {
                    "id": "help-documents",
                    "title": "Document revisions",
                    "text": "Use Add new version in Documents. "
                    "Review before approval and indexing.",
                }
            ],
        }
    )


class WorkspaceProviders(FixtureProviders):
    def __init__(self) -> None:
        settings, provider, _ = fixtures()
        super().__init__(settings)
        self.records = provider.records
        self.kind = "WORKSPACE"
        self.scope = "PROJECTS"
        self.supported = True
        self.intent_supported = False
        self.accepted: list[int] = []
        self.passages = [
            {
                "text": "## Cooling water\n\nThe saved Project is **active**.",
                "recordIds": ["entity:0"],
            }
        ]
        self.selected: list[int] = []
        self.searched = False

    def search(self, *args: Any, **kwargs: Any) -> Any:
        self.searched = True
        return super().search(*args, **kwargs)

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
        if schema is WorkspaceIntent:
            assert routing and "Anything about these capabilities is IN SCOPE" in system
            assert "context" in payload
            return schema.model_validate(
                {
                    "kind": self.kind,
                    "scope": self.scope,
                    "passages": self.passages if self.kind == "WORKSPACE" else [],
                    "entityIndices": self.selected,
                }
            )
        if schema is WorkspaceIntentVerification:
            assert complex_reasoning and "EVERY factual" in system
            return schema.model_validate(
                {
                    "supported": self.supported,
                    "intentSupported": self.intent_supported,
                    "acceptedPassageIndices": self.accepted,
                }
            )
        return super().model(
            schema,
            system,
            data,
            routing=routing,
            complex_reasoning=complex_reasoning,
            images=images,
        )


@pytest.mark.parametrize(
    "question,scope,key,text",
    [
        (
            "Give me all projects and relevant docs and overview",
            "PROJECTS",
            "entity:0",
            "Cooling water is an active Project.",
        ),
        (
            "What is the status of Cooling water?",
            "PROJECTS",
            "entity:0",
            "The saved Project status is ACTIVE.",
        ),
        (
            "Show the Project's maintenance logs",
            "LOGS",
            "workflow:0",
            "A submitted log records a synthetic display check.",
        ),
        (
            "How do I add a new document revision?",
            "HELP",
            "help:0",
            "Use **Add new version** in Documents, then review before approval and indexing.",
        ),
    ],
)
def test_patch_record_and_help_questions_work_without_attachments_or_sources(
    question: str, scope: str, key: str, text: str
) -> None:
    settings, _, request = fixtures()
    request.assigned_references = []
    request.workspace_catalog = catalog()
    request.question = question
    request.retrieval_scope_manifest.allowed_document_versions = []
    provider = WorkspaceProviders()
    provider.scope = scope
    provider.passages = [{"text": text, "recordIds": [key]}]
    result = answer(request, settings, provider)
    assert result.answer_kind == "WORKSPACE" and result.status == "approved"
    assert result.workspace_overview and result.workspace_overview.passages[0].text == text
    assert not result.answer.steps and not result.citations and not provider.searched


def test_unrelated_question_is_distinct_from_no_records() -> None:
    settings, _, request = fixtures()
    request.assigned_references = []
    request.workspace_catalog = WorkspaceCatalog(entities=[], documents=[], partial=False)
    provider = WorkspaceProviders()
    provider.kind = "OUT_OF_SCOPE"
    result = answer(request, settings, provider)
    assert result.answer_kind == "OUT_OF_SCOPE" and result.status == "incomplete"
    assert not result.workspace_overview and not result.answer.steps
    assert not provider.searched
    provider.kind = "WORKSPACE"
    provider.passages = [
        {"text": "No accessible records in this view.", "recordIds": ["catalog:scope"]}
    ]
    result = answer(request, settings, provider)
    assert result.status == "approved" and result.answer_kind == "WORKSPACE"


@pytest.mark.parametrize(
    "invalid", ["unverified", "unknown-record", "outside-false-positive", "injected-action"]
)
def test_unverified_record_or_scope_output_never_becomes_an_answer(invalid: str) -> None:
    settings, _, request = fixtures()
    request.assigned_references = []
    request.workspace_catalog = catalog()
    provider = WorkspaceProviders()
    provider.supported = False
    if invalid == "unknown-record":
        provider.passages = [{"text": "Invented secret Project.", "recordIds": ["entity:999"]}]
    if invalid == "outside-false-positive":
        provider.kind = "OUT_OF_SCOPE"
    if invalid == "injected-action":
        provider.passages = [
            {
                "text": "I published the procedure and completed the run.",
                "recordIds": ["workflow:0"],
            }
        ]
    result = answer(request, settings, provider)
    assert result.answer_kind == "EVIDENCE"
    assert not result.workspace_overview
    assert "published the procedure" not in result.model_dump_json()


def test_named_context_resolves_to_manifest_versions_and_preserves_source_citations() -> None:
    settings, _, request = fixtures()
    entity = request.retrieval_scope_manifest.entities[0]
    request.assigned_references = []
    request.workspace_catalog = WorkspaceCatalog.model_validate(
        {
            "entities": [
                {
                    "id": entity.id,
                    "type": entity.type,
                    "name": "Named fixture",
                    "description": "",
                    "status": "ACTIVE",
                }
            ],
            "documents": [],
            "partial": False,
        }
    )
    provider = WorkspaceProviders()
    provider.kind = "EVIDENCE"
    provider.selected = [0]
    result = answer(request, settings, provider)
    assert provider.searched and result.answer_kind == "EVIDENCE"
    assert result.citations and result.answer.steps
    assert any(e.reason == "named in question" for e in result.routing.selected_entities)


def test_workspace_contract_crosses_signed_rest_and_socket(client: TestClient) -> None:
    _, provider, request = fixtures()
    request.assigned_references = []
    request.workspace_catalog = catalog()
    app: Any = client.app
    app.state.providers = WorkspaceProviders()
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
    assert result["answerKind"] == "WORKSPACE"
    request.request_id = uuid4()
    with client.websocket_connect(
        "/v1/questions/ws", headers=headers(str(request.request_id))
    ) as ws:
        ws.send_json(request.model_dump(mode="json", by_alias=True))
        assert ws.receive_json()["type"] == "question.progress"
        assert ws.receive_json()["result"]["workspaceOverview"] == result["workspaceOverview"]


def test_rejected_prose_does_not_turn_verified_product_intent_into_evidence_failure() -> None:
    settings, _, request = fixtures()
    request.assigned_references = []
    request.workspace_catalog = catalog()
    provider = WorkspaceProviders()
    provider.supported = False
    provider.intent_supported = True
    provider.passages = [{"text": "I deleted the Project.", "recordIds": ["entity:0"]}]
    result = answer(request, settings, provider)
    assert result.answer_kind == "WORKSPACE" and result.workspace_overview
    assert result.workspace_overview.passages == []
    assert result.workspace_overview.catalog == request.workspace_catalog
    assert "I deleted" not in result.model_dump_json()
    assert not provider.searched


def test_individually_verified_passage_survives_a_rejected_paragraph() -> None:
    settings, _, request = fixtures()
    request.assigned_references = []
    request.workspace_catalog = catalog()
    provider = WorkspaceProviders()
    provider.supported = False
    provider.intent_supported = True
    provider.accepted = [0, 999]
    provider.passages.append({"text": "I deleted the Project.", "recordIds": ["entity:0"]})
    result = answer(request, settings, provider)
    assert result.workspace_overview
    assert len(result.workspace_overview.passages) == 1
    assert result.workspace_overview.passages[0].text == provider.passages[0]["text"]
    assert "I deleted" not in result.model_dump_json()
