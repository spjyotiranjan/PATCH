import json
import logging
import time
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

from opentelemetry import trace

request_correlation: ContextVar[str] = ContextVar("request_correlation", default="")
_telemetry_initialized = False


def configure_tracing(endpoint: str, service_name: str) -> None:
    global _telemetry_initialized
    if not endpoint or _telemetry_initialized:
        return
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    provider = TracerProvider(resource=Resource.create({"service.name": service_name}))
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint, timeout=5)))
    trace.set_tracer_provider(provider)
    _telemetry_initialized = True


@contextmanager
def stage(name: str, **metadata: str | int | float | bool) -> Iterator[None]:
    """Metadata-only spans: no prompts, source text, URLs or raw exceptions."""
    started = time.monotonic()
    with trace.get_tracer("patch-ai").start_as_current_span(
        name, record_exception=False, set_status_on_exception=False
    ) as span:
        for key, value in metadata.items():
            span.set_attribute(key, value)
        span.set_attribute("requestId", request_correlation.get())
        status = "completed"
        try:
            yield
        except Exception:
            status = "failed"
            span.set_status(trace.Status(trace.StatusCode.ERROR, "WORKFLOW_FAILED"))
            raise
        finally:
            log_event(
                logging.INFO,
                f"patch_ai.{name}",
                status=status,
                durationMs=round((time.monotonic() - started) * 1000),
                **metadata,
            )


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
        "requestId": request_correlation.get(),
        **_safe_context(context),
    }
    if span_context.is_valid:
        payload["traceId"] = format(span_context.trace_id, "032x")
    logging.getLogger("patch_ai").log(level, json.dumps(payload, separators=(",", ":")))
