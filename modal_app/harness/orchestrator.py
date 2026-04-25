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
from modal_app.harness.pool import SubAgentPool, _runner_run_with_retry
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
            {**payload, "userId": user_id, "runId": run_id, "agentRunId": run_id}
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
    from modal_app.harness.tools.http import set_run_id, set_user_id
    set_run_id(payload.runId)
    set_user_id(payload.userId)

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
    if k == "topic_research":
        return await _run_single_subagent(
            ctx, "topic_researcher", _compose_topic_research_brief(payload)
        )
    if k == "research_and_write":
        return await _run_research_and_write(ctx)
    if k == "competitor_monitor":
        return await _run_single_subagent(
            ctx, "competitor_monitor", _compose_competitor_monitor_brief(payload)
        )
    if k == "internal_link_optimize":
        return await _run_single_subagent(
            ctx, "internal_link_optimizer", _compose_link_optimize_brief(payload)
        )
    if k == "schema_doctor":
        return await _run_single_subagent(
            ctx, "schema_doctor", _compose_schema_doctor_brief(payload)
        )
    if k == "content_brief":
        return await _run_single_subagent(
            ctx, "content_brief", _compose_content_brief_brief(payload)
        )
    if k == "seasonal_calendar":
        return await _run_single_subagent(
            ctx, "seasonal_calendar", _compose_seasonal_calendar_brief(payload)
        )
    if k == "cannibalization_resolve":
        return await _run_single_subagent(
            ctx, "cannibalization_resolver", _compose_cannibalization_brief(payload)
        )
    if k == "image_optimize":
        return await _run_single_subagent(
            ctx, "image_optimizer", _compose_image_optimize_brief(payload)
        )
    if k == "performance_coach":
        return await _run_single_subagent(
            ctx, "performance_coach", _compose_performance_coach_brief(payload)
        )
    if k == "newsletter_digest":
        return await _run_single_subagent(
            ctx, "newsletter_digest", _compose_newsletter_digest_brief(payload)
        )
    if k == "social_publish":
        return await _run_single_subagent(
            ctx, "social_publisher", _compose_social_publish_brief(payload)
        )
    if k == "sponsorship_fit":
        return await _run_single_subagent(
            ctx, "sponsorship_fit", _compose_sponsorship_fit_brief(payload)
        )
    raise ValueError(f"unknown payload kind: {k!r}")


async def _run_article_pipeline(ctx: _RunCtx) -> dict:
    payload = ctx.payload
    orchestrator = build_orchestrator(ctx)

    brief = _compose_initial_brief(payload)
    result = await _runner_run_with_retry(
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
    raw_top = list(getattr(result, "raw_responses", []) or [])
    raw_top.extend(ctx.pool.collect_subagent_responses())
    out_dict["_rawResponses"] = raw_top
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


async def _run_research_and_write(ctx: _RunCtx) -> dict:
    """Two-phase pipeline: research candidates, validate, then hand off to
    the article pipeline for the top-ranked proposal. Streams progress to
    the same run."""
    from modal_app.harness import topic_filter
    from modal_app.harness.models import TopicProposalSet

    payload = ctx.payload

    # Phase 1: TopicResearcher
    researcher = _lazy_subagent("topic_researcher")
    researcher_session = ctx.session.build_subagent_session()
    researcher_brief = _compose_topic_research_brief(payload)
    raw_set = await ctx.pool.invoke(
        researcher, researcher_brief,
        session=researcher_session, name="topic_researcher",
    )
    proposal_set = _coerce_topic_proposal_set(raw_set, payload.topic)

    # Phase 2: programmatic on-topic filter
    kept, programmatic_rejects = topic_filter.filter_on_topic(
        proposal_set.proposals, required_niche=payload.topic
    )
    proposal_set.proposals = kept
    proposal_set.rejected.extend(programmatic_rejects)

    # Phase 3: TopicValidator critic
    if kept:
        validator = _lazy_subagent("topic_validator")
        validator_session = ctx.session.build_subagent_session()
        validator_brief = (
            "Critic pass on the following TopicProposalSet. Apply E-E-A-T, "
            "freshness, and cannibalization filters. Drop weak ones. Return "
            "a TopicProposalSet JSON.\n\n"
            f"niche: {payload.topic}\n\n"
            f"input set: {proposal_set.model_dump_json()}"
        )
        validated = await ctx.pool.invoke(
            validator, validator_brief,
            session=validator_session, name="topic_validator",
        )
        proposal_set = _coerce_topic_proposal_set(validated, payload.topic)

    if not proposal_set.proposals:
        await progress.emit(
            payload.runId, "warning",
            agent_name="orchestrator",
            message="research_and_write: no proposals survived filtering",
        )
        return {
            "kind": "research_and_write",
            "articleId": None,
            "proposalsConsidered": len(proposal_set.rejected),
            "rejected": [r.model_dump() for r in proposal_set.rejected],
        }

    # Phase 4: pick top-1 by relevance and hand off
    top = max(proposal_set.proposals, key=lambda p: p.relevanceScore)
    await progress.emit(
        payload.runId, "handoff",
        agent_name="orchestrator",
        message=f"handoff to article pipeline: {top.title!r}",
        payload={"focusKeyword": top.focusKeyword, "relevance": top.relevanceScore},
    )

    # Phase 5: build a copy of the payload pinned to the chosen proposal so the
    # caller's TriggerPayload (and downstream consumers like check_past_work
    # or articles.topic) keep the original niche string intact.
    inner_payload = payload.model_copy(
        update={
            "topic": top.title,
            "focusKeyword": top.focusKeyword,
            "options": {
                **(payload.options or {}),
                "originalNiche": payload.topic,
            },
        }
    )
    inner_ctx = _RunCtx(
        payload=inner_payload, run_session=ctx.session, pool=ctx.pool
    )
    article_result = await _run_article_pipeline(inner_ctx)
    # Fold any subagent responses accumulated during this two-phase run that
    # weren't already drained by the inner article pipeline.
    extra = ctx.pool.collect_subagent_responses()
    if extra:
        existing = article_result.get("_rawResponses") or []
        article_result["_rawResponses"] = list(existing) + extra

    article_result["kind"] = "research_and_write"
    article_result["chosenProposal"] = top.model_dump()
    article_result["rejectedProposals"] = [r.model_dump() for r in proposal_set.rejected]
    return article_result


def _coerce_topic_proposal_set(raw, niche: str):
    from modal_app.harness.models import TopicProposalSet
    if isinstance(raw, TopicProposalSet):
        return raw
    if hasattr(raw, "model_dump"):
        raw = raw.model_dump()
    if isinstance(raw, str):
        return TopicProposalSet.model_validate_json(raw)
    if isinstance(raw, dict):
        return TopicProposalSet.model_validate(raw)
    # Last resort: treat as empty set
    return TopicProposalSet(niche=niche, proposals=[], rejected=[], rationale="")


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


def _compose_topic_research_brief(p: TriggerPayload) -> str:
    return (
        "Research candidate article topics for this niche.\n\n"
        f"- userId: {p.userId}\n"
        f"- niche: {p.topic}\n"
        f"- tone hint: {p.tone or 'neutral'}\n"
        f"- audience: {p.targetAudience or 'general'}\n\n"
        "Use web_search and find_recent_news to gather signals. "
        "Apply the dedup + niche + evidence + freshness rules. Save the "
        "approved proposals via save_topic_proposals. Return a "
        "TopicProposalSet JSON with niche, proposals, and rejected[]."
    )


def _compose_competitor_monitor_brief(p: TriggerPayload) -> str:
    return (
        "Monitor competitor sites for new articles in the user's niche.\n\n"
        f"- userId: {p.userId}\n"
        f"- niche: {p.topic}\n"
        f"- competitorIds (subset to scan, empty = all active): {p.competitorIds}\n\n"
        "Pull each competitor's RSS feed or sitemap, filter to articles "
        "published in the last 14 days, classify each, and propose a "
        "rebuttal angle for each. Skip articles already in competitor_articles. "
        "Return a CompetitorMonitorReport JSON."
    )


def _compose_link_optimize_brief(p: TriggerPayload) -> str:
    return (
        "Find missed internal-linking opportunities across this user's article corpus.\n\n"
        f"- userId: {p.userId}\n\n"
        "Pull recent published articles, look for anchor candidates that should "
        "link to other published articles (and don't yet). Score by relevance "
        "(0..1, drop < 0.6). Save suggestions via save_link_suggestions. "
        "Return a LinkOptimizationReport JSON."
    )


def _compose_schema_doctor_brief(p: TriggerPayload) -> str:
    return (
        "Audit and improve JSON-LD schema for an article.\n\n"
        f"- userId: {p.userId}\n"
        f"- articleId: {p.articleId}\n\n"
        "Fetch the article and its current schema_json. Validate against schema.org "
        "(Article + FAQPage + HowTo + Product as appropriate). Propose a recommended "
        "schema. Save via save_schema_diagnosis. Return a SchemaDiagnosis JSON."
    )


def _compose_content_brief_brief(p: TriggerPayload) -> str:
    return (
        "Produce a detailed content brief BEFORE writing.\n\n"
        f"- userId: {p.userId}\n"
        f"- topic: {p.topic}\n"
        f"- focusKeyword: {p.focusKeyword or p.topic}\n"
        f"- tone: {p.tone or 'neutral'}\n"
        f"- targetAudience: {p.targetAudience or 'general'}\n\n"
        "Use SERP analysis + niche research to determine target word count, must-cover "
        "entities, recommended source URLs, reader persona, intent, and a draft outline "
        "hint. Save via save_content_brief. Return a ContentBriefArtifact JSON."
    )


def _compose_seasonal_calendar_brief(p: TriggerPayload) -> str:
    return (
        "Plot ideal publish dates for seasonal/recurring content in this user's niche.\n\n"
        f"- userId: {p.userId}\n"
        f"- niche: {p.topic}\n"
        f"- horizon: 90 days from today\n\n"
        "Combine the user's article history (look for recurring patterns) with public "
        "seasonal signals (holidays, industry cycles, conference seasons). Propose 5-15 "
        "SeasonalRecommendation entries with concrete recommendedPublishAt dates. "
        "Save via save_seasonal_recommendations. Return a SeasonalCalendarReport JSON."
    )


def _compose_cannibalization_brief(p: TriggerPayload) -> str:
    return (
        "Detect article pairs in this user's corpus that compete for the same query "
        "(keyword cannibalization).\n\n"
        f"- userId: {p.userId}\n\n"
        "Scan published articles, compute pairwise semantic similarity using existing "
        "embeddings, identify pairs above threshold 0.85. For each pair, propose a "
        "resolution (merge / canonical / archive_secondary / retarget_secondary / no_action). "
        "Save via save_cannibalization_resolutions. Return a CannibalizationReport JSON."
    )


def _compose_image_optimize_brief(p: TriggerPayload) -> str:
    return (
        "Audit images across this user's published articles for SEO / accessibility issues.\n\n"
        f"- userId: {p.userId}\n\n"
        "Scan articles.generated_images. Flag missing/generic alt text, oversized files, "
        "missing WebP variants, low resolution, broken links. Recommend an action per "
        "issue (generate_alt / regenerate / compress / convert_webp / remove). "
        "Save via save_image_optimization_recommendations. Return an ImageOptimizationReport JSON."
    )


def _compose_performance_coach_brief(p: TriggerPayload) -> str:
    return (
        "Analyze the user's article performance over the last 30 days and surface "
        "declining content with diagnosed causes.\n\n"
        f"- userId: {p.userId}\n\n"
        "Pull GSC clicks/impressions/position/CTR per published article over 30d vs prior "
        "30d baseline. Identify articles trending down significantly. Diagnose the cause "
        "(stale data, lost backlinks, algorithm shift, weak schema). Recommend an action "
        "(refresh / rewrite / archive / add_internal_links / add_schema / no_action). "
        "Save via save_performance_alerts. Return a PerformanceCoachReport JSON."
    )


def _compose_newsletter_digest_brief(p: TriggerPayload) -> str:
    days = p.newsletterPeriodDays or 7
    return (
        f"Compose a {days}-day newsletter digest for the user.\n\n"
        f"- userId: {p.userId}\n"
        f"- niche: {p.topic}\n"
        f"- periodDays: {days}\n\n"
        "Pull the user's published articles from the last period. Pick the top 3-5 "
        "most engagement-worthy. Write a subject line, preheader, intro paragraph, "
        "and a markdown body (each article gets a 1-2 sentence editorial framing + "
        "linked title). Save via save_newsletter_digest. Return a NewsletterDigest JSON."
    )


def _compose_social_publish_brief(p: TriggerPayload) -> str:
    return (
        "Publish the supplied social snippets to their target platforms.\n\n"
        f"- userId: {p.userId}\n"
        f"- snippetIds: {p.snippetIds}\n\n"
        "For each snippet id, look up the snippet + the matching social_account, then "
        "post via the platform-appropriate path (OAuth API or webhook). Mark posted_at "
        "and external_url on success. Return a SocialPublishReport JSON."
    )


def _compose_sponsorship_fit_brief(p: TriggerPayload) -> str:
    return (
        "Identify articles in this user's corpus best matched for sponsor placements.\n\n"
        f"- userId: {p.userId}\n\n"
        "Pull published articles + GSC traffic data. Score each by: monthly traffic, "
        "niche tightness (focused topic vs broad), evergreen-ness (slow decay over time). "
        "Suggest 1-3 sponsor archetypes per high-fit article (e.g. 'B2B SaaS analytics tool', "
        "'developer education platform'). Save via save_sponsor_fits. Return a "
        "SponsorshipFitReport JSON."
    )
