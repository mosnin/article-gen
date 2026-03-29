import { getExa } from "@/lib/exa";

export interface SerpResult {
  title: string;
  url: string;
  domain: string;
  wordCountEstimate: number;
  headings: string[];
  highlights: string[];
  publishedDate?: string;
}

export interface SerpAnalysis {
  keyword: string;
  topResults: SerpResult[];
  avgWordCount: number;
  commonHeadings: string[];
  commonTopics: string[];
  questionsAnswered: string[];
  recommendedWordCount: number;
  topDomains: string[];
}

function estimateWordCount(text: string): number {
  return Math.round(text.split(/\s+/).filter(Boolean).length * 6); // highlights are excerpts, scale up
}

function extractHeadings(highlights: string[]): string[] {
  const headings: string[] = [];
  for (const h of highlights) {
    // Look for sentence fragments that read like headings
    const sentences = h.split(/[.!?]/).map(s => s.trim()).filter(s => s.length > 10 && s.length < 100);
    headings.push(...sentences.slice(0, 2));
  }
  return headings.slice(0, 5);
}

function extractQuestions(highlights: string[]): string[] {
  const questions: string[] = [];
  for (const h of highlights) {
    const matches = h.match(/[A-Z][^.!?]*\?/g) ?? [];
    questions.push(...matches);
  }
  return [...new Set(questions)].slice(0, 10);
}

function extractTopics(highlights: string[]): string[] {
  const all = highlights.join(" ").toLowerCase();
  // Extract noun phrases / key terms (simple heuristic)
  const words = all.split(/\s+/).filter(w => w.length > 4 && /^[a-z]+$/.test(w));
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] ?? 0) + 1;
  return Object.entries(freq)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w);
}

export async function analyzeSERP(keyword: string, numResults = 10): Promise<SerpAnalysis> {
  const exa = getExa();

  const result = await exa.searchAndContents(keyword, {
    numResults,
    type: "neural",
    highlights: { numSentences: 4, highlightsPerUrl: 3 },
  });

  const topResults: SerpResult[] = (result.results ?? []).map((r) => {
    const allHighlights = (r.highlights ?? []).filter(Boolean);
    return {
      title: r.title ?? "",
      url: r.url ?? "",
      domain: new URL(r.url ?? "https://example.com").hostname.replace("www.", ""),
      wordCountEstimate: estimateWordCount(allHighlights.join(" ")),
      headings: extractHeadings(allHighlights),
      highlights: allHighlights,
      publishedDate: r.publishedDate ?? undefined,
    };
  });

  const allHighlights = topResults.flatMap(r => r.highlights);
  const wordCounts = topResults.map(r => r.wordCountEstimate).filter(c => c > 200);
  const avgWordCount = wordCounts.length
    ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length)
    : 1500;

  return {
    keyword,
    topResults,
    avgWordCount,
    commonHeadings: topResults.flatMap(r => r.headings).slice(0, 15),
    commonTopics: extractTopics(allHighlights),
    questionsAnswered: extractQuestions(allHighlights),
    recommendedWordCount: Math.max(1500, Math.round(avgWordCount * 1.1)), // beat avg by 10%
    topDomains: topResults.map(r => r.domain),
  };
}
