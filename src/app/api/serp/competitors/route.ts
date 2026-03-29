import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getExa } from "@/lib/exa";
import OpenAI from "openai";

export const maxDuration = 45;

export interface CompetitorPage {
  rank: number;
  title: string;
  url: string;
  domain: string;
  wordCountEstimate: number;
  keyTopics: string[];
  strengths: string[];
  weaknesses: string[];
  uniqueAngles: string[];
  highlights: string[];
}

export interface CompetitorAnalysis {
  keyword: string;
  pages: CompetitorPage[];
  commonStrengths: string[];
  commonWeaknesses: string[];
  contentGaps: string[];        // topics none of them cover well
  winningStrategy: string;      // GPT-synthesized strategy to beat them all
  recommendedWordCount: number;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { keyword, numCompetitors = 5 } = await req.json() as {
    keyword: string;
    numCompetitors?: number;
  };
  if (!keyword?.trim()) return NextResponse.json({ error: "keyword is required" }, { status: 400 });

  const exa = getExa();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Fetch top ranking pages with full content excerpts
  const results = await exa.searchAndContents(keyword, {
    numResults: Math.min(numCompetitors, 8),
    type: "neural",
    highlights: { numSentences: 5, highlightsPerUrl: 4 },
  });

  const rawPages = (results.results ?? []).slice(0, numCompetitors);

  // Use GPT to analyze each competitor
  const pagesData = rawPages.map((r, i) => ({
    rank: i + 1,
    title: r.title ?? "",
    url: r.url ?? "",
    domain: (() => { try { return new URL(r.url ?? "https://x.com").hostname.replace("www.", ""); } catch { return r.url ?? ""; } })(),
    highlights: (r.highlights ?? []).filter(Boolean),
  }));

  const analysisPrompt = `Analyze these top-ranking competitor pages for the keyword "${keyword}".

Competitors:
${pagesData.map((p, i) => `
[${p.rank}] ${p.domain}
Title: "${p.title}"
Content excerpts:
${p.highlights.map(h => `  - ${h}`).join("\n")}
`).join("\n---\n")}

For EACH competitor, identify:
1. Key topics they cover (3-5 specific topics)
2. Their content strengths (2-3 things they do well)
3. Their weaknesses / gaps (2-3 things they miss or do poorly)
4. Their unique angle / differentiation

Then synthesize:
- Common strengths across all (what everyone does well)
- Common weaknesses across all (what everyone misses)
- Content gaps — 4-6 specific topics NONE of them cover well
- A winning strategy: how to write ONE article that beats all of them

Return JSON:
{
  "pages": [
    {
      "rank": 1,
      "domain": "example.com",
      "wordCountEstimate": 2000,
      "keyTopics": ["topic1", "topic2"],
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1", "weakness2"],
      "uniqueAngles": ["their main angle"]
    }
  ],
  "commonStrengths": ["what all do well"],
  "commonWeaknesses": ["what all miss"],
  "contentGaps": ["gap1", "gap2", "gap3", "gap4"],
  "winningStrategy": "2-3 sentence strategy to create content that outranks all of them",
  "recommendedWordCount": 2500
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: analysisPrompt }],
    temperature: 0.5,
    response_format: { type: "json_object" },
  });

  let analysis: Partial<CompetitorAnalysis>;
  try {
    analysis = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
  } catch {
    return NextResponse.json({ error: "Failed to parse analysis" }, { status: 500 });
  }

  // Merge raw page data back in
  const pages: CompetitorPage[] = (analysis.pages ?? []).map((p: any, i: number) => ({
    ...p,
    rank: i + 1,
    title: pagesData[i]?.title ?? p.domain,
    url: pagesData[i]?.url ?? "",
    domain: pagesData[i]?.domain ?? p.domain,
    highlights: pagesData[i]?.highlights ?? [],
  }));

  return NextResponse.json({
    keyword,
    pages,
    commonStrengths: analysis.commonStrengths ?? [],
    commonWeaknesses: analysis.commonWeaknesses ?? [],
    contentGaps: analysis.contentGaps ?? [],
    winningStrategy: analysis.winningStrategy ?? "",
    recommendedWordCount: analysis.recommendedWordCount ?? 2000,
  } satisfies CompetitorAnalysis);
}
