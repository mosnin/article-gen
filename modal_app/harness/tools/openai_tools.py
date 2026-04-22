"""OpenAI structured-output tools shared across subagents.

Uses beta.chat.completions.parse with Pydantic response_format where the SDK
supports it; falls back to JSON mode otherwise.
"""

from __future__ import annotations

import json

import openai

from modal_app import config
from modal_app.harness.models import (
    FinalArticle,
    ImagePrompt,
    InterlinkSuggestion,
    Metadata,
    Outline,
    QualityScore,
    SectionContext,
)
from modal_app.harness.tools.db import fetch_user_articles

_client: openai.AsyncOpenAI | None = None


def _oai() -> openai.AsyncOpenAI:
    global _client
    if _client is None:
        _client = openai.AsyncOpenAI(api_key=config.openai_api_key())
    return _client


# ---------------------------------------------------------------------------
# Outline
# ---------------------------------------------------------------------------


async def generate_outline_json(
    topic: str, keyword: str, research: dict, tone: str, audience: str
) -> Outline:
    """Produce a structured Outline (one H1, 5-10 H2s, 0-3 H3s per H2)."""
    system = (
        "You are an expert SEO content strategist. Produce a structured article "
        "outline that ranks and serves the reader. Rules: exactly one H1 "
        "(level=1) as the first section, 5 to 10 H2 sections (level=2), and 0 "
        "to 3 H3 sections (level=3) immediately under each H2. Every section "
        "must include concrete notes the writer can follow. Do not use em-dashes."
    )
    research_summary = json.dumps(research or {}, separators=(",", ":"))[:6000]
    user = (
        f"Topic: {topic}\n"
        f"Focus keyword: {keyword}\n"
        f"Tone: {tone}\n"
        f"Target audience: {audience}\n\n"
        f"Research (JSON, may be truncated):\n{research_summary}\n\n"
        "Return the outline as structured JSON matching the Outline schema."
    )
    resp = await _oai().beta.chat.completions.parse(
        model=config.MODEL_SUBAGENT,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format=Outline,
        temperature=0.7,
    )
    parsed = resp.choices[0].message.parsed
    if parsed is None:
        raise RuntimeError("generate_outline_json: model returned no parsed payload")
    return parsed


# ---------------------------------------------------------------------------
# Metadata
# ---------------------------------------------------------------------------


async def generate_metadata_json(
    topic: str, keyword: str, article_md: str, tone: str
) -> Metadata:
    """Produce SEO metadata: title 50-60 chars, kebab-case slug, meta 120-160 chars."""
    system = (
        "You are an SEO metadata specialist. Generate concise, high-CTR "
        "metadata. Strict constraints: title 50-60 characters, slug in "
        "kebab-case (lowercase, hyphen-separated, no punctuation), meta "
        "description 120-160 characters. Include the focus keyword naturally "
        "in the title and meta description. Do not use em-dashes."
    )
    excerpt = article_md[:6000]
    user = (
        f"Topic: {topic}\n"
        f"Focus keyword: {keyword}\n"
        f"Tone: {tone}\n\n"
        f"Article (may be truncated):\n{excerpt}\n\n"
        "Return metadata as structured JSON matching the Metadata schema."
    )
    resp = await _oai().beta.chat.completions.parse(
        model=config.MODEL_SUBAGENT,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format=Metadata,
        temperature=0.5,
    )
    parsed = resp.choices[0].message.parsed
    if parsed is None:
        raise RuntimeError("generate_metadata_json: model returned no parsed payload")
    return parsed


# ---------------------------------------------------------------------------
# Schema.org JSON-LD
# ---------------------------------------------------------------------------


async def generate_schema_json(article: FinalArticle) -> str:
    """Return a JSON-LD string (Article + FAQPage in @graph)."""
    system = (
        "You are a schema.org JSON-LD expert. Produce a JSON-LD document that "
        "combines an Article entry and an FAQPage entry under a single @graph "
        "array. Use https://schema.org as @context. The Article needs "
        "headline, description, keywords, author (Person), datePublished, "
        "dateModified, publisher (Organization), mainEntityOfPage, and image. "
        "The FAQPage must include 3-5 realistic Question/Answer pairs drawn "
        "from the article. Optimize for Google rich results. Return a JSON "
        "object with a single key 'schema' whose value is the JSON-LD object."
    )
    md_excerpt = article.articleMarkdown[:8000]
    user = (
        f"Title: {article.title}\n"
        f"Slug: {article.slug}\n"
        f"Meta description: {article.metadata.metaDescription}\n"
        f"Focus keyword: {article.metadata.focusKeyword}\n"
        f"Keywords: {', '.join(article.metadata.keywords)}\n\n"
        f"Article markdown (may be truncated):\n{md_excerpt}\n\n"
        "Return {\"schema\": { ...JSON-LD... }}."
    )
    resp = await _oai().chat.completions.create(
        model=config.MODEL_SUBAGENT,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format={"type": "json_object"},
        temperature=0.5,
    )
    raw = resp.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return ""
    payload = parsed.get("schema", parsed)
    return json.dumps(payload, indent=2)


# ---------------------------------------------------------------------------
# Section writing
# ---------------------------------------------------------------------------


async def write_section(heading: str, notes: str, context: SectionContext) -> str:
    """Return a markdown section (H2 or H3 based on outline level) with no em-dashes."""
    level = 2
    for sec in context.outline.sections:
        if sec.heading.strip().lower() == heading.strip().lower():
            level = 3 if sec.level >= 3 else 2
            break
    hashes = "###" if level == 3 else "##"

    prev_tail = "\n\n---\n\n".join(context.previousSections[-2:])[-4000:]
    system = (
        "You are a senior long-form content writer producing SEO-optimized "
        "articles with first-hand, E-E-A-T-strong prose. Write natural, "
        "human copy. Absolute rules: NEVER use em-dashes or en-dashes. Use "
        "commas, periods, or parentheses instead. Maintain tonal continuity "
        "with the previously-written sections. Include the focus keyword "
        "naturally (do not stuff). Output pure markdown only; no front-matter, "
        "no code fences around the whole section."
    )
    user = (
        f"Article title: {context.title}\n"
        f"Topic: {context.topic}\n"
        f"Focus keyword: {context.focusKeyword}\n"
        f"Tone: {context.tone or 'professional, clear'}\n"
        f"Target audience: {context.targetAudience or 'general readers'}\n\n"
        f"Section heading: {heading}\n"
        f"Section notes: {notes}\n\n"
        f"Previously written sections (tail, for tonal continuity):\n{prev_tail}\n\n"
        f"Start the section with `{hashes} {heading}` on its own line, then "
        "write the body in well-structured paragraphs (and bullet lists where "
        "appropriate). Do not include any other headings. Remember: no "
        "em-dashes or en-dashes anywhere."
    )
    resp = await _oai().chat.completions.create(
        model=config.MODEL_WRITER,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.7,
    )
    return (resp.choices[0].message.content or "").strip()


# ---------------------------------------------------------------------------
# Interlinking
# ---------------------------------------------------------------------------


async def interlink_suggest(user_id: str, article_md: str) -> list[InterlinkSuggestion]:
    """Suggest up to 5 internal links to the user's prior articles (scored 0-1)."""
    articles = await fetch_user_articles(user_id, limit=25)
    if not articles:
        return []

    candidates = [
        {"title": a.get("title") or "", "slug": a.get("slug") or ""}
        for a in articles
        if a.get("title") and a.get("slug")
    ]
    if not candidates:
        return []

    system = (
        "You recommend high-relevance internal links. Given a new article and "
        "a list of the user's existing articles (title + slug), pick up to 5 "
        "targets that a reader would genuinely want to follow. For each pick, "
        "propose a short natural anchor phrase that appears (or could appear) "
        "in the article body and score the relevance 0 to 1. Return JSON: "
        "{\"suggestions\": [{\"anchor\": str, \"targetUrl\": str, "
        "\"score\": number}]}. targetUrl must be the slug prefixed with '/'."
    )
    excerpt = article_md[:6000]
    user = (
        f"New article (may be truncated):\n{excerpt}\n\n"
        f"Existing articles (JSON):\n{json.dumps(candidates, separators=(',', ':'))}\n\n"
        "Return up to 5 suggestions, highest score first."
    )
    resp = await _oai().chat.completions.create(
        model=config.MODEL_SUBAGENT,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format={"type": "json_object"},
        temperature=0.5,
    )
    raw = resp.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    out: list[InterlinkSuggestion] = []
    for item in (parsed.get("suggestions") or [])[:5]:
        try:
            out.append(InterlinkSuggestion.model_validate(item))
        except Exception:
            continue
    return out


# ---------------------------------------------------------------------------
# Image prompts
# ---------------------------------------------------------------------------


async def generate_image_prompts(
    title: str, keyword: str, article_md: str, count: int = 4
) -> list[ImagePrompt]:
    """Build photorealistic cinematic DALL-E prompts (1 hero + N-1 inline)."""
    n = max(1, int(count))
    system = (
        "You design photorealistic, cinematic image prompts for editorial "
        "articles. Each prompt should describe a single scene suitable for "
        "DALL-E 3 at 1792x1024: hyper-realistic photograph, 50mm lens, soft "
        "natural lighting, shallow depth of field, color graded, editorial "
        "style. Do not include text, logos, watermarks, or celebrity "
        "likenesses. Produce exactly one 'hero' prompt and the remainder as "
        "'inline-1', 'inline-2', ... in order. Every altText must mention the "
        "focus keyword naturally. Return JSON of shape "
        "{\"images\": [{\"type\": str, \"prompt\": str, \"altText\": str}]}."
    )
    excerpt = article_md[:5000]
    user = (
        f"Title: {title}\n"
        f"Focus keyword: {keyword}\n"
        f"Count: {n}\n\n"
        f"Article (may be truncated):\n{excerpt}\n\n"
        f"Return exactly {n} image specs."
    )
    resp = await _oai().chat.completions.create(
        model=config.MODEL_SUBAGENT,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
    )
    raw = resp.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    out: list[ImagePrompt] = []
    for item in (parsed.get("images") or [])[:n]:
        try:
            out.append(ImagePrompt.model_validate(item))
        except Exception:
            continue
    return out


# ---------------------------------------------------------------------------
# QA / scoring
# ---------------------------------------------------------------------------


async def score_article(article_md: str, focus_keyword: str) -> QualityScore:
    """Score E-E-A-T + readability; compute density; flag em/en-dashes."""
    words = [w for w in article_md.split() if w.strip()]
    word_count = len(words)
    needle = focus_keyword.lower().strip()
    occurrences = article_md.lower().count(needle) if needle else 0
    density = (occurrences / word_count) if word_count else 0.0

    em_count = article_md.count("—")
    en_count = article_md.count("–")

    system = (
        "You are an editorial QA evaluator. Score the article for E-E-A-T "
        "(experience, expertise, authoritativeness, trustworthiness) and "
        "readability on a 0-1 scale. Also return a weighted overall 0-1 "
        "score. Return JSON of shape {\"overall\": number, \"eeatScore\": "
        "number, \"readability\": number, \"notes\": [string]}. Notes should "
        "list concrete improvement observations."
    )
    excerpt = article_md[:8000]
    user = (
        f"Focus keyword: {focus_keyword}\n"
        f"Computed word count: {word_count}\n"
        f"Computed keyword density: {density:.4f}\n\n"
        f"Article (may be truncated):\n{excerpt}\n\n"
        "Return the scored JSON object."
    )
    resp = await _oai().chat.completions.create(
        model=config.MODEL_SUBAGENT,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format={"type": "json_object"},
        temperature=0.5,
    )
    raw = resp.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {}

    notes = list(parsed.get("notes") or [])
    if em_count or en_count:
        notes.append(
            f"Em/en-dash usage detected: {em_count} em-dash(es), "
            f"{en_count} en-dash(es). Replace with commas or periods."
        )

    return QualityScore(
        overall=float(parsed.get("overall", 0.0) or 0.0),
        keywordDensity=float(density),
        eeatScore=float(parsed.get("eeatScore", 0.0) or 0.0),
        readability=float(parsed.get("readability", 0.0) or 0.0),
        notes=notes,
    )
