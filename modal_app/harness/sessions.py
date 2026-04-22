"""RunSession wrapper around the OpenAI Agents SDK ``Session``.

The orchestrator's ``Session`` accumulates the high-level plan and the
running summary of what each subagent returned — this is the coordinating
agent's long-lived scratchpad.

Subagents, by contrast, get a **fresh** ``Session`` for every invocation.
Reusing the orchestrator's session inside subagents causes the "context rot"
pathology described in Modal's agent-harness blog post: irrelevant history
accumulates, token usage balloons, and the subagent starts pattern-matching
against earlier unrelated turns. A fresh session per subagent run is the
guardrail.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from agents import Session

from modal_app.harness.models import SimilarArticle


@dataclass
class RunSession:
    run_id: str
    user_id: str
    orchestrator_session: Session = field(default_factory=Session)
    # subagent sessions are short-lived; do not store them on RunSession
    past_work: list[SimilarArticle] = field(default_factory=list)

    def build_subagent_session(self) -> Session:
        """Return a FRESH Session for a subagent invocation.

        The orchestrator retains its own session; subagents must not share it.
        """
        return Session()

    def inject_past_work(self, similar: list[SimilarArticle]) -> str:
        """Render a short markdown block summarizing recent similar articles.

        Used to prime the orchestrator / research subagent prompts with the
        angles it should avoid duplicating.
        """
        if not similar:
            return "No prior similar articles found."
        lines = ["### Recent similar articles (avoid duplicating these angles)"]
        for a in similar[:5]:
            lines.append(
                f"- [{a.score:.2f}] \"{a.title}\" (keyword: {a.keyword}, {a.createdAt[:10]})"
            )
        return "\n".join(lines)
