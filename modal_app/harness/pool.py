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

from agents import Agent, Runner, Session

from modal_app import config
from modal_app.harness import progress


class SubAgentPool:
    def __init__(self, run_id: str) -> None:
        self.run_id = run_id
        self._active: dict[str, asyncio.Task] = {}
        self._sem = asyncio.Semaphore(config.SUBAGENT_CONCURRENCY)

    def list_active(self) -> list[str]:
        return list(self._active.keys())

    async def invoke(
        self,
        agent: Agent,
        brief: str,
        *,
        session: Session | None = None,
        name: str | None = None,
    ) -> Any:
        corr_id = f"{name or agent.name}:{uuid.uuid4().hex[:8]}"

        async def _run() -> Any:
            async with self._sem:
                await progress.emit(
                    self.run_id, "agent_started", agent_name=agent.name, message=corr_id
                )
                try:
                    result = await Runner.run(agent, brief, session=session)
                    await progress.emit(
                        self.run_id, "agent_ended", agent_name=agent.name, message=corr_id
                    )
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

    async def invoke_many(
        self,
        calls: list[tuple[Agent, str, Session | None]],
    ) -> list[Any]:
        """Fan-out multiple subagent invocations concurrently (bounded by semaphore)."""
        tasks = [self.invoke(a, b, session=s) for (a, b, s) in calls]
        return await asyncio.gather(*tasks, return_exceptions=False)
