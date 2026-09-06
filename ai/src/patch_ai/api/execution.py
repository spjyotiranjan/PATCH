import asyncio
import logging
import time
from collections.abc import Callable
from typing import ParamSpec, TypeVar

from langsmith import tracing_context

from patch_ai.api.budget import workflow_deadline
from patch_ai.observability import log_event, request_correlation, stage

P = ParamSpec("P")
T = TypeVar("T")


class WorkflowCapacityError(Exception):
    pass


class WorkflowExecutor:
    """Timeouts retain occupied capacity until the underlying bounded call ends."""

    def __init__(self, capacity: int = 4) -> None:
        self.semaphore = asyncio.Semaphore(capacity)

    async def run(
        self, function: Callable[P, T], timeout: int, *args: P.args, **kwargs: P.kwargs
    ) -> T:
        if self.semaphore.locked():
            raise WorkflowCapacityError()
        await self.semaphore.acquire()
        started = time.monotonic()

        def execute() -> T:
            # Default LangSmith callbacks export raw model/source content. Use
            # our metadata-only telemetry until a reviewed redaction exporter exists.
            request_id = str(getattr(args[0], "request_id", "")) if args else ""
            marker = request_correlation.set(request_id)
            deadline_marker = workflow_deadline.set(started + timeout)
            try:
                with tracing_context(enabled=False), stage("workflow", workflow=function.__name__):
                    return function(*args, **kwargs)
            finally:
                workflow_deadline.reset(deadline_marker)
                request_correlation.reset(marker)

        task = asyncio.create_task(asyncio.to_thread(execute))

        def completed(future: asyncio.Task[T]) -> None:
            self.semaphore.release()
            if not future.cancelled():
                future.exception()  # Consume errors even if the requester disconnected.
            log_event(
                logging.INFO,
                "patch_ai.workflow.completed",
                workflow=function.__name__,
                requestId=str(getattr(args[0], "request_id", "")) if args else "",
                durationMs=round((time.monotonic() - started) * 1000),
            )

        task.add_done_callback(completed)
        try:
            return await asyncio.wait_for(asyncio.shield(task), timeout)
        except TimeoutError as error:
            raise WorkflowCapacityError() from error
