import { requireInternalAuth } from "@/lib/agent-auth";
import { getExa } from "@/lib/exa";

export const runtime = "nodejs";

type FindRecentNewsBody = {
  niche: string;
  days?: number;
  numResults?: number;
};

type RecentNewsResult = {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  publishedDate: string;
};

function isFindRecentNewsBody(v: unknown): v is FindRecentNewsBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.niche !== "string" || r.niche.trim() === "") return false;
  if (r.days !== undefined && typeof r.days !== "number") return false;
  if (r.numResults !== undefined && typeof r.numResults !== "number") return false;
  return true;
}

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
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
  if (!isFindRecentNewsBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed;
  const days = typeof body.days === "number" && body.days > 0 ? body.days : 30;
  const numResults = typeof body.numResults === "number" ? body.numResults : 15;
  const startPublishedDate = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    const exa = getExa();
    const result = await exa.searchAndContents(body.niche, {
      numResults,
      type: "neural",
      startPublishedDate,
      highlights: { numSentences: 2, highlightsPerUrl: 1 },
    });

    const results: RecentNewsResult[] = (result.results ?? [])
      .map((r) => {
        const highlights = (r.highlights ?? []).filter(
          (h): h is string => typeof h === "string" && h.length > 0,
        );
        const snippet = highlights[0] ?? "";
        const url = r.url ?? "";
        const publishedDate = r.publishedDate ?? "";
        return {
          title: r.title ?? "",
          url,
          domain: safeDomain(url),
          snippet,
          publishedDate,
        };
      })
      .filter((r) => r.publishedDate !== "");

    return Response.json({ results });
  } catch (e) {
    return Response.json(
      { error: "find_recent_news_failed", detail: String(e) },
      { status: 502 },
    );
  }
}
