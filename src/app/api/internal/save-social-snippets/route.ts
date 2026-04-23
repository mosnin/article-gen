import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type SnippetPlatform =
  | "twitter"
  | "linkedin"
  | "instagram"
  | "facebook"
  | "newsletter";

const ALLOWED_PLATFORMS: readonly SnippetPlatform[] = [
  "twitter",
  "linkedin",
  "instagram",
  "facebook",
  "newsletter",
];

type SocialSnippet = {
  platform: SnippetPlatform;
  variant?: string;
  body: string;
  hashtags?: string[];
  imageUrl?: string;
};

type SaveSocialSnippetsBody = {
  userId: string;
  runId: string;
  articleId: string;
  snippets: SocialSnippet[];
};

function isSocialSnippet(v: unknown): v is SocialSnippet {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.platform !== "string") return false;
  if (!ALLOWED_PLATFORMS.includes(r.platform as SnippetPlatform)) return false;
  if (typeof r.body !== "string") return false;
  if (r.variant !== undefined && typeof r.variant !== "string") return false;
  if (r.imageUrl !== undefined && typeof r.imageUrl !== "string") return false;
  if (r.hashtags !== undefined) {
    if (!Array.isArray(r.hashtags)) return false;
    for (const h of r.hashtags) if (typeof h !== "string") return false;
  }
  return true;
}

function isSaveSocialSnippetsBody(v: unknown): v is SaveSocialSnippetsBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (
    typeof r.userId !== "string" ||
    typeof r.runId !== "string" ||
    typeof r.articleId !== "string" ||
    !Array.isArray(r.snippets)
  ) {
    return false;
  }
  for (const s of r.snippets) if (!isSocialSnippet(s)) return false;
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
  if (!isSaveSocialSnippetsBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed;

  if (body.snippets.length === 0) {
    return Response.json({ snippetIds: [] });
  }

  const rows = body.snippets.map((s) => ({
    user_id: body.userId,
    run_id: body.runId,
    article_id: body.articleId,
    platform: s.platform,
    variant: s.variant ?? null,
    body: s.body,
    hashtags: s.hashtags ?? [],
    image_url: s.imageUrl ?? null,
  }));

  const sb = getAdminClient();
  const { data, error } = await sb
    .from("social_snippets")
    .insert(rows)
    .select("id");

  if (error || !data) {
    return Response.json(
      { error: "insert_failed", detail: error?.message ?? "unknown" },
      { status: 500 },
    );
  }

  const snippetIds = data.map((r) => r.id as string);
  return Response.json({ snippetIds });
}
