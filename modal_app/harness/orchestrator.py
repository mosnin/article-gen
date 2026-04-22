"""Top-level orchestrator agent.

Owns the article-generation plan, delegates to subagents via invoke_subagent,
and enforces the dedup policy before spending compute on writing.
"""
from __future__ import annotations

import asyncio
import importlib
import json
from typing import Any

from agents import Agent, Runner, function_tool

from modal_app import config
from modal_app.harness import progress
from modal_app.harness.models import (
    ArticleSavePayload,
    FinalArticle,
    Metadata,
    Outline,
    SavedArticleRef,
    SerpAnalysis,
    SimilarArticle,
    TriggerPayload,
)
from modal_app.harness.pool import SubAgentPool
from modal_app.harness.sessions import RunSession


# --- Orchestrator instructions (system prompt) ---
ORCHESTRATOR_INSTRUCTIONS = """
You are the Orchestrator for an agentic article-generation harness.

Your job is to coordinate a team of subagents to produce a single
publication-ready article. You do NOT write prose yourself; you delegate.

Subagent roster (call via `invoke_subagent(name, brief)`):
  - research   - SERP analysis, competitor gaps, dedup sanity check
  - outline    - structured outline from research
  - writer     - writes the full article body (section-by-section)
  - metadata   - title, slug, meta description, keywords, JSON-LD schema
  - images     - image prompts + DALL-E generation + Supabase upload
  - qa         - keyword density, E-E-A-T, brand-voice scoring
  - publish    - (only if options.autoPublish) multi-platform publish

Strict writing rules (enforce via subagent briefs):
  - Output article_markdown with a single H1, H2/H3 nesting, 500-8000 words.
  - NO em-dashes anywhere in the final article.
  - Focus keyword must appear in title, first paragraph, at least one H2,
    and with natural frequency throughout (~0.8-1.5% density).
  - Include internal linking suggestions where relevant (the writer has a
    tool for this).
  - Reflect E-E-A-T: experience, expertise, authoritativeness, trust.

Dedup policy (CRITICAL):
  1. Before invoking `research`, call `check_past_work(topic, focus_keyword)`.
  2. If any returned similarity score >= {dedup_threshold:.2f}, you MUST
     either (a) pass an explicit "angles to avoid" list to the research
     subagent derived from the similar titles, or (b) if the topic is
     essentially identical, abort with `set_status(status='failed',
     error='too_similar')` and return.
  3. After a successful save_article, you will call
     `upsert_uniqueness` (available indirectly via save_article) to record
     the new vector.

Workflow (happy path):
  1. check_past_work -> possibly diversify or abort
  2. invoke_subagent('research', ...) -> SerpAnalysis + competitor notes
  3. invoke_subagent('outline', ...) -> Outline
  4. invoke_subagent('writer', ...) -> article_markdown
  5. In parallel (via set_status notes): invoke_subagent('metadata', ...)
     and invoke_subagent('images', ...)
  6. invoke_subagent('qa', ...) -> QualityScore; if overall < 0.6, loop
     back to writer with corrective brief (max 1 retry).
  7. save_article(...) -> get articleId
  8. If options.autoPublish: invoke_subagent('publish', ...).
  9. Return FinalArticle JSON as final_output.

Always emit progress via set_status with a human-readable currentStep
each time you advance a major stage.
""".strip().format(dedup_threshold=config.DEDUP_THRESHOLD)


# --- Lazy import helpers ---
def _lazy_subagent(name: str) -> Agent:
    try:
        mod = importlib.import_module(f"modal_app.harness.subagents.{name}")
        return mod.build_agent()
    except ImportError as e:
        raise RuntimeError(f"subagent '{name}' not implemented yet: {e}") from e


def _lazy_tool(module: str, attr: str):
    try:
        mod = importlib.import_module(f"modal_app.harness.tools.{module}")
        return getattr(mod, attr)
    except ImportError as e:
        raise RuntimeError(f"tool module '{module}' not implemented yet: {e}") from e


# --- Orchestrator-scoped state (set per-run via build_orchestrator) ---
class _RunCtx:
    """Per-run context accessible to the function_tool wrappers via closure."""

    def __init__(
        self,
        payload: TriggerPayload,
        run_session: RunSession,
        pool: SubAgentPool,
    ):
        self.payload = payload
        self.session = run_session
        self.pool = pool


def build_orchestrator(ctx: _RunCtx) -> Agent:
    run_id = ctx.payload.runId
    user_id = ctx.payload.userId

    @function_tool
    async def invoke_subagent(name: str, brief: str) -> str:
        """Delegate a focused task to a subagent.

        Valid names: research, outline, writer, metadata, images, qa, publish.
        """
        agent = _lazy_subagent(name)
        session = ctx.session.build_subagent_session()
        result = await ctx.pool.invoke(agent, brief, session=session, name=name)
        if hasattr(result, "model_dump_json"):
            return result.model_dump_json()
        return json.dumps(result) if not isinstance(result, str) else result

    @function_tool
    def list_subagents() -> list[str]:
        """Return the set of currently-running subagent correlation ids."""
        return ctx.pool.list_active()

    @function_tool
    async def set_status(
        status: str,
        current_step: str | None = None,
        progress_pct: int | None = None,
        error: str | None = None,
    ) -> None:
        """Update the agent_runs row.

        status must be one of: running, succeeded, failed, cancelled.
        """
        await progress.emit(
            run_id,
            "progress",
            agent_name="orchestrator",
            message=current_step,
            status_update={
                k: v
                for k, v in {
                    "status": status,
                    "currentStep": current_step,
                    "progressPct": progress_pct,
                    "error": error,
                }.items()
                if v is not None
            },
        )

    @function_tool
    async def check_past_work(
        topic: str, focus_keyword: str | None = None, k: int = 5
    ) -> list[dict]:
        """Query Upstash Vector for semantically-similar prior articles in this user's namespace."""
        check_uniqueness = _lazy_tool("uniqueness", "check_uniqueness")
        similar: list[SimilarArticle] = await check_uniqueness(
            user_id=user_id, topic=topic, keyword=focus_keyword or "", k=k
        )
        ctx.session.past_work = similar
        return [s.model_dump() for s in similar]

    @function_tool
    async def save_article(payload: dict) -> dict:
        """Persist the finished article to Supabase. Returns {articleId, slug}.

        Also upserts the semantic-memory vector for future dedup.
        """
        save = _lazy_tool("db", "save_article")
        upsert = _lazy_tool("uniqueness", "upsert_uniqueness_vector")
        model = ArticleSavePayload.model_validate(
            {**payload, "userId": user_id, "runId": run_id}
        )
        ref: SavedArticleRef = await save(model)
        # best-effort vector upsert - don't fail the run if Upstash is flaky
        try:
            await upsert(
                user_id=user_id,
                article_id=ref.articleId,
                title=model.title,
                keyword=model.focusKeyword,
                topic=model.topic,
                outline=[],  # writer may provide headings via metadata; orchestrator can re-call
            )
        except Exception as e:
            await progress.emit(
                run_id,
                "warning",
                agent_name="orchestrator",
                message=f"uniqueness upsert failed: {e!s}",
            )
        return ref.model_dump()

    @function_tool
    async def emit_progress(message: str, payload: dict | None = None) -> None:
        """Free-form progress note from the orchestrator."""
        await progress.emit(
            run_id,
            "message",
            agent_name="orchestrator",
            message=message,
            payload=payload,
        )

    @function_tool
    async def deduct_credit(
        article_id: str | None = None, description: str = "agent run"
    ) -> int:
        """Decrement user credits via the Next.js internal API. Returns new balance."""
        deduct = _lazy_tool("db", "deduct_credit")
        return await deduct(user_id=user_id, article_id=article_id, description=description)

    return Agent(
        name="Orchestrator",
        instructions=ORCHESTRATOR_INSTRUCTIONS,
        model=config.MODEL_ORCHESTRATOR,
        tools=[
            invoke_subagent,
            list_subagents,
            set_status,
            check_past_work,
            save_article,
            emit_progress,
            deduct_credit,
        ],
    )


# --- Public entrypoint called from modal_app/modal_app.py ---
async def run(payload_dict: dict) -> dict:
    payload = TriggerPayload.model_validate(payload_dict)
    run_session = RunSession(run_id=payload.runId, user_id=payload.userId)
    pool = SubAgentPool(run_id=payload.runId)
    ctx = _RunCtx(payload=payload, run_session=run_session, pool=pool)

    orchestrator = build_orchestrator(ctx)

    brief = _compose_initial_brief(payload)
    result = await Runner.run(
        orchestrator, brief, session=run_session.orchestrator_session
    )

    final = result.final_output
    if isinstance(final, FinalArticle):
        return final.model_dump()
    if isinstance(final, dict):
        return final
    # last-resort shape - orchestrator returned prose
    return {
        "articleId": None,
        "title": payload.topic,
        "articleMarkdown": str(final),
    }


def _compose_initial_brief(payload: TriggerPayload) -> str:
    tone = payload.tone or "professional"
    audience = payload.targetAudience or "a general SEO-aware reader"
    keyword = payload.focusKeyword or payload.topic
    options = payload.options or {}
    auto_publish = bool(options.get("autoPublish"))
    platforms = options.get("platforms") or []
    return (
        f"Produce a single publication-ready article.\n\n"
        f"- topic: {payload.topic}\n"
        f"- focusKeyword: {keyword}\n"
        f"- tone: {tone}\n"
        f"- targetAudience: {audience}\n"
        f"- quality: {payload.quality}\n"
        f"- autoPublish: {auto_publish}\n"
        f"- platforms: {json.dumps(platforms)}\n\n"
        f"Follow the workflow in your instructions. Call check_past_work FIRST.\n"
        f"Return a FinalArticle JSON shape as your final_output."
    )
