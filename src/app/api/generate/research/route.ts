import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase-server";
import { checkCredits, deductCredit } from "@/lib/credits";
import { acquireGenerationSlot, releaseGenerationSlot } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { analyzeSERP } from "@/lib/serp-analyzer";

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

    const { topic, focusKeyword, tone: rawTone, targetAudience: rawTargetAudience } = await req.json();

    const tone =
      typeof rawTone === "string" && rawTone.length <= 100
        ? rawTone
        : "Informative";
    const targetAudience =
      typeof rawTargetAudience === "string" && rawTargetAudience.length <= 100
        ? rawTargetAudience
        : "General audience";

    // Deduct credit before making OpenAI calls
    if (!creditCheck.isAdmin) {
      const deduction = await deductCredit(supabase, user.id, undefined, "Research generation");
      if (!deduction.success) {
        return NextResponse.json(
          { error: "Insufficient credits" },
          { status: 402 }
        );
      }
    }

    if (!topic) {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    if (typeof topic !== "string" || topic.trim().length === 0) {
      return NextResponse.json({ error: "Topic must be a non-empty string" }, { status: 400 });
    }

    if (topic.length > 300) {
      return NextResponse.json({ error: "Topic must be 300 characters or fewer" }, { status: 400 });
    }

    if (focusKeyword && (typeof focusKeyword !== "string" || focusKeyword.length > 150)) {
      return NextResponse.json({ error: "Focus keyword must be 150 characters or fewer" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured. Please set the OPENAI_API_KEY environment variable in Vercel." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    // Run context organization, research, and SERP analysis in parallel - they're all independent
    const serpPromise = focusKeyword
      ? analyzeSERP(focusKeyword, 5).catch((err) => {
          logger.error("SERP analysis failed (non-fatal)", err);
          return null;
        })
      : Promise.resolve(null);

    const [step1, step2, serpData] = await Promise.all([
      openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an expert content strategist and SEO specialist. Your job is to organize the context and structure for a comprehensive article. Never use em dashes (—) or en dashes (–) in your output; use commas, colons, or parentheses instead.",
          },
          {
            role: "user",
            content: `Organize the context for a comprehensive, SEO-optimized article about: "${topic}"${focusKeyword ? `. The main focus keyword is: "${focusKeyword}"` : ""}.

WRITING TONE: ${tone}
TARGET AUDIENCE: ${targetAudience}
Tailor the content strategy, depth, and angle to match the specified tone and audience sophistication level.

Please provide:
1. The main theme and angle of the article
2. Target audience
3. Key points to cover (at least 8-10 subtopics)
4. The logical flow and structure
5. What questions readers might have
6. Suggested focus keyword if not provided
7. 5 high-intent related keywords

Format your response clearly with labeled sections.`,
          },
        ],
        temperature: 0.7,
      }),
      openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a research assistant. Provide factual, well-sourced information with real URLs to authoritative sources. Include statistics, expert opinions, and recent developments. Never use em dashes (—) or en dashes (–) in your output; use commas, colons, or parentheses instead.",
          },
          {
            role: "user",
            content: `Research and provide approximately 1000 words of factual context about: "${topic}"

TARGET AUDIENCE: ${targetAudience}
Adjust research depth and technical detail to match the audience sophistication level.

Include:
- Current statistics and data points
- Expert opinions and quotes
- Recent developments and trends
- Historical context where relevant
- At least 5 authoritative source URLs (from sites like .gov, .edu, major publications, industry leaders)

Format each fact with its source URL. Make sure all information is accurate and verifiable.`,
          },
        ],
        temperature: 0.5,
      }),
      serpPromise,
    ]);

    const articleContext = step1.choices[0].message.content || "";
    const researchContext = step2.choices[0].message.content || "";

    const serpSection = serpData
      ? `\n\n## SERP Intelligence (Top 5 Ranking Pages)\n- Recommended word count to outrank: ${serpData.recommendedWordCount} words\n- Topics competitors cover: ${serpData.commonTopics.join(", ")}\n- Questions to answer: ${serpData.questionsAnswered.join(" | ")}\n- Top competing domains: ${serpData.topDomains.join(", ")}`
      : "";

    return NextResponse.json({ articleContext, researchContext: researchContext + serpSection });
  } catch (error: unknown) {
    logger.error("Failed to generate research", error);
    return NextResponse.json({ error: "Failed to generate research" }, { status: 500 });
  } finally {
    await releaseGenerationSlot(supabase, user.id);
  }
}
