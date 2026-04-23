import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type UpsertClusterPlanBody = {
  userId: string;
  runId: string;
  clusterId?: string;
  pillarTopic: string;
  pillarKeyword: string;
  strategyPlan: Record<string, unknown>;
  articleTargetCount: number;
};

function isUpsertClusterPlanBody(v: unknown): v is UpsertClusterPlanBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  const clusterIdOk = r.clusterId === undefined || typeof r.clusterId === "string";
  return (
    typeof r.userId === "string" &&
    typeof r.runId === "string" &&
    clusterIdOk &&
    typeof r.pillarTopic === "string" &&
    typeof r.pillarKeyword === "string" &&
    typeof r.strategyPlan === "object" &&
    r.strategyPlan !== null &&
    typeof r.articleTargetCount === "number"
  );
}

export async function POST(req: Request) {
  const auth = await requireInternalAuth(req);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(auth.rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isUpsertClusterPlanBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed;

  const sb = getAdminClient();
  const nowIso = new Date().toISOString();

  if (body.clusterId) {
    const { data, error } = await sb
      .from("clusters")
      .update({
        pillar_topic: body.pillarTopic,
        pillar_keyword: body.pillarKeyword,
        strategy_plan: body.strategyPlan,
        article_target_count: body.articleTargetCount,
        last_planned_at: nowIso,
      })
      .eq("id", body.clusterId)
      .eq("user_id", body.userId)
      .select("id")
      .single();

    if (error || !data) {
      return Response.json(
        { error: "update_failed", detail: error?.message ?? "unknown" },
        { status: 500 },
      );
    }
    return Response.json({ clusterId: data.id });
  }

  const { data, error } = await sb
    .from("clusters")
    .insert({
      user_id: body.userId,
      pillar_topic: body.pillarTopic,
      pillar_keyword: body.pillarKeyword,
      strategy_plan: body.strategyPlan,
      article_target_count: body.articleTargetCount,
      last_planned_at: nowIso,
    })
    .select("id")
    .single();

  if (error || !data) {
    return Response.json(
      { error: "insert_failed", detail: error?.message ?? "unknown" },
      { status: 500 },
    );
  }

  return Response.json({ clusterId: data.id });
}
