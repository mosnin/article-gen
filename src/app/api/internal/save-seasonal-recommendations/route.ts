import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const ALLOWED_SIGNAL_TYPES = [
  "seasonal_event",
  "recurring_topic",
  "holiday",
  "industry_cycle",
  "evergreen_seasonal",
] as const;
type SignalType = (typeof ALLOWED_SIGNAL_TYPES)[number];

type SeasonalRecommendationInput = {
  topic: string;
  focusKeyword: string;
  rationale?: string;
  signalType: SignalType;
  recommendedPublishAt: string;
};

type SaveSeasonalRecommendationsBody = {
  userId: string;
  runId: string;
  recommendations: SeasonalRecommendationInput[];
};

function isSignalType(v: unknown): v is SignalType {
  return (
    typeof v === "string" &&
    (ALLOWED_SIGNAL_TYPES as readonly string[]).includes(v)
  );
}

function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || v.trim() === "") return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
}

function isRecommendation(v: unknown): v is SeasonalRecommendationInput {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.topic !== "string" || r.topic.trim() === "") return false;
  if (typeof r.focusKeyword !== "string" || r.focusKeyword.trim() === "")
    return false;
  if (r.rationale !== undefined && typeof r.rationale !== "string") return false;
  if (!isSignalType(r.signalType)) return false;
  if (!isIsoDate(r.recommendedPublishAt)) return false;
  return true;
}

function isSaveBody(v: unknown): v is SaveSeasonalRecommendationsBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (typeof r.runId !== "string") return false;
  if (!Array.isArray(r.recommendations)) return false;
  for (const a of r.recommendations) if (!isRecommendation(a)) return false;
  return true;
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
  if (!isSaveBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed;

  if (body.recommendations.length === 0) {
    return Response.json({ insertedCount: 0 });
  }

  const sb = getAdminClient();
  const runId = body.runId.length > 0 ? body.runId : null;
  const rows = body.recommendations.map((r) => ({
    user_id: body.userId,
    run_id: runId,
    topic: r.topic,
    focus_keyword: r.focusKeyword,
    rationale: r.rationale ?? "",
    signal_type: r.signalType,
    recommended_publish_at: new Date(r.recommendedPublishAt).toISOString(),
    status: "pending",
  }));

  const { data, error } = await sb
    .from("seasonal_recommendations")
    .insert(rows)
    .select("id");

  if (error) {
    return Response.json(
      { error: "insert_failed", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ insertedCount: (data ?? []).length });
}
