import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import OpenAI from "openai";

export const maxDuration = 60;

export interface NewsletterOutput {
  subject: string;
  previewText: string;
  htmlContent: string;
  plainText: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { content, title, keyword, authorName, ctaText, ctaUrl } = await req.json() as {
    content: string;
    title: string;
    keyword?: string;
    authorName?: string;
    ctaText?: string;
    ctaUrl?: string;
  };

  if (!content?.trim() || !title?.trim()) {
    return NextResponse.json({ error: "content and title are required" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const resolvedCtaText = ctaText?.trim() || "Read the full article";
  const excerpt = content.slice(0, 5000);

  const prompt = `You are an expert email marketer and newsletter writer. Create a professional newsletter email from the following article.

Article Title: "${title}"
${keyword ? `Focus Keyword: ${keyword}` : ""}
${authorName ? `Author: ${authorName}` : ""}

Article Content (excerpt):
${excerpt}

Generate a newsletter with:
1. A compelling subject line (max 60 chars, no emojis)
2. A preview text (max 110 chars — shown after subject in inbox)
3. Full HTML email (inline CSS, responsive, works in all email clients)
4. Plain text version

HTML email requirements:
- Max-width 600px, centered, white background, clean typography
- Header with the article title (bold, large)
- ${authorName ? `Byline: "By ${authorName}"` : "No byline"}
- 2–3 engaging paragraphs summarising key insights (NOT a full copy, but a compelling tease)
- Bullet points or numbered list of key takeaways (3–5 items)
- A clear CTA button: "${resolvedCtaText}"${ctaUrl ? ` linking to "${ctaUrl}"` : ""}
- Footer with unsubscribe placeholder text
- Inline CSS only (no <style> tags), so it renders correctly in Gmail/Outlook
- Use system fonts: Arial, Helvetica, sans-serif
- Accent colour: #6366f1 (indigo) for the CTA button and headings

Return ONLY valid JSON with this exact shape:
{
  "subject": "...",
  "previewText": "...",
  "htmlContent": "<!DOCTYPE html>...",
  "plainText": "..."
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  let newsletter: NewsletterOutput;
  try {
    newsletter = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as NewsletterOutput;
  } catch {
    return NextResponse.json({ error: "Failed to parse newsletter content" }, { status: 500 });
  }

  if (!newsletter.subject || !newsletter.htmlContent) {
    return NextResponse.json({ error: "Incomplete newsletter generated" }, { status: 500 });
  }

  return NextResponse.json(newsletter);
}
