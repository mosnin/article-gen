import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type FetchSnippetsBody = {
  userId: string;
  snippetIds: string[];
};

type SnippetRow = {
  id: string;
  user_id: string;
  article_id: string;
  platform: string;
  variant: string | null;
  body: string;
  hashtags: string[] | null;
  image_url: string | null;
};

type AccountRow = {
  id: string;
  user_id: string;
  platform: string;
  webhook_url: string | null;
  oauth_token: string | null;
  active: boolean;
};

type SnippetAccount = {
  id: string;
  webhookUrl: string | null;
  hasOauthToken: boolean;
};

type SnippetResponse = {
  id: string;
  platform: string;
  variant: string;
  body: string;
  hashtags: string[];
  imageUrl: string | null;
  sourceArticleId: string;
  account: SnippetAccount | null;
};

function isFetchSnippetsBody(v: unknown): v is FetchSnippetsBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.length === 0) return false;
  if (!Array.isArray(r.snippetIds)) return false;
  for (const s of r.snippetIds) if (typeof s !== "string") return false;
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
  if (!isFetchSnippetsBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed;

  if (body.snippetIds.length === 0) {
    return Response.json({ snippets: [] });
  }

  const sb = getAdminClient();

  // Pull snippets owned by this user only.
  const { data: snippetRows, error: snippetErr } = await sb
    .from("social_snippets")
    .select(
      "id, user_id, article_id, platform, variant, body, hashtags, image_url",
    )
    .eq("user_id", body.userId)
    .in("id", body.snippetIds);

  if (snippetErr) {
    return Response.json(
      { error: "snippet_query_failed", detail: snippetErr.message },
      { status: 500 },
    );
  }

  const snippets = (snippetRows ?? []) as SnippetRow[];
  if (snippets.length === 0) {
    return Response.json({ snippets: [] });
  }

  // Pull all active accounts for this user across the platforms we touch.
  const platforms = Array.from(new Set(snippets.map((s) => s.platform)));
  const { data: accountRows, error: accountErr } = await sb
    .from("social_accounts")
    .select("id, user_id, platform, webhook_url, oauth_token, active")
    .eq("user_id", body.userId)
    .eq("active", true)
    .in("platform", platforms);

  if (accountErr) {
    return Response.json(
      { error: "account_query_failed", detail: accountErr.message },
      { status: 500 },
    );
  }

  const accounts = (accountRows ?? []) as AccountRow[];

  // Pick the first active account per platform. If multiple, prefer one with
  // a webhook_url (since OAuth posting is not yet implemented).
  const accountByPlatform = new Map<string, AccountRow>();
  for (const a of accounts) {
    const existing = accountByPlatform.get(a.platform);
    if (!existing) {
      accountByPlatform.set(a.platform, a);
      continue;
    }
    const existingHasWebhook = !!existing.webhook_url;
    const candHasWebhook = !!a.webhook_url;
    if (!existingHasWebhook && candHasWebhook) {
      accountByPlatform.set(a.platform, a);
    }
  }

  const out: SnippetResponse[] = snippets.map((s) => {
    const acc = accountByPlatform.get(s.platform) ?? null;
    const accountOut: SnippetAccount | null = acc
      ? {
          id: acc.id,
          webhookUrl: acc.webhook_url,
          hasOauthToken: !!(acc.oauth_token && acc.oauth_token.length > 0),
        }
      : null;
    return {
      id: s.id,
      platform: s.platform,
      variant: s.variant ?? "default",
      body: s.body,
      hashtags: s.hashtags ?? [],
      imageUrl: s.image_url,
      sourceArticleId: s.article_id,
      account: accountOut,
    };
  });

  return Response.json({ snippets: out });
}
