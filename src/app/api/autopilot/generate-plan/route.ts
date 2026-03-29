import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import OpenAI from "openai";
import { researchNicheContent, findContentGaps } from "@/lib/exa";
import { batchCheckUniqueness } from "@/lib/embeddings";
import { deduplicateWithinPlan, extractCoveredTopics } from "@/lib/content-dedup";

export const maxDuration = 120;

const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface AutopilotSlot {
  id: string;
  day: number;
  date: string;
  keyword: string;
  topic: string;
  contentType: string;
  status: "pending" | "approved" | "rejected" | "generating" | "done" | "failed";
  articleId: string | null;
  uniquenessScore: number;       // 0–1, 1 = fully unique, <0.85 = likely cannibalization
  cannibalizesTitle: string | null;
  cannibalizesKeyword: string | null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { niche, targetAudience, competitors, startDate, count = 30 } = await req.json() as {
    niche: string;
    targetAudience?: string;
    competitors?: string[];
    startDate?: string;
    count?: number;
  };

  if (!niche) return NextResponse.json({ error: "Niche is required" }, { status: 400 });

  // ── Step 1: Exa research (non-blocking, fail gracefully) ──────────────────
  let coveredTopics: string[] = [];
  let gapInsights: string[] = [];

  try {
    const [trending, gaps] = await Promise.all([
      researchNicheContent(niche, { numResults: 20, competitors }),
      findContentGaps(niche, 15),
    ]);
    coveredTopics = extractCoveredTopics(trending);
    gapInsights = gaps.slice(0, 10).map((g) => g.title).filter(Boolean);
  } catch (err) {
    console.warn("[generate-plan] Exa research failed, continuing without it:", err);
  }

  // ── Step 2: Build enriched GPT prompt ────────────────────────────────────
  const competitorContext = competitors?.length
    ? `\nCompetitors in this space: ${competitors.slice(0, 5).join(", ")}`
    : "";
  const audienceContext = targetAudience
    ? `\nTarget audience: ${targetAudience}`
    : "";
  const coveredContext = coveredTopics.length
    ? `\n\nThe following topics are ALREADY HEAVILY COVERED online — do NOT suggest these or very similar titles:\n${coveredTopics.slice(0, 20).map((t, i) => `${i + 1}. ${t}`).join("\n")}`
    : "";
  const gapContext = gapInsights.length
    ? `\n\nContent GAP opportunities (underserved topics — prioritize these angles):\n${gapInsights.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
    : "";

  const prompt = `You are an expert SEO content strategist. Generate a ${count}-day content plan for the following business.

Niche: ${niche}${audienceContext}${competitorContext}${coveredContext}${gapContext}

Create ${count} unique, high-value blog article ideas that:
1. Target different long-tail keywords (2-5 words each)
2. Cover a mix of content types (How-to Guides, Listicles, Comparisons, Case Studies, Reviews, Tutorials)
3. Progress logically — start with foundational topics, build to advanced, then include comparisons and listicles
4. Target keywords with realistic ranking potential (not ultra-competitive head terms)
5. Each keyword must be completely distinct — NO overlap or repetition
6. AVOID any topic already heavily covered above
7. PRIORITIZE the content gap opportunities listed above

Respond ONLY with a valid JSON object with key "articles" containing an array of ${count} objects:
{
  "articles": [
    {
      "keyword": "exact target keyword (2-5 words)",
      "topic": "Full article title (compelling, SEO-optimized, 50-70 chars)",
      "contentType": "How-to Guide" | "Listicle" | "Comparison" | "Case Study" | "Review" | "Tutorial" | "Ultimate Guide"
    }
  ]
}`;

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  let rawItems: Array<{ keyword: string; topic: string; contentType: string }>;
  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    rawItems = parsed.articles ?? parsed.plan ?? parsed.items ?? (Array.isArray(parsed) ? parsed : Object.values(parsed)[0]);
    if (!Array.isArray(rawItems)) throw new Error("Unexpected format");
  } catch {
    return NextResponse.json({ error: "Failed to parse plan from AI" }, { status: 500 });
  }

  // ── Step 3: Intra-plan dedup (keyword overlap) ────────────────────────────
  const dedupedItems = deduplicateWithinPlan(rawItems.slice(0, count * 2), 0.35).slice(0, count);

  // ── Step 4: Vector uniqueness check vs existing user articles ─────────────
  let uniquenessResults = dedupedItems.map((item) => ({
    ...item,
    uniquenessScore: 1 as number,
    cannibalizesTitle: null as string | null,
    cannibalizesKeyword: null as string | null,
  }));

  try {
    const checked = await batchCheckUniqueness({
      userId: user.id,
      topics: dedupedItems,
      threshold: 0.82,
    });
    uniquenessResults = checked;
  } catch (err) {
    console.warn("[generate-plan] Vector uniqueness check failed, continuing:", err);
  }

  // ── Step 5: Build slots ───────────────────────────────────────────────────
  const base = startDate ? new Date(startDate) : new Date();
  base.setHours(0, 0, 0, 0);

  const slots: AutopilotSlot[] = uniquenessResults.slice(0, count).map((item, i) => {
    const date = new Date(base);
    date.setDate(base.getDate() + i);
    return {
      id: crypto.randomUUID(),
      day: i + 1,
      date: date.toISOString().split("T")[0],
      keyword: item.keyword,
      topic: item.topic,
      contentType: item.contentType,
      status: "pending",
      articleId: null,
      uniquenessScore: item.uniquenessScore,
      cannibalizesTitle: item.cannibalizesTitle,
      cannibalizesKeyword: item.cannibalizesKeyword,
    };
  });

  // ── Step 6: Persist ───────────────────────────────────────────────────────
  await supabase
    .from("user_settings")
    .upsert({
      user_id: user.id,
      autopilot_plan: slots,
      autopilot_niche: niche,
      autopilot_last_generated: new Date().toISOString(),
    }, { onConflict: "user_id" });

  return NextResponse.json({ slots, exaResearched: coveredTopics.length > 0 });
}
