"""Cooperative deadline shared by blocking workflow stages and provider adapters."""

import time
from contextvars import ContextVar

workflow_deadline: ContextVar[float | None] = ContextVar("workflow_deadline", default=None)


def remaining_seconds(maximum: float) -> float:
    deadline = workflow_deadline.get()
    if deadline is None:
        return maximum
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError("WORKFLOW_DEADLINE_EXCEEDED")
    return min(maximum, remaining)
