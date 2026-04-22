import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import OpenAI from "openai";
import { analyzeSERP } from "@/lib/serp-analyzer";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { articleId, focusKeyword, currentContent } = await req.json() as {
    articleId?: string;
    focusKeyword: string;
    currentContent: string; // markdown content of the existing article
  };

  if (!focusKeyword?.trim()) return NextResponse.json({ error: "focusKeyword is required" }, { status: 400 });
  if (!currentContent?.trim()) return NextResponse.json({ error: "currentContent is required" }, { status: 400 });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // 1. SERP analysis to find what top rankers cover
  let serpAnalysis;
  try {
    serpAnalysis = await analyzeSERP(focusKeyword, 8);
  } catch (e) {
    console.warn("[refresh] SERP analysis failed:", e);
    serpAnalysis = null;
  }

  const serpContext = serpAnalysis
    ? `Top ranking pages cover these topics: ${serpAnalysis.commonTopics.join(", ")}.
Questions they answer: ${serpAnalysis.questionsAnswered.slice(0, 8).join(" | ")}.
Their common headings: ${serpAnalysis.commonHeadings.slice(0, 10).join(" | ")}.
Recommended word count to outrank: ${serpAnalysis.recommendedWordCount} words.`
    : "";

  const wordCount = currentContent.split(/\s+/).length;

  // 2. Generate refresh plan + improved content
  const refreshPrompt = `You are an expert SEO content editor. Refresh and improve the following article to outrank competitors.

Focus Keyword: "${focusKeyword}"
Current article word count: ~${wordCount} words

${serpContext}

EXISTING ARTICLE:
${currentContent.slice(0, 6000)}${currentContent.length > 6000 ? "\n[...article continues...]" : ""}

REFRESH INSTRUCTIONS:
1. Identify any topics from the SERP analysis that are MISSING from this article
2. Expand thin sections with more detail, examples, and data
3. Add any missing questions as FAQ entries
4. Update the introduction to be more compelling
5. Ensure all NLP terms from top rankers are naturally included
6. Add a "Key Takeaways" section if missing
7. Aim for at least ${serpAnalysis?.recommendedWordCount ?? Math.round(wordCount * 1.3)} words
8. Maintain the same markdown format and heading structure, expanding it
9. NEVER use em dashes (—) or en dashes (–)

Return the complete refreshed article in markdown format. Include ALL original content plus your additions/improvements.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: refreshPrompt }],
    temperature: 0.5,
    max_tokens: 8000,
  });

  const refreshedContent = completion.choices[0]?.message?.content ?? "";
  if (!refreshedContent) {
    return NextResponse.json({ error: "No content generated" }, { status: 500 });
  }

  const newWordCount = refreshedContent.split(/\s+/).length;

  // 3. If articleId provided, update in database
  if (articleId) {
    await supabase
      .from("articles")
      .update({
        article_markdown: refreshedContent,
        updated_at: new Date().toISOString(),
        last_refreshed_at: new Date().toISOString(),
        word_count: newWordCount,
      })
      .eq("id", articleId)
      .eq("user_id", user.id);
  }

  return NextResponse.json({
    content: refreshedContent,
    wordCount: newWordCount,
    previousWordCount: wordCount,
    wordsAdded: newWordCount - wordCount,
    serpTopics: serpAnalysis?.commonTopics ?? [],
    questionsAdded: serpAnalysis?.questionsAnswered ?? [],
  });
}
