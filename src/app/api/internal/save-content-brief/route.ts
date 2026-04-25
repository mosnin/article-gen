import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type Intent = "informational" | "commercial" | "transactional" | "navigational";

const ALLOWED_INTENTS: readonly Intent[] = [
  "informational",
  "commercial",
  "transactional",
  "navigational",
];

type OutlineSection = {
  level: number;
  heading: string;
  notes?: string;
};

type Outline = {
  title: string;
  sections: OutlineSection[];
};

type ContentBriefArtifact = {
  topic: string;
  focusKeyword: string;
  targetWordCount?: number;
  mustCoverEntities?: string[];
  mustLinkSources?: string[];
  readerPersona?: string;
  intent?: Intent;
  estimatedReadingTime?: number | null;
  outlineHint?: Outline | null;
};

type SaveContentBriefBody = {
  userId: string;
  runId: string | null;
  brief: ContentBriefArtifact;
};

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isIntent(v: unknown): v is Intent {
  return typeof v === "string" && ALLOWED_INTENTS.includes(v as Intent);
}

function isOutlineSection(v: unknown): v is OutlineSection {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.level !== "number" || !Number.isFinite(r.level)) return false;
  if (typeof r.heading !== "string") return false;
  if (r.notes !== undefined && typeof r.notes !== "string") return false;
  return true;
}

function isOutline(v: unknown): v is Outline {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.title !== "string") return false;
  if (!Array.isArray(r.sections)) return false;
  for (const s of r.sections) if (!isOutlineSection(s)) return false;
  return true;
}

function isContentBriefArtifact(v: unknown): v is ContentBriefArtifact {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.topic !== "string" || r.topic.trim() === "") return false;
  if (typeof r.focusKeyword !== "string" || r.focusKeyword.trim() === "") return false;
  if (
    r.targetWordCount !== undefined &&
    (typeof r.targetWordCount !== "number" || !Number.isFinite(r.targetWordCount))
  ) {
    return false;
  }
  if (r.mustCoverEntities !== undefined && !isStringArray(r.mustCoverEntities)) return false;
  if (r.mustLinkSources !== undefined && !isStringArray(r.mustLinkSources)) return false;
  if (r.readerPersona !== undefined && typeof r.readerPersona !== "string") return false;
  if (r.intent !== undefined && !isIntent(r.intent)) return false;
  if (
    r.estimatedReadingTime !== undefined &&
    r.estimatedReadingTime !== null &&
    (typeof r.estimatedReadingTime !== "number" || !Number.isFinite(r.estimatedReadingTime))
  ) {
    return false;
  }
  if (r.outlineHint !== undefined && r.outlineHint !== null && !isOutline(r.outlineHint)) {
    return false;
  }
  return true;
}

function isSaveContentBriefBody(v: unknown): v is SaveContentBriefBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (r.runId !== null && typeof r.runId !== "string") return false;
  if (!isContentBriefArtifact(r.brief)) return false;
  return true;
}

function clampWordCount(n: number | undefined): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 1500;
  return Math.max(800, Math.min(6000, v));
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
  if (!isSaveContentBriefBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed;
  const brief = body.brief;

  const sb = getAdminClient();
  const { data, error } = await sb
    .from("content_briefs")
    .insert({
      user_id: body.userId,
      run_id: body.runId && body.runId.length > 0 ? body.runId : null,
      topic: brief.topic,
      focus_keyword: brief.focusKeyword,
      target_word_count: clampWordCount(brief.targetWordCount),
      must_cover_entities: brief.mustCoverEntities ?? [],
      must_link_sources: brief.mustLinkSources ?? [],
      reader_persona: brief.readerPersona ?? null,
      intent: brief.intent ?? "informational",
      estimated_reading_time:
        typeof brief.estimatedReadingTime === "number" ? brief.estimatedReadingTime : null,
      outline_hint: brief.outlineHint ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    return Response.json(
      { error: "insert_failed", detail: error?.message ?? "unknown" },
      { status: 500 },
    );
  }

  return Response.json({ briefId: data.id as string });
}
