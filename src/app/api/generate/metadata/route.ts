import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase-server";
import { acquireGenerationSlot, releaseGenerationSlot } from "@/lib/rate-limit";

export const maxDuration = 60;

const MODEL = "gpt-4.1-mini";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slotAcquired = await acquireGenerationSlot(supabase, user.id);
  if (!slotAcquired) {
    return NextResponse.json(
      { error: "Too many concurrent generations (max 5). Please wait for a generation to complete." },
      { status: 429 }
    );
  }

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
            "You are an SEO expert specializing in content optimization. Generate highly optimized metadata for articles. You must respond with valid JSON only.",
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

Generate the following in EXACTLY this JSON format:
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
      response_format: { type: "json_object" },
    });

    const defaultSlug = topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    let metadata: {
      title: string;
      metaDescription: string;
      slug: string;
      focusKeyword: string;
      keywords: string[];
    };

    try {
      const raw = completion.choices[0].message.content || "{}";
      const parsed = JSON.parse(raw);

      const resolvedKeyword = parsed.focusKeyword || focusKeyword || topic;
      const keywordSlug = resolvedKeyword
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      metadata = {
        title: parsed.title || topic,
        metaDescription:
          parsed.metaDescription || `Learn everything about ${topic}`,
        slug: keywordSlug,
        focusKeyword: resolvedKeyword,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      };
    } catch {
      const fallbackKeyword = focusKeyword || topic;
      const fallbackSlug = fallbackKeyword
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      metadata = {
        title: topic,
        metaDescription: `Learn everything about ${topic}`,
        slug: fallbackSlug,
        focusKeyword: fallbackKeyword,
        keywords: [],
      };
    }

    return NextResponse.json(metadata);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await releaseGenerationSlot(supabase, user.id);
  }
}
