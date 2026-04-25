"""On-topic filter for TopicResearcher proposals.

Runs after the SDK returns a TopicProposalSet. Drops any proposal that
fails the hard niche / relevance / evidence rules. Keeps the harness
robust even if the LLM ignores its instructions.
"""
from __future__ import annotations

import re

from modal_app.harness.models import TopicProposal, TopicProposalRejection


def _tokenize(s: str) -> set[str]:
    return {w for w in re.split(r"\W+", s.lower()) if len(w) >= 3}


def filter_on_topic(
    proposals: list[TopicProposal],
    required_niche: str,
    *,
    relevance_threshold: float = 0.7,
    min_evidence_urls: int = 3,
) -> tuple[list[TopicProposal], list[TopicProposalRejection]]:
    """Return (kept, rejected) lists. Drops anything failing strict on-topic rules."""
    niche_terms = _tokenize(required_niche)
    kept: list[TopicProposal] = []
    rejected: list[TopicProposalRejection] = []
    for p in proposals:
        reasons: list[str] = []
        if p.relevanceScore < relevance_threshold:
            reasons.append(f"relevance {p.relevanceScore:.2f} < {relevance_threshold:.2f}")
        if p.niche.strip().lower() != required_niche.strip().lower():
            reasons.append(f"niche {p.niche!r} != {required_niche!r}")
        title_terms = _tokenize(p.title)
        keyword_terms = _tokenize(p.focusKeyword)
        if niche_terms and not (title_terms & niche_terms) and not (keyword_terms & niche_terms):
            reasons.append("title and focusKeyword have no overlap with niche terms")
        if len(p.evidenceUrls) < min_evidence_urls:
            reasons.append(f"only {len(p.evidenceUrls)} evidence URLs, need {min_evidence_urls}")
        if reasons:
            rejected.append(TopicProposalRejection(title=p.title, reasons=reasons))
        else:
            kept.append(p)
    return kept, rejected
