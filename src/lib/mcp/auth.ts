/**
 * MCP server authentication and authorization.
 *
 * Auth methods, in order of preference:
 *  1. `Authorization: Bearer agmcp_<hex>` — v2 key. Only the SHA-256 hash is
 *     stored server-side; scopes, expiry, and revocation are enforced.
 *  2. `Authorization: Bearer <legacy-uuid>` — pre-v2 plaintext key kept in
 *     user_settings.mcp_api_key. Deprecated; grants full scopes.
 *  3. Supabase session cookie — dashboard/browser use. Grants full scopes,
 *     but only when the request Origin (if present) matches the app origin,
 *     to keep cross-site pages from riding the session.
 */

import crypto from "crypto";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminClient } from "@/lib/supabase-admin";

export const MCP_SCOPES = ["read", "generate", "publish", "connections", "write"] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

export const KEY_PREFIX = "agmcp_";

export type McpAuth = {
  userId: string;
  /** mcp_keys.id when authenticated with a v2 key; null for legacy/session. */
  keyId: string | null;
  scopes: McpScope[];
  via: "key" | "legacy-key" | "session";
};

export function hashKey(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

/** Generate a new v2 key. Returns the full token (shown to the user once)
 *  plus what gets persisted. */
export function generateKey(): { token: string; hash: string; prefix: string } {
  const token = KEY_PREFIX + crypto.randomBytes(24).toString("hex");
  return { token, hash: hashKey(token), prefix: token.slice(0, KEY_PREFIX.length + 6) };
}

function parseScopes(raw: unknown): McpScope[] {
  if (!Array.isArray(raw)) return ["read"];
  const valid = raw.filter((s): s is McpScope => (MCP_SCOPES as readonly string[]).includes(s));
  return valid.length > 0 ? valid : ["read"];
}

export async function resolveMcpAuth(req: NextRequest): Promise<McpAuth | null> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (token && token.startsWith(KEY_PREFIX)) {
    const admin = getAdminClient();
    const { data } = await admin
      .from("mcp_keys")
      .select("id, user_id, scopes, expires_at, revoked_at")
      .eq("key_hash", hashKey(token))
      .maybeSingle();

    if (!data) return null;
    if (data.revoked_at) return null;
    if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) return null;

    // Best-effort usage stamp; never block the request on it.
    void admin
      .from("mcp_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id)
      .then(() => {}, () => {});

    return {
      userId: data.user_id as string,
      keyId: data.id as string,
      scopes: parseScopes(data.scopes),
      via: "key",
    };
  }

  if (token) {
    // Legacy plaintext key. Look up by value; constant-time compare the
    // stored value against the presented token to avoid a mismatch on
    // partial-index lookups behaving oddly.
    const admin = getAdminClient();
    const { data } = await admin
      .from("user_settings")
      .select("user_id, mcp_api_key")
      .eq("mcp_api_key", token)
      .maybeSingle();
    if (data?.user_id && typeof data.mcp_api_key === "string") {
      const a = Buffer.from(data.mcp_api_key);
      const b = Buffer.from(token);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return { userId: data.user_id as string, keyId: null, scopes: [...MCP_SCOPES], via: "legacy-key" };
      }
    }
    return null;
  }

  // Session cookie fallback (dashboard use). Reject cross-origin browser
  // requests: a cookie-bearing POST from another site must not reach tools.
  const origin = req.headers.get("origin");
  if (origin) {
    const selfOrigin = new URL(req.url).origin;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const allowed = [selfOrigin, appUrl ? new URL(appUrl).origin : null].filter(Boolean);
    if (!allowed.includes(origin)) return null;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return { userId: user.id, keyId: null, scopes: [...MCP_SCOPES], via: "session" };

  return null;
}
