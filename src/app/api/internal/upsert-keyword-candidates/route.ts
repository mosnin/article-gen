import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type CandidateSource = "gsc_queries" | "serp_gap" | "competitor" | "manual";

const ALLOWED_SOURCES: readonly CandidateSource[] = [
  "gsc_queries",
  "serp_gap",
  "competitor",
  "manual",
];

type KeywordCandidate = {
  keyword: string;
  source: CandidateSource;
  intent?: string;
  estimatedVolume?: number;
  clusterHint?: string;
  metadata?: Record<string, unknown>;
};

type UpsertKeywordCandidatesBody = {
  userId: string;
  runId: string;
  candidates: KeywordCandidate[];
};

function isKeywordCandidate(v: unknown): v is KeywordCandidate {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.keyword !== "string" || r.keyword.trim() === "") return false;
  if (typeof r.source !== "string") return false;
  if (!ALLOWED_SOURCES.includes(r.source as CandidateSource)) return false;
  if (r.intent !== undefined && typeof r.intent !== "string") return false;
  if (r.estimatedVolume !== undefined && typeof r.estimatedVolume !== "number") return false;
  if (r.clusterHint !== undefined && typeof r.clusterHint !== "string") return false;
  if (r.metadata !== undefined && (typeof r.metadata !== "object" || r.metadata === null)) return false;
  return true;
}

function isUpsertKeywordCandidatesBody(v: unknown): v is UpsertKeywordCandidatesBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (
    typeof r.userId !== "string" ||
    typeof r.runId !== "string" ||
    !Array.isArray(r.candidates)
  ) {
    return false;
  }
  for (const c of r.candidates) if (!isKeywordCandidate(c)) return false;
  return true;
}

// Postgres unique_violation error code
const UNIQUE_VIOLATION = "23505";

export async function POST(req: Request) {
  const auth = await requireInternalAuth(req);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(auth.rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isUpsertKeywordCandidatesBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed;

  const sb = getAdminClient();

  let insertedCount = 0;
  let skippedCount = 0;

  // Insert one at a time so we can silently skip duplicate-key errors
  // (unique index is on (user_id, lower(keyword)) — lowercase before insert).
  for (const c of body.candidates) {
    const row = {
      user_id: body.userId,
      run_id: body.runId,
      keyword: c.keyword.trim().toLowerCase(),
      source: c.source,
      intent: c.intent ?? null,
      estimated_volume: typeof c.estimatedVolume === "number" ? c.estimatedVolume : null,
      cluster_hint: c.clusterHint ?? null,
      metadata: c.metadata ?? {},
    };

    const { error } = await sb
      .from("keyword_candidates")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === UNIQUE_VIOLATION) {
        skippedCount += 1;
        continue;
      }
      return Response.json(
        { error: "insert_failed", detail: error.message },
        { status: 500 },
      );
    }
    insertedCount += 1;
  }

  return Response.json({ insertedCount, skippedCount });
}
