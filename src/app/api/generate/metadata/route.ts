import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

const MODEL = "gpt-4.1-mini";

export async function POST(req: NextRequest) {
  try {
    const { topic, focusKeyword, articleContext, researchContext } =
      await req.json();

    if (!topic || !articleContext || !researchContext) {
      return NextResponse.json(
        { error: "Missing required fields from research phase" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an SEO expert specializing in content optimization. Generate highly optimized metadata for articles.",
        },
        {
          role: "user",
          content: `Based on this article context and research, generate optimized metadata.

ARTICLE CONTEXT:
${articleContext}

RESEARCH:
${researchContext}

TOPIC: ${topic}
${focusKeyword ? `PREFERRED FOCUS KEYWORD: ${focusKeyword}` : ""}

Generate the following in EXACTLY this JSON format (no markdown, no code blocks, just raw JSON):
{
  "title": "An SEO-optimized title (50-60 characters) that includes the focus keyword",
  "metaDescription": "A compelling meta description (150-160 characters) with the focus keyword",
  "slug": "url-friendly-slug-with-keyword",
  "focusKeyword": "the main focus keyword",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

The 5 keywords should be high-intent keywords related to the topic. They should be terms people actively search for when looking to take action.`,
        },
      ],
      temperature: 0.5,
    });

    const fallback = {
      title: topic,
      metaDescription: `Learn everything about ${topic}`,
      slug: topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
      focusKeyword: focusKeyword || topic,
      keywords: [] as string[],
    };

    let parsed: Record<string, unknown> = {};
    try {
      const raw = completion.choices[0].message.content || "{}";
      const cleaned = raw
        .replace(/```(?:json)?\n?/g, "")
        .replace(/```/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // JSON parse failed, use fallback entirely
    }

    // Normalize keys - GPT sometimes uses different casing
    const get = (obj: Record<string, unknown>, ...keys: string[]): unknown => {
      for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
      }
      return undefined;
    };

    const metadata = {
      title: (get(parsed, "title", "Title") as string) || fallback.title,
      metaDescription: (get(parsed, "metaDescription", "meta_description", "metadescription", "Meta Description", "MetaDescription") as string) || fallback.metaDescription,
      slug: (get(parsed, "slug", "Slug") as string) || fallback.slug,
      focusKeyword: (get(parsed, "focusKeyword", "focus_keyword", "FocusKeyword", "Focus Keyword") as string) || fallback.focusKeyword,
      keywords: (Array.isArray(parsed.keywords) ? parsed.keywords as string[] : Array.isArray(parsed.Keywords) ? parsed.Keywords as string[] : fallback.keywords),
    };

    return NextResponse.json(metadata);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
