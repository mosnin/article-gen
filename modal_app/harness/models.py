"""Shared Pydantic v2 models for the agent harness.

All names match docs/project/09_agentic_generation.md §6 (tool catalog) and
§7 (API contracts) exactly. Models tolerate unknown keys via
``ConfigDict(extra="ignore")`` so upstream JSON shape drift does not crash
tool calls.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


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
        "topic_research",
        "research_and_write",
        "competitor_monitor",
        "internal_link_optimize",
        "schema_doctor",
        "content_brief",
        "seasonal_calendar",
        "cannibalization_resolve",
        "image_optimize",
        "performance_coach",
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
    competitorIds: list[str] = Field(default_factory=list)
    contentBriefId: str | None = None


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
    agentRunId: str | None = None
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


# ---------------------------------------------------------------------------
# Topic proposals (TopicResearcher)
# ---------------------------------------------------------------------------


class TopicProposal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str = Field(min_length=10, max_length=180)
    focusKeyword: str = Field(min_length=2, max_length=120)
    angle: str = Field(min_length=20)
    niche: str = Field(min_length=2)
    relevanceScore: float = Field(ge=0.0, le=1.0)
    evidenceUrls: list[str] = Field(min_length=3)
    rationale: str = Field(min_length=30)
    freshnessSignal: Literal[
        "news_30d", "trending_search", "competitor_recent", "seasonal", "evergreen_gap"
    ] = "evergreen_gap"
    competitorGap: bool = False

    @field_validator("evidenceUrls")
    @classmethod
    def must_be_urls(cls, v: list[str]) -> list[str]:
        for url in v:
            if not isinstance(url, str) or not url.startswith(("http://", "https://")):
                raise ValueError(f"evidenceUrls must be http(s) URLs, got {url!r}")
        return v


class TopicProposalRejection(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str
    reasons: list[str]


class TopicProposalSet(BaseModel):
    model_config = ConfigDict(extra="ignore")
    niche: str
    proposals: list[TopicProposal] = Field(min_length=0, max_length=20)
    rejected: list[TopicProposalRejection] = Field(default_factory=list)
    rationale: str = ""


# ---------------------------------------------------------------------------
# CompetitorMonitor (Tier 1)
# ---------------------------------------------------------------------------


class CompetitorArticle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    url: str
    title: str
    publishedAt: str | None = None
    classification: Literal[
        "informational", "comparison", "launch",
        "tutorial", "listicle", "news", "other",
    ] = "other"
    rebuttalTopic: str | None = None
    rebuttalFocusKeyword: str | None = None
    rebuttalAngle: str | None = None


class CompetitorMonitorReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    discovered: list[CompetitorArticle] = Field(default_factory=list)
    skippedDuplicates: int = 0
    competitorsScanned: int = 0


# ---------------------------------------------------------------------------
# InternalLinkOptimizer (Tier 1)
# ---------------------------------------------------------------------------


class LinkSuggestion(BaseModel):
    model_config = ConfigDict(extra="ignore")
    sourceArticleId: str
    targetArticleId: str
    anchorText: str
    contextSnippet: str = ""
    confidence: float = Field(ge=0.0, le=1.0)


class LinkOptimizationReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    suggestions: list[LinkSuggestion] = Field(default_factory=list)
    articlesScanned: int = 0
    rationale: str = ""


# ---------------------------------------------------------------------------
# SchemaDoctor (Tier 1)
# ---------------------------------------------------------------------------


class SchemaRecommendation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    kind: Literal[
        "add_faq", "add_howto", "add_product",
        "fix_required_field", "tighten_types", "add_breadcrumb",
    ]
    reason: str
    priority: Literal["low", "medium", "high"] = "medium"


class SchemaDiagnosis(BaseModel):
    model_config = ConfigDict(extra="ignore")
    articleId: str
    currentSchema: dict | None = None
    recommendedSchema: dict
    recommendations: list[SchemaRecommendation] = Field(default_factory=list)
    validationStatus: Literal[
        "valid", "invalid", "warnings", "pending"
    ] = "pending"
    validationErrors: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# ContentBrief (Tier 1)
# ---------------------------------------------------------------------------


class ContentBriefArtifact(BaseModel):
    model_config = ConfigDict(extra="ignore")
    topic: str
    focusKeyword: str
    targetWordCount: int = 1500
    mustCoverEntities: list[str] = Field(default_factory=list)
    mustLinkSources: list[str] = Field(default_factory=list)
    readerPersona: str = ""
    intent: Literal[
        "informational", "commercial", "transactional", "navigational"
    ] = "informational"
    estimatedReadingTime: int | None = None
    outlineHint: Outline | None = None


# ---------------------------------------------------------------------------
# SeasonalCalendar (Tier 2)
# ---------------------------------------------------------------------------


class SeasonalRecommendation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    topic: str
    focusKeyword: str
    rationale: str = ""
    signalType: Literal[
        "seasonal_event", "recurring_topic", "holiday",
        "industry_cycle", "evergreen_seasonal",
    ] = "evergreen_seasonal"
    recommendedPublishAt: str   # ISO date


class SeasonalCalendarReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    recommendations: list[SeasonalRecommendation] = Field(default_factory=list)
    horizonDays: int = 90
    rationale: str = ""


# ---------------------------------------------------------------------------
# CannibalizationResolver (Tier 2)
# ---------------------------------------------------------------------------


class CannibalizationResolution(BaseModel):
    model_config = ConfigDict(extra="ignore")
    primaryArticleId: str
    secondaryArticleId: str
    similarityScore: float = Field(ge=0.0, le=1.0)
    sharedKeywords: list[str] = Field(default_factory=list)
    recommendedAction: Literal[
        "merge", "canonical", "archive_secondary",
        "retarget_secondary", "no_action",
    ]
    rationale: str = ""


class CannibalizationReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    resolutions: list[CannibalizationResolution] = Field(default_factory=list)
    pairsScanned: int = 0
    threshold: float = 0.85


# ---------------------------------------------------------------------------
# ImageOptimizer (Tier 2)
# ---------------------------------------------------------------------------


class ImageOptimizationRecommendation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    articleId: str
    imageIndex: int
    imageStoragePath: str | None = None
    issue: Literal[
        "missing_alt", "generic_alt", "oversized",
        "no_webp", "low_resolution", "broken", "other",
    ]
    recommendedAction: Literal[
        "generate_alt", "regenerate", "compress", "convert_webp", "remove",
    ]
    currentValue: str | None = None
    recommendedValue: str | None = None


class ImageOptimizationReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    recommendations: list[ImageOptimizationRecommendation] = Field(default_factory=list)
    articlesScanned: int = 0


# ---------------------------------------------------------------------------
# PerformanceCoach (Tier 2)
# ---------------------------------------------------------------------------


class PerformanceAlert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    articleId: str
    metricName: Literal["clicks", "impressions", "position", "ctr"]
    periodDays: int = 30
    baselineValue: float
    currentValue: float
    changePct: float
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    diagnosedCause: str | None = None
    recommendedKind: Literal[
        "refresh", "rewrite", "archive",
        "add_internal_links", "add_schema", "no_action",
    ] | None = None
    rationale: str = ""


class PerformanceCoachReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    alerts: list[PerformanceAlert] = Field(default_factory=list)
    articlesAnalyzed: int = 0
    periodDays: int = 30


# Resolve forward references (RefreshBrief.serp -> SerpAnalysis).
RefreshBrief.model_rebuild()
