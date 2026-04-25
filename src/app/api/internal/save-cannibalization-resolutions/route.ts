import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type RecommendedAction =
  | "merge"
  | "canonical"
  | "archive_secondary"
  | "retarget_secondary"
  | "no_action";

const ACTIONS: ReadonlySet<RecommendedAction> = new Set([
  "merge",
  "canonical",
  "archive_secondary",
  "retarget_secondary",
  "no_action",
]);

type ResolutionInput = {
  primaryArticleId: string;
  secondaryArticleId: string;
  similarityScore: number;
  sharedKeywords?: string[];
  recommendedAction: RecommendedAction;
  rationale?: string;
};

type SaveBody = {
  userId: string;
  runId: string;
  resolutions: ResolutionInput[];
};

function isResolution(v: unknown): v is ResolutionInput {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.primaryArticleId !== "string" || r.primaryArticleId.trim() === "") return false;
  if (typeof r.secondaryArticleId !== "string" || r.secondaryArticleId.trim() === "") return false;
  if (typeof r.similarityScore !== "number" || Number.isNaN(r.similarityScore)) return false;
  if (typeof r.recommendedAction !== "string" || !ACTIONS.has(r.recommendedAction as RecommendedAction)) {
    return false;
  }
  if (r.sharedKeywords !== undefined) {
    if (!Array.isArray(r.sharedKeywords)) return false;
    for (const k of r.sharedKeywords) if (typeof k !== "string") return false;
  }
  if (r.rationale !== undefined && typeof r.rationale !== "string") return false;
  return true;
}

function isSaveBody(v: unknown): v is SaveBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (typeof r.runId !== "string") return false;
  if (!Array.isArray(r.resolutions)) return false;
  for (const s of r.resolutions) if (!isResolution(s)) return false;
  return true;
}

function clampSimilarity(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
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

  for (const r of body.resolutions) {
    // Skip self-pairs — DB also guards via FK + the partial unique index but
    // returning early here keeps the skipped count meaningful.
    if (r.primaryArticleId === r.secondaryArticleId) {
      skippedCount += 1;
      continue;
    }
    const { error } = await sb.from("cannibalization_resolutions").insert({
      user_id: body.userId,
      run_id: runId,
      primary_article_id: r.primaryArticleId,
      secondary_article_id: r.secondaryArticleId,
      similarity_score: clampSimilarity(r.similarityScore),
      shared_keywords: r.sharedKeywords ?? [],
      recommended_action: r.recommendedAction,
      rationale: r.rationale ?? "",
      status: "pending",
    });
    if (error) {
      // Unique-pair violation (idx_cannib_pair_unique) → already saved on a
      // prior run; treat as skipped, not failed.
      skippedCount += 1;
      continue;
    }
    insertedCount += 1;
  }

  return Response.json({ insertedCount, skippedCount });
}
