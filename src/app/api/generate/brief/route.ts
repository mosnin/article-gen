import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getExa } from "@/lib/exa";
import OpenAI from "openai";

export const maxDuration = 60;

export interface ContentBrief {
  keyword: string;
  suggestedTitle: string;
  suggestedWordCount: number;
  targetAudience: string;
  contentAngle: string;
  mustIncludeTopics: string[];
  questionsToAnswer: string[];
  competitorInsights: Array<{ domain: string; title: string; angle: string }>;
  suggestedOutline: string[];
  nlpTermsToInclude: string[];
  internalLinkOpportunities: string[];
}

async function fetchSERPData(keyword: string) {
  const exa = getExa();
  const [neural, keyword_results] = await Promise.all([
    exa.searchAndContents(keyword, {
      numResults: 8,
      type: "neural",
      highlights: { numSentences: 3, highlightsPerUrl: 2 },
    }),
    exa.search(`${keyword} guide tutorial how to`, {
      numResults: 5,
      type: "keyword",
    }),
  ]);
  return { neural: neural.results ?? [], keyword: keyword_results.results ?? [] };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { keyword, niche, targetAudience } = await req.json() as {
    keyword: string;
    niche?: string;
    targetAudience?: string;
  };
  if (!keyword?.trim()) return NextResponse.json({ error: "keyword is required" }, { status: 400 });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Fetch SERP data
  let serpData = { neural: [] as any[], keyword: [] as any[] };
  try {
    serpData = await fetchSERPData(keyword);
  } catch (e) {
    console.warn("[brief] SERP fetch failed:", e);
  }

  const competitorSummary = serpData.neural.slice(0, 5).map(r => ({
    title: r.title ?? "",
    url: r.url ?? "",
    highlights: (r.highlights ?? []).join(" ").slice(0, 300),
  }));

  const prompt = `You are an expert SEO content strategist. Create a detailed content brief.

Keyword: "${keyword}"
${niche ? `Niche: ${niche}` : ""}
${targetAudience ? `Target Audience: ${targetAudience}` : ""}

Top competing content:
${competitorSummary.map((c, i) => `${i + 1}. "${c.title}"\n   ${c.highlights}`).join("\n\n")}

Generate a comprehensive content brief as JSON:
{
  "suggestedTitle": "compelling SEO title 50-70 chars",
  "suggestedWordCount": number (beat competitors by 10-20%, min 1200),
  "targetAudience": "specific audience description",
  "contentAngle": "unique angle that differentiates from competitors",
  "mustIncludeTopics": ["topic1", "topic2", ...] (8-12 essential subtopics),
  "questionsToAnswer": ["question1", ...] (6-10 questions readers have),
  "competitorInsights": [{"domain": "example.com", "title": "...", "angle": "their approach in 1 sentence"}, ...] (top 3),
  "suggestedOutline": ["H2: Introduction", "H2: Section 1", "H3: Subsection", ...] (full outline, 8-15 items),
  "nlpTermsToInclude": ["term1", "term2", ...] (15-20 semantically related terms NLP engines look for),
  "internalLinkOpportunities": ["related topic 1", "related topic 2", ...] (5 cluster article ideas)
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.6,
    response_format: { type: "json_object" },
  });

  let brief: Partial<ContentBrief>;
  try {
    brief = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
  } catch {
    return NextResponse.json({ error: "Failed to parse brief" }, { status: 500 });
  }

  return NextResponse.json({
    keyword,
    ...brief,
  });
}
