"""Async subagent pool with bounded concurrency.

``SubAgentPool`` fan-outs subagent invocations from the orchestrator (e.g.
run metadata + images concurrently). Concurrency is capped at
``config.SUBAGENT_CONCURRENCY`` via an asyncio semaphore so a single run
cannot exhaust the worker's network / model-rate budget.

Each invocation emits ``agent_started`` / ``agent_ended`` webhook events
through ``harness.progress``. A short correlation id (``{name}:{8-hex}``) is
threaded through the ``message`` field so the UI can match start to end even
when multiple copies of the same subagent are in flight.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

import openai
from agents import Agent, Runner, SQLiteSession
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from modal_app import config
from modal_app.harness import progress


def _is_runner_retryable(exc: BaseException) -> bool:
    if isinstance(exc, openai.RateLimitError):
        return True
    if isinstance(exc, openai.APIConnectionError):
        return True
    if isinstance(exc, openai.APIStatusError):
        return getattr(exc, "status_code", 0) >= 500
    return False


async def _runner_run_with_retry(
    agent: Agent, brief: str, *, session: SQLiteSession | None = None
) -> Any:
    """Wrap ``Runner.run`` with bounded retries on rate-limit / 5xx / network."""

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=20),
        retry=retry_if_exception(_is_runner_retryable),
        reraise=True,
    )
    async def _attempt() -> Any:
        return await Runner.run(agent, brief, session=session)

    return await _attempt()


class SubAgentPool:
    def __init__(self, run_id: str) -> None:
        self.run_id = run_id
        self._active: dict[str, asyncio.Task] = {}
        self._sem = asyncio.Semaphore(config.SUBAGENT_CONCURRENCY)
        # Per-run accumulator of raw_responses from invoke() calls so the
        # article pipeline can include subagent token usage in cost telemetry.
        self._subagent_responses: list[Any] = []

    def list_active(self) -> list[str]:
        return list(self._active.keys())

    async def invoke(
        self,
        agent: Agent,
        brief: str,
        *,
        session: SQLiteSession | None = None,
        name: str | None = None,
    ) -> Any:
        corr_id = f"{name or agent.name}:{uuid.uuid4().hex[:8]}"

        async def _run() -> Any:
            async with self._sem:
                await progress.emit(
                    self.run_id, "agent_started", agent_name=agent.name, message=corr_id
                )
                try:
                    result = await _runner_run_with_retry(
                        agent, brief, session=session
                    )
                    await progress.emit(
                        self.run_id, "agent_ended", agent_name=agent.name, message=corr_id
                    )
                    # Accumulate raw_responses for downstream cost aggregation.
                    raw = getattr(result, "raw_responses", None) or []
                    self._subagent_responses.extend(raw)
                    return result.final_output
                except Exception as e:
                    await progress.emit(
                        self.run_id,
                        "agent_ended",
                        agent_name=agent.name,
                        message=f"{corr_id} error: {e!s}",
                    )
                    raise

        task = asyncio.create_task(_run())
        self._active[corr_id] = task
        try:
            return await task
        finally:
            self._active.pop(corr_id, None)

    def collect_subagent_responses(self) -> list[Any]:
        """Drain and return the accumulated subagent raw_responses list."""
        out = self._subagent_responses
        self._subagent_responses = []
        return out

    async def invoke_full(
        self,
        agent: Agent,
        brief: str,
        *,
        session: SQLiteSession | None = None,
        name: str | None = None,
    ) -> tuple[Any, list[Any]]:
        """Same as invoke() but also returns result.raw_responses for cost aggregation."""
        corr_id = f"{name or agent.name}:{uuid.uuid4().hex[:8]}"

        async def _run() -> tuple[Any, list[Any]]:
            async with self._sem:
                await progress.emit(
                    self.run_id, "agent_started", agent_name=agent.name, message=corr_id
                )
                try:
                    result = await _runner_run_with_retry(
                        agent, brief, session=session
                    )
                    await progress.emit(
                        self.run_id, "agent_ended", agent_name=agent.name, message=corr_id
                    )
                    raw = getattr(result, "raw_responses", None) or []
                    return result.final_output, list(raw)
                except Exception as e:
                    await progress.emit(
                        self.run_id,
                        "agent_ended",
                        agent_name=agent.name,
                        message=f"{corr_id} error: {e!s}",
                    )
                    raise

        task = asyncio.create_task(_run())
        self._active[corr_id] = task
        try:
            return await task
        finally:
            self._active.pop(corr_id, None)

    async def invoke_many(
        self,
        calls: list[tuple[Agent, str, SQLiteSession | None]],
    ) -> list[Any]:
        """Fan-out multiple subagent invocations concurrently (bounded by semaphore)."""
        tasks = [self.invoke(a, b, session=s) for (a, b, s) in calls]
        return await asyncio.gather(*tasks, return_exceptions=False)
