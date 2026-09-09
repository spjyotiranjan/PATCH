from pathlib import Path
from typing import Any

import pytest
from pydantic import BaseModel, ValidationError

from patch_ai.adapters.providers import Providers
from patch_ai.config import Settings

REAL_MODEL = Providers.model


class Output(BaseModel):
    value: str


def test_local_environment_overrides_legacy_and_process_overrides_local(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    legacy = tmp_path / ".env"
    local = tmp_path / ".env.local"
    legacy.write_text("OPENAI_ANSWER_MODEL=legacy-model\n", encoding="utf-8")
    local.write_text(
        "OPENAI_ANSWER_MODEL=local-model\nOPENAI_ANSWER_REASONING_EFFORT=high\n", encoding="utf-8"
    )
    monkeypatch.delenv("OPENAI_ANSWER_MODEL", raising=False)
    monkeypatch.delenv("OPENAI_ANSWER_REASONING_EFFORT", raising=False)
    settings = Settings(_env_file=(legacy, local))  # pyright: ignore[reportCallIssue]
    assert settings.openai_answer_model == "local-model"
    assert settings.openai_answer_reasoning_effort == "high"
    monkeypatch.setenv("OPENAI_ANSWER_MODEL", "process-model")
    process_settings = Settings(_env_file=(legacy, local))  # pyright: ignore[reportCallIssue]
    assert process_settings.openai_answer_model == "process-model"


def test_text_vector_namespace_is_configured_independently_from_app_env() -> None:
    settings = Settings(
        _env_file=None,  # pyright: ignore[reportCallIssue]
        app_env="staging",
        pinecone_namespace="staging-text",
    )
    assert settings.app_env == "staging"
    assert settings.pinecone_namespace == "staging-text"


@pytest.mark.parametrize(
    "field_name,model_id",
    [
        ("openai_answer_model", "GPT-5.6-TERRA"),
        ("openai_routing_model", "gpt 5.6 luna"),
        ("openai_complex_reasoning_model", "../gpt-5.6-terra"),
        ("openai_embedding_model", "text-embedding-3-large/preview"),
        ("openai_answer_model", "gpt-5.6-terra-"),
    ],
)
def test_openai_model_ids_reject_non_openai_identifier_characters(
    field_name: str, model_id: str
) -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **{field_name: model_id})  # pyright: ignore[reportCallIssue]


def test_openai_model_ids_accept_alias_snapshot_and_fine_tune_shapes() -> None:
    settings = Settings(
        _env_file=None,  # pyright: ignore[reportCallIssue]
        openai_answer_model="gpt-5.6-terra",
        openai_routing_model="gpt-5.6-luna-2026-08-01",
        openai_complex_reasoning_model="ft:gpt-5.6-terra:patch:safety-review:abc123",
        openai_embedding_model="text-embedding-3-large",
    )

    assert settings.openai_routing_model == "gpt-5.6-luna-2026-08-01"


@pytest.mark.parametrize(
    "routing,complex_reasoning,expected",
    [
        (False, False, ("answer-configured", "medium")),
        (True, False, ("routing-configured", "low")),
        (False, True, ("verification-configured", "high")),
    ],
)
def test_model_and_reasoning_selection_come_from_settings(
    monkeypatch: pytest.MonkeyPatch,
    routing: bool,
    complex_reasoning: bool,
    expected: tuple[str, str],
) -> None:
    calls: list[dict[str, Any]] = []

    class FakeModel:
        def __init__(self, **kwargs: Any) -> None:
            calls.append(kwargs)

        def with_structured_output(self, schema: type[BaseModel], *, method: str) -> "FakeModel":
            assert schema is Output and method == "json_schema"
            return self

        def invoke(self, *args: Any, **kwargs: Any) -> Output:
            return Output(value="fixture")

    monkeypatch.setattr("patch_ai.adapters.providers.ChatOpenAI", FakeModel)
    settings = Settings(
        _env_file=None,  # pyright: ignore[reportCallIssue]
        openai_answer_model="answer-configured",
        openai_routing_model="routing-configured",
        openai_complex_reasoning_model="verification-configured",
    )
    result = REAL_MODEL(
        Providers(settings),
        Output,
        "untrusted",
        "synthetic",
        routing=routing,
        complex_reasoning=complex_reasoning,
    )
    assert result.value == "fixture"
    assert (calls[0]["model"], calls[0]["reasoning_effort"]) == expected
    assert calls[0]["max_completion_tokens"] == 8192
    assert not {"base_url", "organization", "default_headers"}.intersection(calls[0])


def test_images_use_bounded_high_detail_content_blocks(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: list[Any] = []

    class FakeModel:
        def __init__(self, **kwargs: Any) -> None:
            pass

        def with_structured_output(self, *args: Any, **kwargs: Any) -> "FakeModel":
            return self

        def invoke(self, messages: Any, **kwargs: Any) -> Output:
            captured.append(messages)
            return Output(value="fixture")

    monkeypatch.setattr("patch_ai.adapters.providers.ChatOpenAI", FakeModel)
    provider = Providers(Settings(_env_file=None))  # pyright: ignore[reportCallIssue]
    REAL_MODEL(provider, Output, "system", "describe", images=(b"png",))
    assert captured[0][1].content == [
        {"type": "text", "text": "describe"},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,cG5n", "detail": "high"}},
    ]
    with pytest.raises(ValueError, match="VISUAL_MODEL_INPUT_LIMIT"):
        REAL_MODEL(provider, Output, "system", "describe", images=(b"x",) * 5)
    assert len(captured) == 1
