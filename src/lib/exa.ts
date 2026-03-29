import Exa from "exa-js";

let _exa: Exa | null = null;
export function getExa(): Exa {
  if (!_exa) {
    const key = process.env.EXA_API_KEY;
    if (!key) throw new Error("EXA_API_KEY is not set");
    _exa = new Exa(key);
  }
  return _exa;
}

export interface ExaContentInsight {
  title: string;
  url: string;
  publishedDate?: string;
  score?: number;
  highlights?: string[];
}

/**
 * Research what content is already ranking/performing for a given niche.
 * Returns top results to help identify content gaps and avoid duplicating
 * already-saturated topics.
 */
export async function researchNicheContent(
  niche: string,
  options?: { numResults?: number; competitors?: string[] }
): Promise<ExaContentInsight[]> {
  const exa = getExa();
  const numResults = options?.numResults ?? 20;

  const query = `best ${niche} articles blog posts content strategy`;

  const result = await exa.searchAndContents(query, {
    numResults,
    type: "neural",
    highlights: { numSentences: 2, highlightsPerUrl: 1 },
    startPublishedDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return (result.results ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    publishedDate: r.publishedDate ?? undefined,
    score: r.score ?? undefined,
    highlights: (r.highlights ?? []).filter(Boolean),
  }));
}

/**
 * Find content gap opportunities — topics searched for but underserved.
 */
export async function findContentGaps(
  niche: string,
  numResults = 15
): Promise<ExaContentInsight[]> {
  const exa = getExa();

  const query = `${niche} guide tutorial how to tips`;

  const result = await exa.searchAndContents(query, {
    numResults,
    type: "keyword",
    highlights: { numSentences: 1, highlightsPerUrl: 1 },
  });

  return (result.results ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    score: r.score ?? undefined,
    highlights: (r.highlights ?? []).filter(Boolean),
  }));
}
