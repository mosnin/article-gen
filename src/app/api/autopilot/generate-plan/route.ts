import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import OpenAI from "openai";

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface AutopilotSlot {
  id: string;
  day: number;
  date: string;
  keyword: string;
  topic: string;
  contentType: string;
  status: "pending" | "approved" | "rejected" | "generating" | "done" | "failed";
  articleId: string | null;
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

  const competitorContext = competitors?.length
    ? `\nCompetitors in this space: ${competitors.slice(0, 5).join(", ")}`
    : "";

  const audienceContext = targetAudience
    ? `\nTarget audience: ${targetAudience}`
    : "";

  const prompt = `You are an expert SEO content strategist. Generate a ${count}-day content plan for the following business.

Niche: ${niche}${audienceContext}${competitorContext}

Create ${count} unique, high-value blog article ideas that:
1. Target different long-tail keywords (2-5 words each)
2. Cover a mix of content types (How-to Guides, Listicles, Comparisons, Case Studies, Reviews, Tutorials)
3. Progress logically — start with foundational topics, build to advanced, then include comparisons and listicles
4. Target keywords with realistic ranking potential (not ultra-competitive head terms)
5. Each keyword should be distinct — no overlap or repetition

Respond ONLY with a valid JSON array of ${count} objects:
[
  {
    "keyword": "exact target keyword (2-5 words)",
    "topic": "Full article title (compelling, SEO-optimized, 50-70 chars)",
    "contentType": "How-to Guide" | "Listicle" | "Comparison" | "Case Study" | "Review" | "Tutorial" | "Ultimate Guide"
  }
]`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  let items: Array<{ keyword: string; topic: string; contentType: string }>;
  try {
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    // Handle both {"articles": [...]} and direct array wrapped in object
    items = Array.isArray(parsed) ? parsed : (parsed.articles ?? parsed.plan ?? parsed.items ?? Object.values(parsed)[0]);
    if (!Array.isArray(items)) throw new Error("Unexpected format");
  } catch {
    return NextResponse.json({ error: "Failed to parse plan from AI" }, { status: 500 });
  }

  const base = startDate ? new Date(startDate) : new Date();
  base.setHours(0, 0, 0, 0);

  const slots: AutopilotSlot[] = items.slice(0, count).map((item, i) => {
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
    };
  });

  // Persist to user_settings
  await supabase
    .from("user_settings")
    .upsert({
      user_id: user.id,
      autopilot_plan: slots,
      autopilot_niche: niche,
      autopilot_last_generated: new Date().toISOString(),
    }, { onConflict: "user_id" });

  return NextResponse.json({ slots });
}
