import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

const MODEL = "gpt-4.1-mini";

export async function POST(req: NextRequest) {
  try {
    const { niche, count } = await req.json();

    if (!niche) {
      return NextResponse.json(
        { error: "Missing niche field" },
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
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
