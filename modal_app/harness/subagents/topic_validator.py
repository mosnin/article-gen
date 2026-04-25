"""TopicValidatorAgent - final filter on TopicResearcher's output.

Reviews each surviving proposal against E-E-A-T, freshness, and
cannibalization criteria. Drops anything weak. Returns a (possibly
smaller) TopicProposalSet.
"""
from __future__ import annotations

from agents import Agent

from modal_app import config
from modal_app.harness.models import TopicProposalSet


INSTRUCTIONS = """
You are the TopicValidator. The TopicResearcher just produced a set of
candidate proposals. Apply a strict critic pass:

For each proposal, ask:
  - Does the title genuinely belong in a publication focused on the niche?
  - Is the focus keyword commercially / informationally interesting?
  - Are the evidence URLs actually relevant (not a generic homepage link)?
  - Is the angle distinctive vs. what everyone else has written?
  - Is freshnessSignal appropriate to the evidence cited?
  - Is rationale convincing and specific?

Drop weak proposals; move them to `rejected[]` with a one-line reason.

Return a TopicProposalSet JSON. The niche field must equal the input niche.
""".strip()


def build_agent() -> Agent:
    return Agent(
        name="TopicValidatorAgent",
        instructions=INSTRUCTIONS,
        model=config.MODEL_SUBAGENT,
        output_type=TopicProposalSet,
        tools=[],
    )
