import json
import logging
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

from opentelemetry import trace

_SENSITIVE_PARTS = ("authorization", "cookie", "credential", "password", "secret", "token", "key")


def configure_logging(level: str) -> None:
    logging.basicConfig(level=getattr(logging, level.upper(), logging.INFO), format="%(message)s")


def _safe_context(context: Mapping[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key, value in context.items()
        if not any(part in key.lower() for part in _SENSITIVE_PARTS)
    }


def log_event(level: int, event: str, **context: Any) -> None:
    span_context = trace.get_current_span().get_span_context()
    payload: dict[str, Any] = {
        "timestamp": datetime.now(UTC).isoformat(),
        "event": event,
        **_safe_context(context),
    }
    if span_context.is_valid:
        payload["traceId"] = format(span_context.trace_id, "032x")
    logging.getLogger("patch_ai").log(level, json.dumps(payload, separators=(",", ":")))
