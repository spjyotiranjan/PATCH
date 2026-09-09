"""Read-only real-provider diagnostic; private captures remain in OS temp.

Run from ai with uv run python, this script's quoted path, RUN and LABEL.
Uses the existing live runner's Owner cookie and current Web manifest. No DB bypass.
"""

import json
import sys
import tempfile
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx

from patch_ai.adapters.providers import Model, Providers
from patch_ai.config import Settings
from patch_ai.schemas.contracts import QuestionRequest
from patch_ai.services.answering import answer


class DiagnosticProviders(Providers):
    def __init__(self, settings: Settings) -> None:
        super().__init__(settings)
        self.calls: list[dict[str, Any]] = []

    def model(
        self,
        schema: type[Model],
        system: str,
        data: str,
        *,
        routing: bool = False,
        complex_reasoning: bool = False,
    ) -> Model:
        result = super().model(
            schema, system, data, routing=routing, complex_reasoning=complex_reasoning
        )
        self.calls.append(
            {
                "schema": schema.__name__,
                "input": json.loads(data),
                "output": result.model_dump(by_alias=True),
            }
        )
        return result


def main() -> None:
    run, label = sys.argv[1:3]
    if not all(c.isalnum() or c == "-" for c in run + label):
        raise ValueError("Invalid diagnostic identifier")
    directory = Path(tempfile.gettempdir()) / f"patch-acceptance-{run}"
    state = json.loads((directory / "private-state.json").read_text(encoding="utf-8"))
    cookie = "; ".join(f"{k}={v}" for k, v in state["cookies"]["owner"].items())
    with httpx.Client(
        base_url="http://localhost:3000", headers={"cookie": cookie}, trust_env=False, timeout=30
    ) as web:
        response = web.get("/api/chat/references")
        response.raise_for_status()
        manifest = response.json()
        response = web.get("/api/auth/session")
        response.raise_for_status()
        actor = response.json()["user"]
    cases = [
        (
            "pressure",
            "What is the target discharge pressure and which instrument supplies feedback?",
            "PROJECT",
            state["ids"]["project"],
        ),
        (
            "signal",
            "Which signal range connects PT-101 to VFD-101?",
            "DOCUMENT",
            state["docs"]["mixed"]["documentId"],
        ),
    ]
    for name, question, kind, identity in cases:
        providers = DiagnosticProviders(Settings())
        request = QuestionRequest.model_validate(
            {
                "requestId": str(uuid4()),
                "contractVersion": "v1",
                "actor": {"id": actor["id"], "tenantId": actor["tenantId"]},
                "chatSession": {"id": f"diagnostic-{label}-{name}"},
                "question": question,
                "assignedReferences": [{"type": kind, "id": identity}],
                "retrievalScopeManifest": manifest,
                "retrievalPolicy": {
                    "approvedOnly": True,
                    "requireSourceLocation": True,
                    "allowStructuralFallback": True,
                },
            }
        )
        result = answer(request, providers.settings, providers)
        capture = {
            "request": request.model_dump(mode="json", by_alias=True),
            "calls": providers.calls,
            "result": result.model_dump(mode="json", by_alias=True),
        }
        (directory / f"diagnostic-{label}-{name}.json").write_text(
            json.dumps(capture, indent=2), encoding="utf-8"
        )
        print(
            json.dumps(
                {
                    "case": name,
                    "status": result.status,
                    "claimCount": len(result.answer.steps),
                    "stages": [
                        {
                            "schema": c["schema"],
                            "flags": {
                                k: v
                                for k, v in c["output"].items()
                                if k
                                in {
                                    "status",
                                    "supported",
                                    "conflict",
                                    "missingMandatorySafetyEvidence",
                                }
                            },
                        }
                        for c in providers.calls
                    ],
                }
            )
        )


if __name__ == "__main__":
    main()
