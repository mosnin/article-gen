import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";
import { safeFetch } from "@/lib/ssrf";

export const runtime = "nodejs";

type FetchFeedBody = {
  competitorId: string;
  sinceDays?: number;
};

type FeedEntry = {
  url: string;
  title: string;
  publishedAt: string | null;
};

const USER_AGENT = "ArticleSauceBot/1.0";
const FETCH_TIMEOUT_MS = 10_000;

function isFetchFeedBody(v: unknown): v is FetchFeedBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.competitorId !== "string" || r.competitorId.trim() === "") return false;
  if (r.sinceDays !== undefined && typeof r.sinceDays !== "number") return false;
  return true;
}

// ---------------------------------------------------------------------------
// Tiny regex-based parsers (no XML deps). Sufficient for RSS 2.0 / Atom /
// XML sitemaps emitted by mainstream CMSes (WordPress, Ghost, Substack, etc.)
// ---------------------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function firstMatch(block: string, re: RegExp): string | null {
  const m = re.exec(block);
  return m ? decodeEntities(m[1]).trim() : null;
}

function parseDateLoose(raw: string | null): Date | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

function parseRssOrAtom(xml: string): FeedEntry[] {
  const entries: FeedEntry[] = [];

  // RSS 2.0: <item>...</item>
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = firstMatch(block, /<title\b[^>]*>([\s\S]*?)<\/title>/i) ?? "";
    const link =
      firstMatch(block, /<link\b[^>]*>([\s\S]*?)<\/link>/i) ??
      firstMatch(block, /<guid\b[^>]*>([\s\S]*?)<\/guid>/i) ??
      "";
    const pubRaw =
      firstMatch(block, /<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i) ??
      firstMatch(block, /<dc:date\b[^>]*>([\s\S]*?)<\/dc:date>/i) ??
      firstMatch(block, /<published\b[^>]*>([\s\S]*?)<\/published>/i);
    const url = link.trim();
    if (!url) continue;
    const pub = parseDateLoose(pubRaw);
    entries.push({
      url,
      title: title.trim(),
      publishedAt: pub ? pub.toISOString() : null,
    });
  }

  // Atom: <entry>...</entry> with <link href="...">
  const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1];
    const title = firstMatch(block, /<title\b[^>]*>([\s\S]*?)<\/title>/i) ?? "";
    const linkAttr = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?\s*>/i.exec(block);
    const url = linkAttr ? decodeEntities(linkAttr[1]).trim() : "";
    if (!url) continue;
    const pubRaw =
      firstMatch(block, /<published\b[^>]*>([\s\S]*?)<\/published>/i) ??
      firstMatch(block, /<updated\b[^>]*>([\s\S]*?)<\/updated>/i);
    const pub = parseDateLoose(pubRaw);
    entries.push({
      url,
      title: title.trim(),
      publishedAt: pub ? pub.toISOString() : null,
    });
  }

  return entries;
}

function parseSitemap(xml: string): FeedEntry[] {
  const entries: FeedEntry[] = [];
  const urlRe = /<url\b[^>]*>([\s\S]*?)<\/url>/gi;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(xml)) !== null) {
    const block = m[1];
    const loc = firstMatch(block, /<loc\b[^>]*>([\s\S]*?)<\/loc>/i);
    if (!loc) continue;
    const lastmod = firstMatch(block, /<lastmod\b[^>]*>([\s\S]*?)<\/lastmod>/i);
    const pub = parseDateLoose(lastmod);
    entries.push({
      url: loc,
      title: "",
      publishedAt: pub ? pub.toISOString() : null,
    });
  }
  return entries;
}

async function fetchText(url: string): Promise<string> {
  const resp = await safeFetch(
    url,
    {
      method: "GET",
      headers: { "User-Agent": USER_AGENT, Accept: "application/xml,text/xml,*/*" },
      timeoutMs: FETCH_TIMEOUT_MS,
    },
    ["http:", "https:"],
  );
  if (!resp.ok) {
    throw new Error(`upstream_status_${resp.status}`);
  }
  return await resp.text();
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
  if (!isFetchFeedBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed;
  const sinceDays = typeof body.sinceDays === "number" && body.sinceDays > 0 ? body.sinceDays : 14;

  const sb = getAdminClient();
  const { data: row, error: lookupErr } = await sb
    .from("competitors")
    .select("id, feed_url, sitemap_url, domain")
    .eq("id", body.competitorId)
    .maybeSingle();

  if (lookupErr) {
    return Response.json(
      { error: "query_failed", detail: lookupErr.message },
      { status: 500 },
    );
  }
  if (!row) {
    return Response.json({ entries: [], error: "competitor_not_found" });
  }

  const competitor = row as {
    id: string;
    feed_url: string | null;
    sitemap_url: string | null;
    domain: string | null;
  };

  const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  let entries: FeedEntry[] = [];
  let parseError: string | null = null;

  try {
    if (competitor.feed_url) {
      const xml = await fetchText(competitor.feed_url);
      entries = parseRssOrAtom(xml);
    } else if (competitor.sitemap_url) {
      const xml = await fetchText(competitor.sitemap_url);
      entries = parseSitemap(xml);
    } else {
      parseError = "no_feed_or_sitemap_configured";
    }
  } catch (e) {
    parseError = e instanceof Error ? e.message : String(e);
  }

  // Always update last_checked_at, success or failure.
  await sb
    .from("competitors")
    .update({ last_checked_at: new Date().toISOString() })
    .eq("id", competitor.id);

  if (parseError) {
    return Response.json({ entries: [], error: parseError });
  }

  // Filter by date window (drop entries with no publishedAt OR older than cutoff).
  // For sitemaps without lastmod we keep them (treat as recent) so the agent
  // can still discover URLs from leaner sitemaps.
  const filtered = entries.filter((e) => {
    if (!e.publishedAt) return !!competitor.sitemap_url && !competitor.feed_url;
    const t = Date.parse(e.publishedAt);
    if (Number.isNaN(t)) return false;
    return t >= cutoff.getTime();
  });

  // De-dupe by URL while preserving order; cap to a sane upper bound.
  const seen = new Set<string>();
  const out: FeedEntry[] = [];
  for (const e of filtered) {
    const key = e.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= 200) break;
  }

  return Response.json({ entries: out });
}
