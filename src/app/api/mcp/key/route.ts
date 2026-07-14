import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminClient } from "@/lib/supabase-admin";
import { generateKey, MCP_SCOPES, type McpScope } from "@/lib/mcp/auth";

/**
 * MCP API key management (session-authenticated, dashboard only).
 *
 * GET    → list the user's keys (never the key material — only prefixes)
 * POST   → create a key; the full token is returned ONCE in this response
 * DELETE → revoke a key by id
 *
 * Keys are stored as SHA-256 hashes; a lost key cannot be recovered, only
 * replaced. Legacy plaintext keys (user_settings.mcp_api_key) keep working
 * for auth but are surfaced here as a deprecation notice.
 */

async function requireUser() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null; // fail closed on backend misconfiguration
  }
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminClient();
  const [{ data: keys }, { data: settings }] = await Promise.all([
    admin
      .from("mcp_keys")
      .select("id, name, key_prefix, scopes, created_at, last_used_at, expires_at, revoked_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("user_settings")
      .select("mcp_api_key")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    keys: keys ?? [],
    hasLegacyKey: Boolean(settings?.mcp_api_key),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; scopes?: string[]; expires_in_days?: number } = {};
  try { body = await req.json(); } catch { /* defaults */ }

  const name = (body.name ?? "MCP key").slice(0, 100);
  const scopes = Array.isArray(body.scopes)
    ? body.scopes.filter((s): s is McpScope => (MCP_SCOPES as readonly string[]).includes(s))
    : [...MCP_SCOPES];
  if (scopes.length === 0) {
    return NextResponse.json({ error: "At least one valid scope is required" }, { status: 400 });
  }
  const expiresAt = body.expires_in_days && body.expires_in_days > 0
    ? new Date(Date.now() + Math.min(body.expires_in_days, 3650) * 86400000).toISOString()
    : null;

  const admin = getAdminClient();

  // Cap keys per user to bound abuse.
  const { count } = await admin
    .from("mcp_keys")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("revoked_at", null);
  if ((count ?? 0) >= 10) {
    return NextResponse.json({ error: "Key limit reached (10). Revoke an old key first." }, { status: 400 });
  }

  const { token, hash, prefix } = generateKey();
  const { data, error } = await admin
    .from("mcp_keys")
    .insert({ user_id: user.id, name, key_hash: hash, key_prefix: prefix, scopes, expires_at: expiresAt })
    .select("id, name, key_prefix, scopes, created_at, expires_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Clear any legacy plaintext key the moment a v2 key exists.
  await admin
    .from("user_settings")
    .update({ mcp_api_key: null })
    .eq("user_id", user.id);

  return NextResponse.json({ apiKey: token, key: data });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keyId = new URL(req.url).searchParams.get("id");
  if (!keyId) return NextResponse.json({ error: "id query param is required" }, { status: 400 });

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("mcp_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Key not found or already revoked" }, { status: 404 });
  return NextResponse.json({ revoked: true });
}
