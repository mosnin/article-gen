import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type FindBody = {
  userId: string;
  threshold?: number;
};

type EmbeddingRow = {
  article_id: string | null;
  title: string | null;
  keyword: string | null;
  embedding: unknown;
};

type Pair = {
  primaryArticleId: string;
  secondaryArticleId: string;
  similarityScore: number;
  sharedKeywords: string[];
};

const MAX_PAIRS = 100;

function isFindBody(v: unknown): v is FindBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (r.threshold !== undefined && (typeof r.threshold !== "number" || Number.isNaN(r.threshold))) {
    return false;
  }
  return true;
}

/** Coerce a pgvector cell into a Float64Array. Supabase JS returns vector
 *  columns as JSON strings like "[0.1,0.2,...]" (or sometimes already-parsed
 *  arrays). Returns null if the value is unusable. */
function toVector(raw: unknown): Float64Array | null {
  if (raw == null) return null;
  let arr: unknown;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return null;
    }
  } else {
    arr = raw;
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const out = new Float64Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    const n = typeof arr[i] === "number" ? (arr[i] as number) : Number(arr[i]);
    if (!Number.isFinite(n)) return null;
    out[i] = n;
  }
  return out;
}

/** Pre-computed L2 norm so we can divide by ||a||*||b|| once per pair. */
function l2Norm(v: Float64Array): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

/** Cosine similarity = dot(a, b) / (||a|| * ||b||). Assumes equal length;
 *  returns 0 if either norm is 0 or lengths mismatch (defensive). */
function cosine(a: Float64Array, b: Float64Array, normA: number, normB: number): number {
  if (a.length !== b.length) return 0;
  if (normA === 0 || normB === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot / (normA * normB);
}

function tokenizeKeywords(s: string | null): Set<string> {
  if (!s) return new Set();
  const out = new Set<string>();
  for (const tok of s.toLowerCase().split(/[\s,;|/]+/)) {
    const cleaned = tok.replace(/[^a-z0-9-]/g, "").trim();
    if (cleaned.length >= 3) out.add(cleaned);
  }
  return out;
}

function intersectKeywords(a: Set<string>, b: Set<string>, cap: number): string[] {
  const out: string[] = [];
  for (const k of a) {
    if (b.has(k)) {
      out.push(k);
      if (out.length >= cap) break;
    }
  }
  return out;
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
  if (!isFindBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const threshold = Math.min(1, Math.max(0, parsed.threshold ?? 0.85));
  const sb = getAdminClient();

  // Pull every embedding row for this user that is bound to an article.
  // (Slot-only embeddings — autopilot pre-flight checks — have null article_id
  //  and aren't part of the published corpus we want to dedupe.)
  const { data, error } = await sb
    .from("article_embeddings")
    .select("article_id, title, keyword, embedding")
    .eq("user_id", parsed.userId)
    .not("article_id", "is", null);

  if (error) {
    return Response.json(
      { error: "query_failed", detail: error.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as EmbeddingRow[];

  // Materialise vectors + norms once. Drop rows that fail to parse.
  type Prepped = {
    articleId: string;
    keyword: string | null;
    keywordTokens: Set<string>;
    vec: Float64Array;
    norm: number;
  };
  const prepped: Prepped[] = [];
  for (const r of rows) {
    if (!r.article_id) continue;
    const vec = toVector(r.embedding);
    if (!vec) continue;
    const norm = l2Norm(vec);
    if (norm === 0) continue;
    prepped.push({
      articleId: r.article_id,
      keyword: r.keyword,
      keywordTokens: tokenizeKeywords(r.keyword),
      vec,
      norm,
    });
  }

  // O(n^2) pairwise scan. Acceptable up to a few thousand articles per user.
  // Each pair recorded once (i < j).
  const pairs: Pair[] = [];
  let pairsScanned = 0;
  for (let i = 0; i < prepped.length; i++) {
    const a = prepped[i];
    for (let j = i + 1; j < prepped.length; j++) {
      const b = prepped[j];
      pairsScanned += 1;
      const sim = cosine(a.vec, b.vec, a.norm, b.norm);
      if (sim < threshold) continue;
      pairs.push({
        primaryArticleId: a.articleId,
        secondaryArticleId: b.articleId,
        similarityScore: Math.max(0, Math.min(1, sim)),
        sharedKeywords: intersectKeywords(a.keywordTokens, b.keywordTokens, 6),
      });
    }
  }

  // Top N by similarity (descending). Cap at MAX_PAIRS.
  pairs.sort((x, y) => y.similarityScore - x.similarityScore);
  const topPairs = pairs.slice(0, MAX_PAIRS);

  return Response.json({ pairs: topPairs, pairsScanned });
}
