import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

const MODEL = "gpt-4.1-mini";

export async function POST(req: NextRequest) {
  try {
    const {
      topic,
      articleContext,
      researchContext,
      title,
      metaDescription,
      focusKeyword,
      allKeywords,
    } = await req.json();

    if (!topic || !articleContext || !title || !allKeywords) {
      return NextResponse.json(
        { error: "Missing required fields from metadata phase" },
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

    // Run article and image prompts in parallel
    const [articleResult, imageResult] = await Promise.all([
      openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an expert SEO content writer who creates highly optimized, engaging, and comprehensive articles that follow Google's E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) principles. You write in a natural, human tone - conversational yet professional, as if a real subject-matter expert is speaking to the reader. Vary your sentence structure and length. Avoid robotic or formulaic phrasing. Never use em dashes (—). You always produce content ready for WordPress.",
          },
          {
            role: "user",
            content: `Write a comprehensive, SEO-optimized article of approximately 4000 words.

TITLE: ${title}
META DESCRIPTION: ${metaDescription}
FOCUS KEYWORD: ${focusKeyword}
ALL KEYWORDS (aim for combined 2% keyword density across all): ${(allKeywords as string[]).join(", ")}

RESEARCH CONTEXT:
${researchContext}

ARTICLE STRUCTURE:
${articleContext}

REQUIREMENTS:
1. Start with the title as an H1 heading
2. Below the title put the meta description in italics
3. Write an introduction paragraph with its own descriptive H2 heading (DO NOT use the word "Introduction" - use an engaging, keyword-rich heading instead)
4. Include a Table of Contents after the introduction (use markdown links to headings)
5. Write the main body with H2 and H3 headings covering all the key subtopics
6. Include 3 outbound links to authoritative sources (use real, plausible URLs from the research)
7. Include an FAQ section with at least 5 questions and answers as an H2
8. Write a conclusion paragraph with a descriptive H2 heading that includes the focus keyword (DO NOT use the word "Conclusion")
9. Maintain a combined 2% keyword density across all keywords: ${(allKeywords as string[]).join(", ")}
10. Use markdown formatting throughout (H1 #, H2 ##, H3 ###, bold, italic, lists, links)
11. Write approximately 4000 words - this is critical, do not write less
12. Make the content engaging, informative, and actionable
13. Use short paragraphs (2-3 sentences max) for readability
14. Include bullet points and numbered lists where appropriate
15. Follow E-E-A-T principles throughout: demonstrate first-hand experience, cite expert sources, reference authoritative data, and build trust with specific facts rather than vague claims
16. Write in a natural, humanized tone. Vary sentence length and rhythm. Use contractions, rhetorical questions, and direct address ("you") to sound like a real person, not AI
17. NEVER use em dashes (—) anywhere in the article. Use commas, periods, colons, or parentheses instead
18. Avoid filler phrases like "In today's world", "It's important to note", "In this article we will", "Let's dive in", or similar AI-sounding cliches

The output should be pure markdown that can be directly pasted into a WordPress code editor.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 10000,
      }),
      openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an expert at creating Midjourney image prompts that produce stunning, professional images suitable for blog articles. You must respond with valid JSON only.",
          },
          {
            role: "user",
            content: `Generate 4 Midjourney image prompts for an article about: "${topic}"
Title: ${title}
Focus Keyword: ${focusKeyword}
Keywords: ${(allKeywords as string[]).join(", ")}

Generate EXACTLY this JSON format:
{
  "images": [
    {
      "type": "Featured Image",
      "prompt": "A detailed Midjourney prompt for a hero/featured image that captures the essence of the article. Include style, lighting, composition details. End with --ar 16:9 --v 6",
      "altText": "Descriptive alt text that naturally includes relevant keywords from: ${(allKeywords as string[]).join(", ")}"
    },
    {
      "type": "Article Image 1",
      "prompt": "A detailed Midjourney prompt for an image related to a key section of the article. End with --ar 16:9 --v 6",
      "altText": "Descriptive alt text with keywords"
    },
    {
      "type": "Article Image 2",
      "prompt": "A detailed Midjourney prompt for another section image. End with --ar 16:9 --v 6",
      "altText": "Descriptive alt text with keywords"
    },
    {
      "type": "Article Image 3",
      "prompt": "A detailed Midjourney prompt for another section image. End with --ar 16:9 --v 6",
      "altText": "Descriptive alt text with keywords"
    }
  ]
}

Each prompt should be vivid, specific, and produce professional-quality images. Alt texts must include keywords directly.`,
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    ]);

    const article = articleResult.choices[0].message.content || "";

    let imagePrompts: { type: string; prompt: string; altText: string }[] = [];
    try {
      const raw = imageResult.choices[0].message.content || "{}";
      const parsed = JSON.parse(raw);
      imagePrompts = parsed.images || [];
    } catch {
      imagePrompts = [
        {
          type: "Featured Image",
          prompt: `Professional photograph related to ${topic}, high quality, editorial style --ar 16:9 --v 6`,
          altText: `${focusKeyword} featured image`,
        },
      ];
    }

    return NextResponse.json({ article, imagePrompts });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
