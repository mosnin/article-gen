import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const ISSUES = [
  "missing_alt",
  "generic_alt",
  "oversized",
  "no_webp",
  "low_resolution",
  "broken",
  "other",
] as const;
type Issue = (typeof ISSUES)[number];

const ACTIONS = [
  "generate_alt",
  "regenerate",
  "compress",
  "convert_webp",
  "remove",
] as const;
type Action = (typeof ACTIONS)[number];

type RecommendationInput = {
  articleId: string;
  imageIndex: number;
  imageStoragePath?: string | null;
  issue: Issue;
  recommendedAction: Action;
  currentValue?: string | null;
  recommendedValue?: string | null;
};

type SaveBody = {
  userId: string;
  runId: string;
  recommendations: RecommendationInput[];
};

function isIssue(v: unknown): v is Issue {
  return typeof v === "string" && (ISSUES as readonly string[]).includes(v);
}

function isAction(v: unknown): v is Action {
  return typeof v === "string" && (ACTIONS as readonly string[]).includes(v);
}

function isRecommendation(v: unknown): v is RecommendationInput {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.articleId !== "string" || r.articleId.trim() === "") return false;
  if (typeof r.imageIndex !== "number" || !Number.isInteger(r.imageIndex)) return false;
  if (r.imageIndex < 0) return false;
  if (!isIssue(r.issue)) return false;
  if (!isAction(r.recommendedAction)) return false;
  if (
    r.imageStoragePath !== undefined &&
    r.imageStoragePath !== null &&
    typeof r.imageStoragePath !== "string"
  ) {
    return false;
  }
  if (
    r.currentValue !== undefined &&
    r.currentValue !== null &&
    typeof r.currentValue !== "string"
  ) {
    return false;
  }
  if (
    r.recommendedValue !== undefined &&
    r.recommendedValue !== null &&
    typeof r.recommendedValue !== "string"
  ) {
    return false;
  }
  return true;
}

function isSaveBody(v: unknown): v is SaveBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (typeof r.runId !== "string") return false;
  if (!Array.isArray(r.recommendations)) return false;
  for (const s of r.recommendations) if (!isRecommendation(s)) return false;
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
  const runId = body.runId.trim() === "" ? null : body.runId;

  const sb = getAdminClient();
  let insertedCount = 0;
  let skippedCount = 0;

  for (const r of body.recommendations) {
    const { error } = await sb.from("image_optimization_recommendations").insert({
      user_id: body.userId,
      run_id: runId,
      article_id: r.articleId,
      image_index: r.imageIndex,
      image_storage_path: r.imageStoragePath ?? null,
      issue: r.issue,
      recommended_action: r.recommendedAction,
      current_value: r.currentValue ?? null,
      recommended_value: r.recommendedValue ?? null,
      status: "pending",
    });
    if (error) {
      skippedCount += 1;
      continue;
    }
    insertedCount += 1;
  }

  return Response.json({ insertedCount, skippedCount });
}
