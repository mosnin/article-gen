import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

const MODEL = "gpt-4.1-mini";

interface GenerationResult {
  title: string;
  metaDescription: string;
  slug: string;
  focusKeyword: string;
  keywords: string[];
  article: string;
  imagePrompts: {
    type: string;
    prompt: string;
    altText: string;
  }[];
}

export async function POST(req: NextRequest) {
  try {
    const { topic, focusKeyword } = await req.json();

    if (!topic) {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured. Please set the OPENAI_API_KEY environment variable in Vercel." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    // Step 1: Organize the context of the article
    const step1 = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an expert content strategist and SEO specialist. Your job is to organize the context and structure for a comprehensive article.",
        },
        {
          role: "user",
          content: `Organize the context for a comprehensive, SEO-optimized article about: "${topic}"${focusKeyword ? `. The main focus keyword is: "${focusKeyword}"` : ""}.

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
    });

    const articleContext = step1.choices[0].message.content || "";

    // Step 2: Search for factual context using web search
    const step2 = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a research assistant. Provide factual, well-sourced information with real URLs to authoritative sources. Include statistics, expert opinions, and recent developments.",
        },
        {
          role: "user",
          content: `Research and provide approximately 1000 words of factual context about: "${topic}"

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
    });

    const researchContext = step2.choices[0].message.content || "";

    // Step 3: Generate title, meta description, slug, and keywords
    const step3 = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an SEO expert specializing in content optimization. Generate highly optimized metadata for articles.",
        },
        {
          role: "user",
          content: `Based on this article context and research, generate optimized metadata.

ARTICLE CONTEXT:
${articleContext}

RESEARCH:
${researchContext}

TOPIC: ${topic}
${focusKeyword ? `PREFERRED FOCUS KEYWORD: ${focusKeyword}` : ""}

Generate the following in EXACTLY this JSON format (no markdown, no code blocks, just raw JSON):
{
  "title": "An SEO-optimized title (50-60 characters) that includes the focus keyword",
  "metaDescription": "A compelling meta description (150-160 characters) with the focus keyword",
  "slug": "url-friendly-slug-with-keyword",
  "focusKeyword": "the main focus keyword",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

The 5 keywords should be high-intent keywords related to the topic. They should be terms people actively search for when looking to take action.`,
        },
      ],
      temperature: 0.5,
    });

    let metadata: {
      title: string;
      metaDescription: string;
      slug: string;
      focusKeyword: string;
      keywords: string[];
    };

    try {
      const raw = step3.choices[0].message.content || "{}";
      const cleaned = raw.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
      metadata = JSON.parse(cleaned);
    } catch {
      metadata = {
        title: topic,
        metaDescription: `Learn everything about ${topic}`,
        slug: topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        focusKeyword: focusKeyword || topic,
        keywords: [],
      };
    }

    const allKeywords = [metadata.focusKeyword, ...metadata.keywords];

    // Step 4: Generate the full 4000-word article
    const step4 = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are an expert SEO content writer who creates highly optimized, engaging, and comprehensive articles. You write in a professional yet accessible tone. You always produce content ready for WordPress.`,
        },
        {
          role: "user",
          content: `Write a comprehensive, SEO-optimized article of approximately 4000 words.

TITLE: ${metadata.title}
META DESCRIPTION: ${metadata.metaDescription}
FOCUS KEYWORD: ${metadata.focusKeyword}
ALL KEYWORDS (aim for combined 2% keyword density across all): ${allKeywords.join(", ")}

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
9. Maintain a combined 2% keyword density across all keywords: ${allKeywords.join(", ")}
10. Use markdown formatting throughout (H1 #, H2 ##, H3 ###, bold, italic, lists, links)
11. Write approximately 4000 words - this is critical, do not write less
12. Make the content engaging, informative, and actionable
13. Use short paragraphs (2-3 sentences max) for readability
14. Include bullet points and numbered lists where appropriate

The output should be pure markdown that can be directly pasted into a WordPress code editor.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 10000,
    });

    const article = step4.choices[0].message.content || "";

    // Step 5: Generate Midjourney image prompts
    const step5 = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an expert at creating Midjourney image prompts that produce stunning, professional images suitable for blog articles.",
        },
        {
          role: "user",
          content: `Generate 4 Midjourney image prompts for an article about: "${topic}"
Title: ${metadata.title}
Focus Keyword: ${metadata.focusKeyword}
Keywords: ${allKeywords.join(", ")}

Generate EXACTLY this JSON format (no markdown, no code blocks, just raw JSON):
{
  "images": [
    {
      "type": "Featured Image",
      "prompt": "A detailed Midjourney prompt for a hero/featured image that captures the essence of the article. Include style, lighting, composition details. End with --ar 16:9 --v 6",
      "altText": "Descriptive alt text that naturally includes relevant keywords from: ${allKeywords.join(", ")}"
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
    });

    let imagePrompts: { type: string; prompt: string; altText: string }[] = [];
    try {
      const raw = step5.choices[0].message.content || "{}";
      const cleaned = raw.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      imagePrompts = parsed.images || [];
    } catch {
      imagePrompts = [
        {
          type: "Featured Image",
          prompt: `Professional photograph related to ${topic}, high quality, editorial style --ar 16:9 --v 6`,
          altText: `${metadata.focusKeyword} featured image`,
        },
      ];
    }

    const result: GenerationResult = {
      title: metadata.title,
      metaDescription: metadata.metaDescription,
      slug: metadata.slug,
      focusKeyword: metadata.focusKeyword,
      keywords: metadata.keywords,
      article,
      imagePrompts,
    };

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";

    if (message.includes("API key") || message.includes("auth")) {
      return NextResponse.json(
        { error: "Invalid API key. Please check your OpenAI API key." },
        { status: 401 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
