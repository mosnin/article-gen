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
  2a. When `check_past_work` returns a row with `score >= 0.88`, a `warning`
      event is automatically emitted to the UI. You still must decide:
      diversify (pass 'angles to avoid' to the research subagent with the
      top similar titles) or abort with `set_status(status='failed',
      error='too_similar')`.
  3. The new-article vector is written server-side by save_article (see
     step 7); you do not call any uniqueness upsert yourself.

Workflow (happy path):
  1. check_past_work -> possibly diversify or abort
  2. invoke_subagent('research', ...) -> SerpAnalysis + competitor notes
  3. invoke_subagent('outline', ...) -> Outline
  4. invoke_subagent('writer', ...) -> article_markdown
  5. In parallel (via set_status notes): invoke_subagent('metadata', ...)
     and invoke_subagent('images', ...)
  6. invoke_subagent('qa', ...) -> QualityScore; if overall < 0.6, loop
     back to writer with corrective brief (max 1 retry).
  7. save_article(...) -> get articleId. The payload MUST include
     `outlineHeadings` (the list of H2 headings produced by the outline
     subagent) so the save-article route can populate the dedup memory
     vector correctly in a single server-side call.
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
        """Delegate a focused task to one of: research, outline, writer, metadata, images, qa, publish, refresh, audit, cluster_strategist, social_snippet, keyword_harvester."""
        try:
            agent = _lazy_subagent(name)
        except Exception as e:
            await progress.emit(
                ctx.payload.runId, "warning", agent_name="orchestrator",
                tool_name="invoke_subagent",
                message=f"unknown subagent {name!r}: {e!s}",
            )
            return json.dumps({"error": f"unknown subagent: {name}", "detail": str(e)})

        session = ctx.session.build_subagent_session()
        try:
            result = await ctx.pool.invoke(agent, brief, session=session, name=name)
        except Exception as e:
            await progress.emit(
                ctx.payload.runId, "warning", agent_name="orchestrator",
                tool_name="invoke_subagent",
                message=f"subagent {name} failed: {e!s}",
            )
            return json.dumps({"error": f"subagent {name} failed", "detail": str(e)})

        if hasattr(result, "model_dump_json"):
            return result.model_dump_json()
        if isinstance(result, str):
            return result
        return json.dumps(result)

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
        top = max((s.score for s in similar), default=0.0)
        if top >= config.DEDUP_THRESHOLD and similar:
            # Surface a clearly-formatted warning to the UI. The LLM decides what to do
            # with it (abort vs. diversify) per the instructions; this event is purely
            # informational for the human viewer.
            await progress.emit(
                run_id,
                "warning",
                agent_name="orchestrator",
                tool_name="check_past_work",
                message=(
                    f"High similarity detected ({top:.2f}) - most similar: "
                    f"\"{similar[0].title}\""
                ),
                payload={
                    "topScore": top,
                    "threshold": config.DEDUP_THRESHOLD,
                    "similarCount": len(similar),
                    "topTitles": [s.title for s in similar[:3]],
                },
            )
        return [s.model_dump() for s in similar]

    @function_tool
    async def save_article(payload: dict) -> dict:
        """Persist the finished article to Supabase. Returns {articleId, slug}.

        The ``payload`` dict must include ``outlineHeadings`` (the list of H2
        headings from the outline subagent). The consolidated
        ``/api/internal/save-article`` route uses that list to upsert the
        Upstash dedup vector server-side, so no separate uniqueness call is
        needed from Python.
        """
        save = _lazy_tool("db", "save_article")
        model = ArticleSavePayload.model_validate(
            {**payload, "userId": user_id, "runId": run_id}
        )
        ref: SavedArticleRef = await save(model)
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
    from modal_app.harness.tools.http import set_run_id
    set_run_id(payload.runId)

    run_session = RunSession(run_id=payload.runId, user_id=payload.userId)
    pool = SubAgentPool(run_id=payload.runId)
    ctx = _RunCtx(payload=payload, run_session=run_session, pool=pool)

    k = payload.kind
    if k in ("article", "autopilot", "cluster"):
        return await _run_article_pipeline(ctx)
    if k == "research_only":
        return await _run_single_subagent(
            ctx, "research", _compose_research_brief(payload)
        )
    if k == "refresh":
        return await _run_single_subagent(
            ctx, "refresh", _compose_refresh_brief(payload)
        )
    if k == "audit":
        return await _run_single_subagent(
            ctx, "audit", _compose_audit_brief(payload)
        )
    if k == "cluster_plan":
        return await _run_single_subagent(
            ctx, "cluster_strategist", _compose_cluster_plan_brief(payload)
        )
    if k == "social_snippet":
        return await _run_single_subagent(
            ctx, "social_snippet", _compose_social_snippet_brief(payload)
        )
    if k == "keyword_harvest":
        return await _run_single_subagent(
            ctx, "keyword_harvester", _compose_keyword_harvest_brief(payload)
        )
    raise ValueError(f"unknown payload kind: {k!r}")


async def _run_article_pipeline(ctx: _RunCtx) -> dict:
    payload = ctx.payload
    orchestrator = build_orchestrator(ctx)

    brief = _compose_initial_brief(payload)
    result = await Runner.run(
        orchestrator, brief, session=ctx.session.orchestrator_session
    )

    final = result.final_output
    if isinstance(final, FinalArticle):
        out_dict: dict = final.model_dump()
    elif isinstance(final, dict):
        out_dict = final
    else:
        # last-resort shape - orchestrator returned prose
        out_dict = {
            "articleId": None,
            "title": payload.topic,
            "articleMarkdown": str(final),
        }
    # Attach raw responses so the Modal entrypoint can aggregate token usage
    # for cost telemetry. Popped off before the dict reaches the webhook.
    out_dict["_rawResponses"] = getattr(result, "raw_responses", []) or []
    return out_dict


async def _run_single_subagent(ctx: _RunCtx, subagent_name: str, brief: str) -> dict:
    agent = _lazy_subagent(subagent_name)
    session = ctx.session.build_subagent_session()
    final_output, raw_responses = await ctx.pool.invoke_full(
        agent, brief, session=session, name=subagent_name
    )
    if hasattr(final_output, "model_dump"):
        out_dict = final_output.model_dump()
    elif isinstance(final_output, dict):
        out_dict = final_output
    else:
        out_dict = {"raw": str(final_output)}
    out_dict["_rawResponses"] = raw_responses
    out_dict.setdefault("kind", ctx.payload.kind)
    return out_dict


def _compose_initial_brief(payload: TriggerPayload) -> str:
    tone = payload.tone or "professional"
    audience = payload.targetAudience or "a general SEO-aware reader"
    keyword = payload.focusKeyword or payload.topic
    options = payload.options or {}
    auto_publish = bool(options.get("autoPublish"))
    platforms = options.get("platforms") or []
    return (
        f"Produce a single publication-ready article.\n\n"
        f"- userId: {payload.userId}\n"
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


def _compose_refresh_brief(p: TriggerPayload) -> str:
    return (
        "Refresh an existing article.\n\n"
        f"- userId: {p.userId}\n"
        f"- articleId: {p.articleId}\n"
        f"- focusKeyword: {p.focusKeyword or ''}\n"
        f"- reason: scheduled refresh\n\n"
        "Use your tools to fetch the prior article body and the current SERP. "
        "Identify what to update: new sections, updated stats or dates, meta "
        "description, images if truly stale. Return a RefreshResult JSON. "
        "Preserve the original article's strengths and voice."
    )


def _compose_audit_brief(p: TriggerPayload) -> str:
    ids = p.articleIds or ([p.articleId] if p.articleId else [])
    return (
        f"Audit {len(ids)} article(s): {ids}.\n"
        f"- userId: {p.userId}\n"
        f"- articleId: {p.articleId}\n"
        f"- articleIds: {ids}\n\n"
        "For each, pull GSC performance, current SERP, and existing schema. "
        "Produce an AuditReport with recommendations ranked by priority. "
        "Return an array of AuditReport JSON, or a single AuditReport if one article."
    )


def _compose_cluster_plan_brief(p: TriggerPayload) -> str:
    return (
        "Plan a topic cluster.\n\n"
        f"- userId: {p.userId}\n"
        f"- pillarTopic: {p.clusterPillarTopic or p.topic}\n"
        f"- pillarKeyword: {p.focusKeyword or p.topic}\n"
        f"- tone: {p.tone or 'professional'}\n"
        f"- clusterId (if updating existing): {p.clusterId}\n\n"
        "Use SERP + niche research to derive 10-20 cluster subtopics that together "
        "cover the topic authoritatively. Return a ClusterPlan JSON."
    )


def _compose_social_snippet_brief(p: TriggerPayload) -> str:
    platforms = p.socialPlatforms or ["twitter", "linkedin"]
    return (
        f"Produce social repurposing snippets for article {p.articleId}.\n"
        f"- userId: {p.userId}\n"
        f"- articleId: {p.articleId}\n"
        f"Platforms: {platforms}.\n"
        "For each platform produce 1-3 variants sized appropriately "
        "(tweet threads, LinkedIn posts, IG captions, etc.). Return a "
        "SocialSnippetSet JSON."
    )


def _compose_keyword_harvest_brief(p: TriggerPayload) -> str:
    return (
        "Harvest keyword candidates for this user's niche.\n"
        f"- userId: {p.userId}\n"
        f"- niche: {p.topic}\n"
        f"- existing focus keyword hint: {p.focusKeyword or ''}\n"
        f"- gscSiteUrl (for GSC-based harvest): {p.gscSiteUrl or ''}\n\n"
        "Pull 20-50 candidates from GSC queries + SERP gap analysis + competitor "
        "signals. Return a KeywordCandidateSet JSON."
    )


def _compose_research_brief(p: TriggerPayload) -> str:
    return (
        f"Research the topic '{p.topic}' (focusKeyword '{p.focusKeyword or p.topic}').\n"
        f"- userId: {p.userId}\n\n"
        "Return only the research output. Do not produce an outline or article body."
    )
