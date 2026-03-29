import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getExa } from "@/lib/exa";
import OpenAI from "openai";

export const maxDuration = 45;

export type SnippetType = "paragraph" | "list" | "table" | "how-to" | "none";

export interface SnippetOpportunity {
  keyword: string;
  snippetType: SnippetType;
  currentSnippetOwner: string | null;
  rewrittenSection: string;
  targetHeading: string;
  tips: string[];
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { keyword, content } = await req.json() as { keyword: string; content: string };
  if (!keyword?.trim()) return NextResponse.json({ error: "keyword required" }, { status: 400 });

  const exa = getExa();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Fetch top SERP results to detect snippet type
  let serpHighlights: string[] = [];
  let currentSnippetOwner: string | null = null;
  try {
    const results = await exa.searchAndContents(keyword, {
      numResults: 5,
      type: "neural",
      highlights: { numSentences: 3, highlightsPerUrl: 2 },
    });
    const top = results.results?.[0];
    if (top) {
      try { currentSnippetOwner = new URL(top.url ?? "").hostname.replace("www.", ""); } catch { /* ignore */ }
      serpHighlights = (top.highlights ?? []).filter(Boolean);
    }
  } catch { /* fail gracefully */ }

  const prompt = `You are an SEO expert specializing in featured snippets.

Keyword: "${keyword}"

Current top-ranking content excerpt:
${serpHighlights.length ? serpHighlights.join("\n") : "(no data)"}

User's article content (first 3000 chars):
${(content ?? "").slice(0, 3000)}

Analyze:
1. What type of featured snippet does this keyword trigger? (paragraph/list/table/how-to/none)
2. Rewrite the most relevant section of the user's article to win that snippet type
3. Suggest a heading that signals the direct answer format Google loves

Return JSON:
{
  "snippetType": "paragraph|list|table|how-to|none",
  "targetHeading": "What is [keyword]? / How to [keyword] / etc.",
  "rewrittenSection": "The optimized content section (100-300 words, formatted for the snippet type)",
  "tips": ["3-4 specific tips to maximize snippet eligibility"]
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    response_format: { type: "json_object" },
  });

  let result: Partial<SnippetOpportunity>;
  try {
    result = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
  } catch {
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
  }

  return NextResponse.json({
    keyword,
    snippetType: result.snippetType ?? "none",
    currentSnippetOwner,
    rewrittenSection: result.rewrittenSection ?? "",
    targetHeading: result.targetHeading ?? "",
    tips: result.tips ?? [],
  } satisfies SnippetOpportunity);
}
