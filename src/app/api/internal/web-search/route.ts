import { requireInternalAuth } from "@/lib/agent-auth";
import { getExa } from "@/lib/exa";

export const runtime = "nodejs";

type WebSearchBody = {
  niche: string;
  query: string;
  numResults?: number;
};

type WebSearchResult = {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  publishedDate?: string;
};

function isWebSearchBody(v: unknown): v is WebSearchBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.niche !== "string" || r.niche.trim() === "") return false;
  if (typeof r.query !== "string" || r.query.trim() === "") return false;
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
  if (!isWebSearchBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed;
  const numResults = typeof body.numResults === "number" ? body.numResults : 10;

  // Niche-bound query: prepend the niche so Exa stays inside it.
  const nicheBoundedQuery = `${body.niche} ${body.query}`.trim();

  try {
    const exa = getExa();
    const result = await exa.searchAndContents(nicheBoundedQuery, {
      numResults,
      type: "neural",
      highlights: { numSentences: 2, highlightsPerUrl: 1 },
    });

    const results: WebSearchResult[] = (result.results ?? []).map((r) => {
      const highlights = (r.highlights ?? []).filter(
        (h): h is string => typeof h === "string" && h.length > 0,
      );
      const snippet = highlights[0] ?? "";
      const url = r.url ?? "";
      return {
        title: r.title ?? "",
        url,
        domain: safeDomain(url),
        snippet,
        publishedDate: r.publishedDate ?? undefined,
      };
    });

    return Response.json({ results });
  } catch (e) {
    return Response.json(
      { error: "web_search_failed", detail: String(e) },
      { status: 502 },
    );
  }
}
