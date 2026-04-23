"""Shared Pydantic v2 models for the agent harness.

All names match docs/project/09_agentic_generation.md §6 (tool catalog) and
§7 (API contracts) exactly. Models tolerate unknown keys via
``ConfigDict(extra="ignore")`` so upstream JSON shape drift does not crash
tool calls.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Trigger payload (spec §7.1)
# ---------------------------------------------------------------------------


class TriggerPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    runId: str
    userId: str
    kind: Literal[
        "article",
        "autopilot",
        "cluster",
        "research_only",
        "refresh",
        "audit",
        "cluster_plan",
        "social_snippet",
        "keyword_harvest",
    ] = "article"
    topic: str
    focusKeyword: str | None = None
    tone: str | None = None
    targetAudience: str | None = None
    quality: Literal["standard", "premium"] = "standard"
    options: dict = Field(default_factory=dict)
    webhookUrl: str | None = None
    internalApiBase: str | None = None
    autopilotSlotId: str | None = None
    articleId: str | None = None
    articleIds: list[str] = Field(default_factory=list)
    clusterId: str | None = None
    clusterPillarTopic: str | None = None
    socialPlatforms: list[str] = Field(default_factory=list)
    gscSiteUrl: str | None = None


# ---------------------------------------------------------------------------
# Outline
# ---------------------------------------------------------------------------


class OutlineSection(BaseModel):
    model_config = ConfigDict(extra="ignore")

    level: int
    heading: str
    notes: str = ""


class Outline(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    sections: list[OutlineSection]


# ---------------------------------------------------------------------------
# Cluster plan
# ---------------------------------------------------------------------------


class ClusterPlanSubtopic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    keyword: str
    intent: Literal[
        "informational",
        "commercial",
        "transactional",
        "navigational",
    ] = "informational"
    relationToPillar: str = ""
    estimatedWordCount: int = 1500


class ClusterPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")

    clusterId: str | None = None
    pillarTopic: str
    pillarKeyword: str
    pillarOutline: Outline | None = None
    subtopics: list[ClusterPlanSubtopic] = Field(default_factory=list)
    rationale: str = ""


# ---------------------------------------------------------------------------
# Research (SERP / niche)
# ---------------------------------------------------------------------------


class SerpResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    url: str
    domain: str
    wordCountEstimate: int | None = None
    headings: list[str] = Field(default_factory=list)
    highlights: list[str] = Field(default_factory=list)


class SerpAnalysis(BaseModel):
    model_config = ConfigDict(extra="ignore")

    topResults: list[SerpResult]
    avgWordCount: int
    commonHeadings: list[str]
    commonTopics: list[str]
    questionsAnswered: list[str]
    recommendedWordCount: int
    topDomains: list[str]


class NicheResearch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    results: list[SerpResult]
    gaps: list[str]
    trendingAngles: list[str]


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------


class RefreshBrief(BaseModel):
    model_config = ConfigDict(extra="ignore")

    articleId: str
    priorTitle: str
    priorMarkdown: str
    priorKeywords: list[str] = Field(default_factory=list)
    focusKeyword: str
    serp: "SerpAnalysis | None" = None
    gapsVsSerp: list[str] = Field(default_factory=list)
    refreshReason: str = "scheduled"


class RefreshResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    articleId: str
    newArticleMarkdown: str
    titleChanged: bool = False
    newTitle: str | None = None
    newMetaDescription: str | None = None
    sectionsAdded: list[str] = Field(default_factory=list)
    sectionsUpdated: list[str] = Field(default_factory=list)
    sectionsRemoved: list[str] = Field(default_factory=list)
    summary: str = ""


# ---------------------------------------------------------------------------
# Dedup / uniqueness
# ---------------------------------------------------------------------------


class SimilarArticle(BaseModel):
    model_config = ConfigDict(extra="ignore")

    articleId: str
    title: str
    keyword: str
    score: float
    createdAt: str


# ---------------------------------------------------------------------------
# Keyword candidates
# ---------------------------------------------------------------------------


class KeywordCandidate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    keyword: str
    source: Literal["gsc_queries", "serp_gap", "competitor", "manual"]
    intent: Literal[
        "informational",
        "commercial",
        "transactional",
        "navigational",
    ] | None = None
    estimatedVolume: int | None = None
    clusterHint: str | None = None
    metadata: dict = Field(default_factory=dict)


class KeywordCandidateSet(BaseModel):
    model_config = ConfigDict(extra="ignore")

    candidates: list[KeywordCandidate] = Field(default_factory=list)
    rationale: str = ""


# ---------------------------------------------------------------------------
# Metadata / images
# ---------------------------------------------------------------------------


class Metadata(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    slug: str
    metaDescription: str
    focusKeyword: str
    keywords: list[str]


class ImagePrompt(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: str
    prompt: str
    altText: str


class GeneratedImage(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: str
    altText: str
    storagePath: str
    publicUrl: str
    success: bool = True


# ---------------------------------------------------------------------------
# Subagent result wrappers
# ---------------------------------------------------------------------------


class ResearchOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    serp: SerpAnalysis
    gaps: list[str] = Field(default_factory=list)
    tooSimilar: bool = False


class ImagesResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    prompts: list[ImagePrompt] = Field(default_factory=list)
    images: list[GeneratedImage] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------


class ArticleSavePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    userId: str
    runId: str
    title: str
    slug: str
    metaDescription: str
    focusKeyword: str
    keywords: list[str]
    topic: str
    tone: str | None = None
    targetAudience: str | None = None
    quality: str = "standard"
    articleMarkdown: str
    schemaJson: str | None = None
    imagePrompts: list[ImagePrompt] = Field(default_factory=list)
    generatedImages: list[GeneratedImage] = Field(default_factory=list)
    outlineHeadings: list[str] = Field(default_factory=list)


class SavedArticleRef(BaseModel):
    model_config = ConfigDict(extra="ignore")

    articleId: str
    slug: str


# ---------------------------------------------------------------------------
# Credits
# ---------------------------------------------------------------------------


class CreditsStatus(BaseModel):
    model_config = ConfigDict(extra="ignore")

    ok: bool
    credits: int


# ---------------------------------------------------------------------------
# Publish
# ---------------------------------------------------------------------------


class PlatformTarget(BaseModel):
    model_config = ConfigDict(extra="ignore")

    kind: Literal["wordpress", "ghost", "medium", "shopify", "devto"]
    id: str


class PublishResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    # Stays permissive — wraps the existing batch publish JSON.
    results: list[dict]


# ---------------------------------------------------------------------------
# Quality
# ---------------------------------------------------------------------------


class QualityScore(BaseModel):
    model_config = ConfigDict(extra="ignore")

    overall: float
    keywordDensity: float
    eeatScore: float
    readability: float
    notes: list[str]


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------


class AuditRecommendation(BaseModel):
    model_config = ConfigDict(extra="ignore")

    kind: Literal[
        "refresh",
        "rewrite",
        "add_schema",
        "fix_internal_links",
        "improve_alt_text",
        "merge_cannibal",
        "archive",
    ]
    reason: str
    priority: Literal["low", "medium", "high"] = "medium"
    details: dict = Field(default_factory=dict)


class AuditReport(BaseModel):
    model_config = ConfigDict(extra="ignore")

    articleId: str
    overallScore: float
    gscSnapshot: dict = Field(default_factory=dict)
    recommendations: list[AuditRecommendation] = Field(default_factory=list)
    summary: str = ""


# ---------------------------------------------------------------------------
# Final article
# ---------------------------------------------------------------------------


class FinalArticle(BaseModel):
    model_config = ConfigDict(extra="ignore")

    articleId: str
    title: str
    slug: str
    articleMarkdown: str
    metadata: Metadata
    images: list[GeneratedImage] = Field(default_factory=list)
    schemaJson: str | None = None
    qa: QualityScore | None = None


# ---------------------------------------------------------------------------
# Social snippets
# ---------------------------------------------------------------------------


class SocialSnippet(BaseModel):
    model_config = ConfigDict(extra="ignore")

    platform: Literal[
        "twitter",
        "linkedin",
        "instagram",
        "facebook",
        "newsletter",
    ]
    variant: str = "default"
    body: str
    hashtags: list[str] = Field(default_factory=list)
    imageUrl: str | None = None


class SocialSnippetSet(BaseModel):
    model_config = ConfigDict(extra="ignore")

    articleId: str
    snippets: list[SocialSnippet] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Writer helpers
# ---------------------------------------------------------------------------


class InterlinkSuggestion(BaseModel):
    model_config = ConfigDict(extra="ignore")

    anchor: str
    targetUrl: str
    score: float


class SectionContext(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    topic: str
    focusKeyword: str
    tone: str | None = None
    targetAudience: str | None = None
    outline: Outline
    research: SerpAnalysis | None = None
    previousSections: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Webhook (spec §7.2)
# ---------------------------------------------------------------------------


class StatusUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    status: Literal["running", "succeeded", "failed", "cancelled"] | None = None
    progressPct: int | None = None
    currentStep: str | None = None
    currentAgent: str | None = None
    error: str | None = None
    articleId: str | None = None
    output: Any | None = None


class WebhookEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")

    runId: str
    seq: int
    kind: Literal[
        "run_started",
        "run_completed",
        "run_failed",
        "agent_started",
        "agent_ended",
        "tool_started",
        "tool_ended",
        "message",
        "handoff",
        "progress",
        "warning",
    ]
    agentName: str | None = None
    toolName: str | None = None
    message: str | None = None
    payload: Any | None = None
    durationMs: int | None = None
    statusUpdate: StatusUpdate | None = None
    at: str


# Resolve forward references (RefreshBrief.serp -> SerpAnalysis).
RefreshBrief.model_rebuild()
