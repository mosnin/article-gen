import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { acquireGenerationSlot, releaseGenerationSlot } from "@/lib/rate-limit";
import OpenAI from "openai";
import { logger } from "@/lib/logger";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const slotAcquired = await acquireGenerationSlot(supabase, user.id);
  if (!slotAcquired) {
    return NextResponse.json(
      {
        error:
          "Too many concurrent generations (max 5). Please wait for a generation to complete.",
      },
      { status: 429 }
    );
  }

  try {
    const { topic, focusKeyword, wordCount = 2000, advancedSettings, tone: rawTone, targetAudience: rawTargetAudience } =
      await req.json();

    const tone =
      typeof rawTone === "string" && rawTone.length <= 100
        ? rawTone
        : "Informative";
    const targetAudience =
      typeof rawTargetAudience === "string" && rawTargetAudience.length <= 100
        ? rawTargetAudience
        : "General audience";

    if (!topic || typeof topic !== "string" || topic.length > 300) {
      return NextResponse.json(
        { error: "Topic is required (max 300 chars)" },
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

    const systemPrompt = `You are an expert SEO content strategist. Generate a structured article outline.
Return ONLY valid JSON matching this schema exactly:
{
  "title": "suggested article title",
  "outline": [
    { "level": 2, "heading": "Introduction", "notes": "brief notes on what to cover" },
    { "level": 2, "heading": "Section Title", "notes": "..." },
    { "level": 3, "heading": "Subsection", "notes": "..." }
  ]
}
Use ${Math.round(wordCount / 200)} to ${Math.round(wordCount / 150)} H2/H3 headings appropriate for a ${wordCount}-word article.`;

    const userPrompt = `Topic: ${topic}
Focus keyword: ${focusKeyword || topic}
${advancedSettings?.domain ? `Site domain: ${advancedSettings.domain}` : ""}
${advancedSettings?.siteAbout ? `Site about: ${advancedSettings.siteAbout}` : ""}

WRITING TONE: ${tone}
TARGET AUDIENCE: ${targetAudience}
Structure the outline to match the specified tone and audience level. Choose section topics and depth appropriate for this audience.

Generate a well-structured SEO outline.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const raw = completion.choices[0].message.content || "{}";
    let parsed: {
      title?: string;
      outline?: Array<{ level: number; heading: string; notes?: string }>;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse outline response" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      title: parsed.title || topic,
      outline: parsed.outline || [],
    });
  } catch (error: unknown) {
    logger.error("Failed to generate outline", error);
    return NextResponse.json({ error: "Failed to generate outline" }, { status: 500 });
  } finally {
    await releaseGenerationSlot(supabase, user.id);
  }
}
