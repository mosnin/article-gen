import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type LinkSuggestionInput = {
  sourceArticleId: string;
  targetArticleId: string;
  anchorText: string;
  contextSnippet?: string;
  confidence: number;
};

type SaveBody = {
  userId: string;
  runId: string;
  suggestions: LinkSuggestionInput[];
};

function isLinkSuggestion(v: unknown): v is LinkSuggestionInput {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.sourceArticleId !== "string" || r.sourceArticleId.trim() === "") return false;
  if (typeof r.targetArticleId !== "string" || r.targetArticleId.trim() === "") return false;
  if (typeof r.anchorText !== "string" || r.anchorText.trim() === "") return false;
  if (typeof r.confidence !== "number" || Number.isNaN(r.confidence)) return false;
  if (r.contextSnippet !== undefined && typeof r.contextSnippet !== "string") return false;
  return true;
}

function isSaveBody(v: unknown): v is SaveBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (typeof r.runId !== "string") return false;
  if (!Array.isArray(r.suggestions)) return false;
  for (const s of r.suggestions) if (!isLinkSuggestion(s)) return false;
  return true;
}

function clampConfidence(n: number): number {
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

  for (const s of body.suggestions) {
    if (s.sourceArticleId === s.targetArticleId) {
      skippedCount += 1;
      continue;
    }
    const { error } = await sb.from("link_suggestions").insert({
      user_id: body.userId,
      run_id: runId,
      source_article_id: s.sourceArticleId,
      target_article_id: s.targetArticleId,
      anchor_text: s.anchorText,
      context_snippet: s.contextSnippet ?? null,
      confidence: clampConfidence(s.confidence),
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
