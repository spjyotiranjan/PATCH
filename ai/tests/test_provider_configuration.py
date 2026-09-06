from pathlib import Path
from typing import Any

import pytest
from pydantic import BaseModel

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
