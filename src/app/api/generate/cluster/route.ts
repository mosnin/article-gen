import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase-server";
import { acquireGenerationSlot, releaseGenerationSlot } from "@/lib/rate-limit";
import { checkCredits, deductCredit } from "@/lib/credits";
import { deduplicateWithinPlan } from "@/lib/content-dedup";
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
    const creditCheck = await checkCredits(supabase, user.id);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { error: "Insufficient credits. Please upgrade your plan or wait for your monthly reset." },
        { status: 403 }
      );
    }

    const { pillarTopic, pillarKeyword, count, tone: rawTone, targetAudience: rawTargetAudience } = await req.json();

    const tone =
      typeof rawTone === "string" && rawTone.length <= 100
        ? rawTone
        : "Informative";
    const targetAudience =
      typeof rawTargetAudience === "string" && rawTargetAudience.length <= 100
        ? rawTargetAudience
        : "General audience";

    if (!pillarTopic) {
      return NextResponse.json(
        { error: "Missing pillar topic" },
        { status: 400 }
      );
    }

    if (typeof pillarTopic !== "string" || pillarTopic.length > 300) {
      return NextResponse.json({ error: "Pillar topic must be 300 characters or fewer" }, { status: 400 });
    }

    // Deduct credit before making OpenAI calls
    if (!creditCheck.isAdmin) {
      const deduction = await deductCredit(supabase, user.id, undefined, "Cluster generation");
      if (!deduction.success) {
        return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
      }
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
            "You are an expert SEO content strategist specializing in topic cluster strategy and topical authority building. You design comprehensive content clusters that follow hub-and-spoke models for maximum SEO impact. Never use em dashes (—) or en dashes (–) in any concept, keyword, or text you produce; use commas, colons, or parentheses instead. You must respond with valid JSON only.",
        },
        {
          role: "user",
          content: `Generate exactly ${articleCount} cluster (supporting) article ideas for a topic cluster.

PILLAR PAGE TOPIC: "${pillarTopic}"

WRITING TONE: ${tone}
TARGET AUDIENCE: ${targetAudience}
Generate cluster article ideas that match the specified tone and appeal to the target audience.
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
- Every concept must take a DISTINCT angle: no two concepts may share their main noun phrase, and no concept may be a reworded version of another or of the pillar topic
- Every keyword must be unique across the set; keywords must not be simple plural/singular or reordered variants of each other (their derived URL slugs must all differ)
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

    // Programmatic uniqueness backstop: the prompt demands distinct angles
    // and keywords, but models drift — drop any piece whose keyword or
    // concept overlaps an earlier one too closely (Jaccard on word sets).
    type ClusterIdea = { concept?: string; keyword?: string; relation?: string };
    const ideas = ((parsed.clusterArticles as ClusterIdea[]) || []).filter(
      (a) => a?.concept && a?.keyword,
    );
    const deduped = deduplicateWithinPlan(
      ideas.map((a) => ({ ...a, topic: a.concept as string, keyword: a.keyword as string })),
      0.6,
    ).map(({ topic: _topic, ...rest }) => rest);

    return NextResponse.json({
      clusterArticles: deduped,
      droppedAsDuplicates: ideas.length - deduped.length,
    });
  } catch (error: unknown) {
    logger.error("Failed to generate cluster", error);
    return NextResponse.json({ error: "Failed to generate cluster" }, { status: 500 });
  } finally {
    await releaseGenerationSlot(supabase, user.id);
  }
}
