import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const ALLOWED_CLASSIFICATIONS = [
  "informational",
  "comparison",
  "launch",
  "tutorial",
  "listicle",
  "news",
  "other",
] as const;
type Classification = (typeof ALLOWED_CLASSIFICATIONS)[number];

type CompetitorArticleInput = {
  competitorId?: string | null;
  url: string;
  title: string;
  publishedAt?: string | null;
  classification: Classification;
  rebuttalTopic?: string | null;
  rebuttalFocusKeyword?: string | null;
  rebuttalAngle?: string | null;
};

type SaveCompetitorArticlesBody = {
  userId: string;
  runId: string;
  articles: CompetitorArticleInput[];
};

function isClassification(v: unknown): v is Classification {
  return typeof v === "string" && (ALLOWED_CLASSIFICATIONS as readonly string[]).includes(v);
}

function isCompetitorArticleInput(v: unknown): v is CompetitorArticleInput {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.url !== "string" || r.url.trim() === "") return false;
  if (typeof r.title !== "string") return false;
  if (!isClassification(r.classification)) return false;
  if (
    r.competitorId !== undefined &&
    r.competitorId !== null &&
    typeof r.competitorId !== "string"
  )
    return false;
  if (r.publishedAt !== undefined && r.publishedAt !== null && typeof r.publishedAt !== "string")
    return false;
  if (
    r.rebuttalTopic !== undefined &&
    r.rebuttalTopic !== null &&
    typeof r.rebuttalTopic !== "string"
  )
    return false;
  if (
    r.rebuttalFocusKeyword !== undefined &&
    r.rebuttalFocusKeyword !== null &&
    typeof r.rebuttalFocusKeyword !== "string"
  )
    return false;
  if (
    r.rebuttalAngle !== undefined &&
    r.rebuttalAngle !== null &&
    typeof r.rebuttalAngle !== "string"
  )
    return false;
  return true;
}

function isSaveBody(v: unknown): v is SaveCompetitorArticlesBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (typeof r.runId !== "string") return false;
  if (!Array.isArray(r.articles)) return false;
  for (const a of r.articles) if (!isCompetitorArticleInput(a)) return false;
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

  const sb = getAdminClient();
  const ids: string[] = [];
  let insertedCount = 0;
  let skippedCount = 0;

  // Per-row insert with duplicate handling. The unique index is
  // (user_id, lower(url)); on conflict we treat as skipped.
  for (const a of body.articles) {
    const row = {
      user_id: body.userId,
      run_id: body.runId === "" ? null : body.runId,
      competitor_id: a.competitorId ?? null,
      url: a.url,
      title: a.title,
      published_at: a.publishedAt ?? null,
      classification: a.classification,
      rebuttal_topic: a.rebuttalTopic ?? null,
      rebuttal_focus_keyword: a.rebuttalFocusKeyword ?? null,
      rebuttal_angle: a.rebuttalAngle ?? null,
      status: "discovered",
    };

    const { data, error } = await sb
      .from("competitor_articles")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      // Postgres unique violation = "23505". supabase-js exposes `.code`.
      const code = (error as { code?: string }).code;
      if (code === "23505") {
        skippedCount++;
        continue;
      }
      return Response.json(
        { error: "insert_failed", detail: error.message },
        { status: 500 },
      );
    }
    if (data) {
      ids.push((data as { id: string }).id);
      insertedCount++;
    }
  }

  return Response.json({ ids, insertedCount, skippedCount });
}
