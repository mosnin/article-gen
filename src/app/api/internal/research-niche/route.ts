import { requireInternalAuth } from "@/lib/agent-auth";
import { researchNicheContent } from "@/lib/exa";

export const runtime = "nodejs";

type ResearchBody = {
  niche: string;
  options?: { numResults?: number; competitors?: string[] };
};

type SerpResultShape = {
  title: string;
  url: string;
  domain: string;
  wordCountEstimate: number;
  headings: string[];
  highlights: string[];
  publishedDate?: string;
};

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

  let body: ResearchBody;
  try {
    body = JSON.parse(auth.rawBody) as ResearchBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.niche) {
    return Response.json({ error: "niche_required" }, { status: 400 });
  }

  try {
    const insights = await researchNicheContent(body.niche, body.options ?? {});
    // Adapt ExaContentInsight[] -> NicheResearch { results, gaps, trendingAngles }
    const results: SerpResultShape[] = insights.map((r) => {
      const highlights = (r.highlights ?? []).filter(
        (h): h is string => typeof h === "string" && h.length > 0,
      );
      return {
        title: r.title,
        url: r.url,
        domain: safeDomain(r.url),
        wordCountEstimate: 0,
        headings: [],
        highlights,
        publishedDate: r.publishedDate,
      };
    });

    return Response.json({
      results,
      gaps: [] as string[],
      trendingAngles: [] as string[],
    });
  } catch (e) {
    return Response.json(
      { error: "research_failed", detail: String(e) },
      { status: 502 },
    );
  }
}
