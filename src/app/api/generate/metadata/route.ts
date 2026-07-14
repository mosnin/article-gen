import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase-server";
import { acquireGenerationSlot, releaseGenerationSlot } from "@/lib/rate-limit";
import { stripAiDashes } from "@/lib/sanitize-content";
import { logger } from "@/lib/logger";

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
    const { topic, focusKeyword, articleContext, researchContext, tone: rawTone, targetAudience: rawTargetAudience } =
      await req.json();

    const tone =
      typeof rawTone === "string" && rawTone.length <= 100
        ? rawTone
        : "Informative";
    const targetAudience =
      typeof rawTargetAudience === "string" && rawTargetAudience.length <= 100
        ? rawTargetAudience
        : "General audience";

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
            "You are an SEO expert specializing in content optimization. Generate highly optimized metadata for articles. Never use em dashes (—) or en dashes (–) in titles, descriptions, or any text; use commas, colons, or parentheses instead. You must respond with valid JSON only.",
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

WRITING TONE: ${tone}
TARGET AUDIENCE: ${targetAudience}
Ensure the title and meta description match the specified tone and appeal to the target audience.

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

    // Slugs must be unique per user — cluster pieces with sibling keywords
    // (e.g. "best running shoes" / "best running shoe") otherwise collide.
    // Suffix -2, -3, … until free.
    const ensureUniqueSlug = async (base: string): Promise<string> => {
      const slugBase = base || defaultSlug || "article";
      const { data: rows } = await supabase
        .from("articles")
        .select("slug")
        .eq("user_id", user.id)
        .like("slug", `${slugBase}%`)
        .limit(200);
      const taken = new Set((rows ?? []).map((r) => r.slug as string));
      if (!taken.has(slugBase)) return slugBase;
      for (let i = 2; i < 100; i++) {
        if (!taken.has(`${slugBase}-${i}`)) return `${slugBase}-${i}`;
      }
      return `${slugBase}-${Date.now().toString(36)}`;
    };

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
        title: stripAiDashes(parsed.title || topic),
        metaDescription: stripAiDashes(
          parsed.metaDescription || `Learn everything about ${topic}`,
        ),
        slug: await ensureUniqueSlug(keywordSlug),
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
        slug: await ensureUniqueSlug(fallbackSlug),
        focusKeyword: fallbackKeyword,
        keywords: [],
      };
    }

    return NextResponse.json(metadata);
  } catch (error: unknown) {
    logger.error("Failed to generate metadata", error);
    return NextResponse.json({ error: "Failed to generate metadata" }, { status: 500 });
  } finally {
    await releaseGenerationSlot(supabase, user.id);
  }
}
