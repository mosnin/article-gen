import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type FitInput = {
  articleId: string;
  fitScore: number;
  monthlyTrafficEstimate?: number | null;
  nicheTightness?: number | null;
  evergreenScore?: number | null;
  suggestedSponsorArchetypes?: string[];
  rationale?: string;
};

type SaveBody = {
  userId: string;
  runId: string;
  fits: FitInput[];
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isUnitInterval(v: unknown): v is number {
  return isFiniteNumber(v) && v >= 0 && v <= 1;
}

function isOptionalUnit(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  return isUnitInterval(v);
}

function isOptionalInt(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  return isFiniteNumber(v) && Number.isInteger(v);
}

function isStringArray(v: unknown): v is string[] {
  if (!Array.isArray(v)) return false;
  for (const s of v) if (typeof s !== "string") return false;
  return true;
}

function isFit(v: unknown): v is FitInput {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.articleId !== "string" || r.articleId.trim() === "") return false;
  if (!isUnitInterval(r.fitScore)) return false;
  if (!isOptionalInt(r.monthlyTrafficEstimate)) return false;
  if (!isOptionalUnit(r.nicheTightness)) return false;
  if (!isOptionalUnit(r.evergreenScore)) return false;
  if (
    r.suggestedSponsorArchetypes !== undefined &&
    !isStringArray(r.suggestedSponsorArchetypes)
  ) {
    return false;
  }
  if (r.rationale !== undefined && typeof r.rationale !== "string") return false;
  return true;
}

function isSaveBody(v: unknown): v is SaveBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (typeof r.runId !== "string") return false;
  if (!Array.isArray(r.fits)) return false;
  for (const f of r.fits) if (!isFit(f)) return false;
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

  if (body.fits.length === 0) {
    return Response.json({ insertedCount: 0 });
  }

  const sb = getAdminClient();

  const rows = body.fits.map((f) => ({
    user_id: body.userId,
    run_id: runId,
    article_id: f.articleId,
    fit_score: f.fitScore,
    monthly_traffic_estimate:
      typeof f.monthlyTrafficEstimate === "number" ? f.monthlyTrafficEstimate : null,
    niche_tightness:
      typeof f.nicheTightness === "number" ? f.nicheTightness : null,
    evergreen_score:
      typeof f.evergreenScore === "number" ? f.evergreenScore : null,
    suggested_sponsor_archetypes: f.suggestedSponsorArchetypes ?? [],
    rationale: f.rationale ?? "",
    status: "pending" as const,
  }));

  const { data, error } = await sb.from("sponsor_fits").insert(rows).select("id");
  if (error) {
    return Response.json(
      { error: "insert_failed", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ insertedCount: data?.length ?? 0 });
}
