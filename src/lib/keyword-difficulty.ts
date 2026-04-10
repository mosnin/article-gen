import { getExa } from "@/lib/exa";

export interface KeywordDifficulty {
  keyword: string;
  difficulty: number; // 0-100
  label: "Easy" | "Medium" | "Hard" | "Very Hard";
  topDomains: string[];
  estimatedWordCount: number;
}

const HIGH_AUTH_DOMAINS = [
  "wikipedia.org", "reddit.com", "quora.com", "medium.com",
  "forbes.com", "nytimes.com", "techcrunch.com", "hubspot.com",
  "moz.com", "semrush.com", "ahrefs.com", "shopify.com",
  "amazon.com", "linkedin.com", "twitter.com", "youtube.com",
];

function isHighAuthority(domain: string): boolean {
  return HIGH_AUTH_DOMAINS.some(d => domain.includes(d));
}

export async function estimateKeywordDifficulty(keyword: string): Promise<KeywordDifficulty> {
  const exa = getExa();

  const results = await exa.searchAndContents(keyword, {
    numResults: 10,
    type: "neural",
    highlights: { numSentences: 1, highlightsPerUrl: 1 },
  });

  const rows = results.results ?? [];

  const domains = rows.map(r => {
    try { return new URL(r.url ?? "").hostname.replace("www.", ""); } catch { return ""; }
  }).filter(Boolean);

  const highAuthCount = domains.filter(isHighAuthority).length;
  const uniqueDomains = [...new Set(domains)].length;

  // Difficulty heuristic:
  // - High-authority domains in top 10 = +10 each (max 50)
  // - Fewer unique domains = more consolidated = harder
  const authScore = Math.min(highAuthCount * 10, 50);
  const concentrationScore = uniqueDomains < 6 ? 20 : uniqueDomains < 8 ? 10 : 0;
  const lengthScore = keyword.split(" ").length <= 2 ? 20 : keyword.split(" ").length <= 3 ? 10 : 5;

  const difficulty = Math.min(100, authScore + concentrationScore + lengthScore);

  const label: KeywordDifficulty["label"] =
    difficulty >= 70 ? "Very Hard" :
    difficulty >= 45 ? "Hard" :
    difficulty >= 25 ? "Medium" : "Easy";

  // Rough word count estimate from competition level
  const estimatedWordCount = difficulty >= 70 ? 3000 : difficulty >= 45 ? 2200 : difficulty >= 25 ? 1600 : 1200;

  return {
    keyword,
    difficulty,
    label,
    topDomains: domains.slice(0, 5),
    estimatedWordCount,
  };
}

export async function batchEstimateDifficulty(keywords: string[]): Promise<Map<string, KeywordDifficulty>> {
  const results = await Promise.allSettled(keywords.map(k => estimateKeywordDifficulty(k)));
  const map = new Map<string, KeywordDifficulty>();
  keywords.forEach((k, i) => {
    const r = results[i];
    if (r.status === "fulfilled") map.set(k, r.value);
  });
  return map;
}
