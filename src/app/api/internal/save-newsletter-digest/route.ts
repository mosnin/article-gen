import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type NewsletterDigestArtifact = {
  periodStart: string;
  periodEnd: string;
  subject: string;
  preheader?: string;
  intro?: string;
  articleIds?: string[];
  bodyMarkdown: string;
  bodyHtml?: string | null;
};

type SaveBody = {
  userId: string;
  runId: string | null;
  digest: NewsletterDigestArtifact;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isDigestArtifact(v: unknown): v is NewsletterDigestArtifact {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.periodStart !== "string" || !ISO_DATE_RE.test(r.periodStart)) return false;
  if (typeof r.periodEnd !== "string" || !ISO_DATE_RE.test(r.periodEnd)) return false;
  if (typeof r.subject !== "string" || r.subject.trim().length < 10) return false;
  if (r.preheader !== undefined && typeof r.preheader !== "string") return false;
  if (r.intro !== undefined && typeof r.intro !== "string") return false;
  if (r.articleIds !== undefined && !isStringArray(r.articleIds)) return false;
  if (typeof r.bodyMarkdown !== "string" || r.bodyMarkdown.length === 0) return false;
  if (
    r.bodyHtml !== undefined &&
    r.bodyHtml !== null &&
    typeof r.bodyHtml !== "string"
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
  if (!isDigestArtifact(r.digest)) return false;
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
  const d = body.digest;

  const sb = getAdminClient();
  const { data, error } = await sb
    .from("newsletter_digests")
    .insert({
      user_id: body.userId,
      run_id: body.runId && body.runId.length > 0 ? body.runId : null,
      period_start: d.periodStart,
      period_end: d.periodEnd,
      subject: d.subject.trim(),
      preheader: d.preheader ?? null,
      intro: d.intro ?? "",
      article_ids: d.articleIds ?? [],
      body_markdown: d.bodyMarkdown,
      body_html: d.bodyHtml ?? null,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    return Response.json(
      { error: "insert_failed", detail: error?.message ?? "unknown" },
      { status: 500 },
    );
  }

  return Response.json({ digestId: data.id as string });
}
