import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type FilterSeenBody = {
  userId: string;
  urls: string[];
};

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isFilterSeenBody(v: unknown): v is FilterSeenBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.userId === "string" &&
    r.userId.trim() !== "" &&
    isStringArray(r.urls)
  );
}

function normalizeUrl(u: string): string {
  return u.trim().toLowerCase();
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
  if (!isFilterSeenBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed;

  // Normalise + dedupe inputs while remembering the first original casing.
  const normalizedToOriginal = new Map<string, string>();
  for (const original of body.urls) {
    const norm = normalizeUrl(original);
    if (!norm) continue;
    if (!normalizedToOriginal.has(norm)) {
      normalizedToOriginal.set(norm, original);
    }
  }

  if (normalizedToOriginal.size === 0) {
    return Response.json({ newUrls: [], seenUrls: [] });
  }

  const candidates = Array.from(normalizedToOriginal.keys());
  const sb = getAdminClient();

  // Persisted urls are stored as-is, but the unique index is on lower(url).
  // Pull all this user's competitor_article urls that match (case-insensitive)
  // any candidate by chunking with .in() and comparing in JS.
  const seenNormalized = new Set<string>();
  const CHUNK = 200;
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const slice = candidates.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from("competitor_articles")
      .select("url")
      .eq("user_id", body.userId)
      .in("url", slice);
    if (error) {
      return Response.json(
        { error: "query_failed", detail: error.message },
        { status: 500 },
      );
    }
    for (const row of data ?? []) {
      const u = (row as { url?: string }).url;
      if (typeof u === "string") seenNormalized.add(normalizeUrl(u));
    }
  }

  const newUrls: string[] = [];
  const seenUrls: string[] = [];
  for (const [norm, original] of normalizedToOriginal.entries()) {
    if (seenNormalized.has(norm)) seenUrls.push(original);
    else newUrls.push(original);
  }

  return Response.json({ newUrls, seenUrls });
}
