import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type AudienceLevel = "beginner" | "intermediate" | "advanced" | "mixed";

type UserSegmentArtifact = {
  personaLabel: string;
  personaDescription: string;
  industry?: string | null;
  businessModel?: string | null;
  audienceTechnicalLevel?: AudienceLevel | null;
  primaryGoals?: string[];
  brandVoice?: string | null;
  contentPillars?: string[];
  toneKeywords?: string[];
  confidence: number;
};

type SaveBody = {
  userId: string;
  runId: string | null;
  segment: UserSegmentArtifact;
};

const ALLOWED_LEVELS: ReadonlySet<AudienceLevel> = new Set([
  "beginner",
  "intermediate",
  "advanced",
  "mixed",
]);

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isAudienceLevel(v: unknown): v is AudienceLevel {
  return typeof v === "string" && ALLOWED_LEVELS.has(v as AudienceLevel);
}

function isSegmentArtifact(v: unknown): v is UserSegmentArtifact {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.personaLabel !== "string" || r.personaLabel.trim().length < 3) {
    return false;
  }
  if (
    typeof r.personaDescription !== "string" ||
    r.personaDescription.trim().length < 20
  ) {
    return false;
  }
  if (
    r.industry !== undefined &&
    r.industry !== null &&
    typeof r.industry !== "string"
  ) {
    return false;
  }
  if (
    r.businessModel !== undefined &&
    r.businessModel !== null &&
    typeof r.businessModel !== "string"
  ) {
    return false;
  }
  if (
    r.audienceTechnicalLevel !== undefined &&
    r.audienceTechnicalLevel !== null &&
    !isAudienceLevel(r.audienceTechnicalLevel)
  ) {
    return false;
  }
  if (r.primaryGoals !== undefined && !isStringArray(r.primaryGoals)) {
    return false;
  }
  if (
    r.brandVoice !== undefined &&
    r.brandVoice !== null &&
    typeof r.brandVoice !== "string"
  ) {
    return false;
  }
  if (r.contentPillars !== undefined && !isStringArray(r.contentPillars)) {
    return false;
  }
  if (r.toneKeywords !== undefined && !isStringArray(r.toneKeywords)) {
    return false;
  }
  if (
    typeof r.confidence !== "number" ||
    !Number.isFinite(r.confidence) ||
    r.confidence < 0 ||
    r.confidence > 1
  ) {
    return false;
  }
  return true;
}

function isSaveBody(v: unknown): v is SaveBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (r.runId !== null && typeof r.runId !== "string") return false;
  if (!isSegmentArtifact(r.segment)) return false;
  return true;
}

function clampConfidence(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
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
  const s = body.segment;

  const sb = getAdminClient();
  const { data, error } = await sb
    .from("user_segments")
    .insert({
      user_id: body.userId,
      run_id: body.runId && body.runId.length > 0 ? body.runId : null,
      persona_label: s.personaLabel.trim(),
      persona_description: s.personaDescription.trim(),
      industry: s.industry ?? null,
      business_model: s.businessModel ?? null,
      audience_technical_level: s.audienceTechnicalLevel ?? null,
      primary_goals: s.primaryGoals ?? [],
      brand_voice: s.brandVoice ?? null,
      content_pillars: s.contentPillars ?? [],
      tone_keywords: s.toneKeywords ?? [],
      confidence: clampConfidence(s.confidence),
    })
    .select("id")
    .single();

  if (error || !data) {
    return Response.json(
      { error: "insert_failed", detail: error?.message ?? "unknown" },
      { status: 500 },
    );
  }

  return Response.json({ segmentId: data.id as string });
}
