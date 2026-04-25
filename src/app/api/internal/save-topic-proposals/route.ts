import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type FreshnessSignal =
  | "news_30d"
  | "trending_search"
  | "competitor_recent"
  | "seasonal"
  | "evergreen_gap";

const ALLOWED_FRESHNESS: readonly FreshnessSignal[] = [
  "news_30d",
  "trending_search",
  "competitor_recent",
  "seasonal",
  "evergreen_gap",
];

type TopicProposal = {
  title: string;
  focusKeyword: string;
  angle: string;
  niche: string;
  relevanceScore: number;
  evidenceUrls: string[];
  rationale: string;
  freshnessSignal: FreshnessSignal;
  competitorGap?: boolean;
};

type SaveTopicProposalsBody = {
  userId: string;
  runId: string;
  niche: string;
  proposals: TopicProposal[];
};

function isFreshnessSignal(v: unknown): v is FreshnessSignal {
  return typeof v === "string" && ALLOWED_FRESHNESS.includes(v as FreshnessSignal);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isTopicProposal(v: unknown): v is TopicProposal {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.title !== "string" || r.title.trim() === "") return false;
  if (typeof r.focusKeyword !== "string" || r.focusKeyword.trim() === "") return false;
  if (typeof r.angle !== "string") return false;
  if (typeof r.niche !== "string" || r.niche.trim() === "") return false;
  if (typeof r.relevanceScore !== "number" || Number.isNaN(r.relevanceScore)) return false;
  if (!isStringArray(r.evidenceUrls)) return false;
  if (typeof r.rationale !== "string") return false;
  if (!isFreshnessSignal(r.freshnessSignal)) return false;
  if (r.competitorGap !== undefined && typeof r.competitorGap !== "boolean") return false;
  return true;
}

function isSaveTopicProposalsBody(v: unknown): v is SaveTopicProposalsBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (typeof r.runId !== "string") return false;
  if (typeof r.niche !== "string" || r.niche.trim() === "") return false;
  if (!Array.isArray(r.proposals)) return false;
  for (const p of r.proposals) if (!isTopicProposal(p)) return false;
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
  if (!isSaveTopicProposalsBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed;

  const sb = getAdminClient();
  const ids: string[] = [];

  for (const p of body.proposals) {
    const { data, error } = await sb
      .from("topic_proposals")
      .insert({
        user_id: body.userId,
        run_id: body.runId,
        niche: body.niche,
        title: p.title,
        focus_keyword: p.focusKeyword,
        angle: p.angle,
        rationale: p.rationale,
        relevance_score: p.relevanceScore,
        evidence_urls: p.evidenceUrls,
        freshness_signal: p.freshnessSignal,
        competitor_gap: p.competitorGap ?? false,
        status: "pending",
        rejection_reasons: null,
      })
      .select("id")
      .single();

    if (error || !data) {
      return Response.json(
        { error: "insert_failed", detail: error?.message ?? "unknown" },
        { status: 500 },
      );
    }
    ids.push(data.id as string);
  }

  return Response.json({ ids });
}
