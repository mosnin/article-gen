import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import OpenAI from "openai";

export const maxDuration = 60;

export interface SocialRepurpose {
  twitter: {
    thread: string[]; // array of tweets, each ≤280 chars
    singleTweet: string;
  };
  linkedin: {
    post: string; // full LinkedIn post with hook, body, CTA
    headline: string;
  };
  instagram: {
    caption: string;
    hashtags: string[];
  };
  facebook: {
    post: string;
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { content, title, keyword, platforms } = await req.json() as {
    content: string;
    title: string;
    keyword?: string;
    platforms?: ("twitter" | "linkedin" | "instagram" | "facebook")[];
  };

  if (!content?.trim() || !title?.trim()) {
    return NextResponse.json({ error: "content and title are required" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const targetPlatforms = platforms ?? ["twitter", "linkedin", "instagram", "facebook"];

  // Truncate content for the prompt (first 3000 words)
  const excerpt = content.slice(0, 4000);

  const prompt = `You are a social media expert. Repurpose this article into engaging social media content.

Article Title: "${title}"
${keyword ? `Focus Keyword: ${keyword}` : ""}

Article Content (excerpt):
${excerpt}

Create social media content for these platforms: ${targetPlatforms.join(", ")}

Return ONLY valid JSON:
{
  ${targetPlatforms.includes("twitter") ? `"twitter": {
    "thread": [
      "Tweet 1 (hook, max 280 chars, no hashtags)",
      "Tweet 2 (key point, max 280 chars)",
      "Tweet 3 (key point, max 280 chars)",
      "Tweet 4 (key point, max 280 chars)",
      "Tweet 5 (key takeaway, max 280 chars)",
      "Tweet 6 (CTA + link placeholder [LINK], max 280 chars)"
    ],
    "singleTweet": "One powerful tweet under 280 chars with a hook and CTA"
  },` : ""}
  ${targetPlatforms.includes("linkedin") ? `"linkedin": {
    "post": "Full LinkedIn post (150-300 words). Start with a bold hook line. Use line breaks for readability. Include 3-5 key insights as bullet points. End with a question to drive comments. Professional but conversational tone.",
    "headline": "Compelling LinkedIn article headline under 100 chars"
  },` : ""}
  ${targetPlatforms.includes("instagram") ? `"instagram": {
    "caption": "Instagram caption (100-150 words). Engaging, visual storytelling style. End with a call-to-action. No hashtags in caption.",
    "hashtags": ["hashtag1", "hashtag2", ...] (15-20 relevant hashtags without #)
  },` : ""}
  ${targetPlatforms.includes("facebook") ? `"facebook": {
    "post": "Facebook post (80-120 words). Conversational, shareable. Include an interesting stat or hook. End with a question."
  }` : ""}
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8,
    response_format: { type: "json_object" },
  });

  let repurposed: Partial<SocialRepurpose>;
  try {
    repurposed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
  } catch {
    return NextResponse.json({ error: "Failed to parse repurposed content" }, { status: 500 });
  }

  return NextResponse.json(repurposed);
}
