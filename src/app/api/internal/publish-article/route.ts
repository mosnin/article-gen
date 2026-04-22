import { requireInternalAuth } from "@/lib/agent-auth";

export const runtime = "nodejs";

// TODO(agent-publish): All existing per-platform publish routes
// (src/app/api/{wordpress,ghost,medium,shopify,devto}/publish/route.ts) gate
// on `supabase.auth.getUser()` via a user session cookie. They cannot be
// invoked server-to-server under the HMAC internal-auth (agent) context.
//
// Until their core publish logic is factored out into pure helpers under
// `src/lib/publish/{wordpress,ghost,medium,shopify,devto}.ts` (accepting an
// admin SupabaseClient + userId directly), this endpoint cannot publish on
// behalf of the user. Each platform currently returns:
//   { success: false, error: "platform_requires_session_refactor" }
//
// Tracking: the helper-extraction refactor is intentionally out of scope for
// the phase-2 wave-2 agent routes; a follow-up PR should land the
// `src/lib/publish/*.ts` helpers and update this dispatcher to call them.

type PlatformKind = "wordpress" | "ghost" | "medium" | "shopify" | "devto";
type PlatformTarget = { kind: PlatformKind; id: string };

type PlatformResult = {
  platform: string;
  accountId: string;
  success: boolean;
  postUrl?: string;
  error?: string;
};

const SESSION_REFACTOR_BLOCKED: ReadonlySet<PlatformKind> = new Set([
  "wordpress",
  "ghost",
  "medium",
  "shopify",
  "devto",
]);

export async function POST(req: Request) {
  const auth = await requireInternalAuth(req);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { userId: string; articleId: string; platforms: PlatformTarget[] };
  try {
    body = JSON.parse(auth.rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    !body.userId ||
    !body.articleId ||
    !Array.isArray(body.platforms)
  ) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const results: PlatformResult[] = body.platforms.map((p) => {
    // Every platform is currently session-gated — see TODO above.
    if (SESSION_REFACTOR_BLOCKED.has(p.kind)) {
      return {
        platform: p.kind,
        accountId: p.id,
        success: false,
        error: "platform_requires_session_refactor",
      };
    }
    return {
      platform: p.kind,
      accountId: p.id,
      success: false,
      error: "unsupported_platform",
    };
  });

  return Response.json({ results });
}
