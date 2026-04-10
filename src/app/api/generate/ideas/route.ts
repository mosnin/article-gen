import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase-server";
import { acquireGenerationSlot, releaseGenerationSlot } from "@/lib/rate-limit";
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
    const { niche, count, tone: rawTone, targetAudience: rawTargetAudience } = await req.json();

    const tone =
      typeof rawTone === "string" && rawTone.length <= 100
        ? rawTone
        : "Informative";
    const targetAudience =
      typeof rawTargetAudience === "string" && rawTargetAudience.length <= 100
        ? rawTargetAudience
        : "General audience";

    if (!niche) {
      return NextResponse.json(
        { error: "Missing niche field" },
        { status: 400 }
      );
    }

    if (typeof niche !== "string" || niche.trim().length === 0) {
      return NextResponse.json({ error: "Niche must be a non-empty string" }, { status: 400 });
    }

    if (niche.length > 200) {
      return NextResponse.json({ error: "Niche must be 200 characters or fewer" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const articleCount = Math.min(Math.max(count || 5, 1), 25);

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an expert SEO content strategist who generates high-value article ideas for blogs. You identify topics with strong search intent and ranking potential. You must respond with valid JSON only.",
        },
        {
          role: "user",
          content: `Generate exactly ${articleCount} unique, high-value SEO article ideas for the niche: "${niche}"

WRITING TONE: ${tone}
TARGET AUDIENCE: ${targetAudience}
Generate ideas that match the specified tone and appeal to the target audience.

REQUIREMENTS:
- Each idea should target a specific, searchable topic with clear user intent
- Focus keywords should be realistic long-tail keywords people actually search for
- Mix informational, commercial, and how-to content types
- Avoid generic or overly broad topics
- Each concept should be specific enough to write a focused, comprehensive article

Return EXACTLY this JSON format:
{
  "ideas": [
    {
      "concept": "A specific, descriptive article topic that would make a great blog post title angle",
      "keyword": "target focus keyword phrase"
    }
  ]
}

Generate exactly ${articleCount} ideas.`,
        },
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content || "{}";
    const parsed = JSON.parse(raw);

    return NextResponse.json({ ideas: parsed.ideas || [] });
  } catch (error: unknown) {
    logger.error("Failed to generate ideas", error);
    return NextResponse.json({ error: "Failed to generate ideas" }, { status: 500 });
  } finally {
    await releaseGenerationSlot(supabase, user.id);
  }
}
