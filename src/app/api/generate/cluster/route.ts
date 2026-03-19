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
    const { pillarTopic, pillarKeyword, count } = await req.json();

    if (!pillarTopic) {
      return NextResponse.json(
        { error: "Missing pillar topic" },
        { status: 400 }
      );
    }

    if (typeof pillarTopic !== "string" || pillarTopic.length > 300) {
      return NextResponse.json({ error: "Pillar topic must be 300 characters or fewer" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const articleCount = Math.min(Math.max(count || 30, 1), 30);

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an expert SEO content strategist specializing in topic cluster strategy and topical authority building. You design comprehensive content clusters that follow hub-and-spoke models for maximum SEO impact. You must respond with valid JSON only.",
        },
        {
          role: "user",
          content: `Generate exactly ${articleCount} cluster (supporting) article ideas for a topic cluster.

PILLAR PAGE TOPIC: "${pillarTopic}"
${pillarKeyword ? `PILLAR FOCUS KEYWORD: "${pillarKeyword}"` : ""}

A topic cluster consists of:
- 1 PILLAR PAGE: A comprehensive, broad article covering the main topic (already defined above)
- ${articleCount} CLUSTER ARTICLES: Supporting articles that each cover a specific subtopic in depth and link back to the pillar page

REQUIREMENTS FOR CLUSTER ARTICLES:
- Each cluster article should cover a specific, narrow subtopic related to the pillar page
- Focus keywords should be long-tail variations or related terms that support the pillar keyword
- Articles should cover different search intents: informational, how-to, comparison, best-of, troubleshooting, beginner guides, advanced tips
- Together, the cluster articles should comprehensively cover all aspects of the pillar topic
- No two cluster articles should target the same keyword or overlap significantly
- Include a mix of: beginner guides, how-to articles, comparisons, listicles, case studies, and deep dives
- Each concept should be specific enough for a focused 2000-4000 word article
- Order them logically: start with foundational/beginner content, then intermediate, then advanced/specialized

Return EXACTLY this JSON format:
{
  "clusterArticles": [
    {
      "concept": "A specific article topic that supports the pillar page",
      "keyword": "long-tail focus keyword for this cluster article",
      "relation": "Brief explanation of how this supports the pillar topic"
    }
  ]
}

Generate exactly ${articleCount} cluster article ideas.`,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content || "{}";
    const parsed = JSON.parse(raw);

    return NextResponse.json({
      clusterArticles: parsed.clusterArticles || [],
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await releaseGenerationSlot(supabase, user.id);
  }
}
