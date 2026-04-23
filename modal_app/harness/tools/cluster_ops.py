"""Cluster plan upsert tool. Routes through /api/internal/upsert-cluster-plan."""
from __future__ import annotations

from modal_app.harness.tools.http import post_internal


async def upsert_cluster_plan(
    *,
    user_id: str,
    pillar_topic: str,
    pillar_keyword: str,
    strategy_plan: dict,
    article_target_count: int,
    cluster_id: str | None = None,
) -> dict:
    body: dict = {
        "userId": user_id,
        "pillarTopic": pillar_topic,
        "pillarKeyword": pillar_keyword,
        "strategyPlan": strategy_plan,
        "articleTargetCount": article_target_count,
    }
    if cluster_id:
        body["clusterId"] = cluster_id
    return await post_internal("/upsert-cluster-plan", body)
