import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase-server";
import { deductCredit } from "@/lib/credits";
import { acquireGenerationSlot, releaseGenerationSlot } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { storeArticleEmbedding } from "@/lib/embeddings";

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

  const sessionId = crypto.randomUUID();

  try {
    const {
      topic,
      articleContext,
      researchContext,
      title,
      metaDescription,
      focusKeyword,
      allKeywords,
      targetWordCount,
      advancedSettings,
      interlinking,
      tone: rawTone,
      targetAudience: rawTargetAudience,
    } = await req.json();

    const tone =
      typeof rawTone === "string" && rawTone.length <= 100
        ? rawTone
        : "Informative";
    const targetAudience =
      typeof rawTargetAudience === "string" && rawTargetAudience.length <= 100
        ? rawTargetAudience
        : "General audience";

    const wordCount = targetWordCount || 4000;
    const settings = advancedSettings || {};
    const today = new Date().toISOString().split("T")[0];
    const links = interlinking || null;

    if (!topic || !articleContext || !title || !allKeywords) {
      return NextResponse.json(
        { error: "Missing required fields from metadata phase" },
        { status: 400 }
      );
    }

    if (typeof topic !== "string" || topic.length > 300) {
      return NextResponse.json({ error: "Topic must be 300 characters or fewer" }, { status: 400 });
    }

    if (typeof title !== "string" || title.length > 200) {
      return NextResponse.json({ error: "Title must be 200 characters or fewer" }, { status: 400 });
    }

    if (!Array.isArray(allKeywords) || allKeywords.length > 20) {
      return NextResponse.json({ error: "Keywords must be an array of 20 items or fewer" }, { status: 400 });
    }
    if (!allKeywords.every((kw: unknown) => typeof kw === "string" && kw.length > 0 && kw.length <= 100)) {
      return NextResponse.json({ error: "Each keyword must be 1–100 characters" }, { status: 400 });
    }

    const targetWordCountNum = typeof targetWordCount === "number" ? targetWordCount : parseInt(targetWordCount, 10);
    if (isNaN(targetWordCountNum) || targetWordCountNum < 500 || targetWordCountNum > 8000) {
      return NextResponse.json({ error: "Target word count must be between 500 and 8000" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    // Run article, image prompts, and schema in parallel
    const [articleResult, imageResult, schemaResult] = await Promise.all([
      openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an expert SEO content writer who creates highly optimized, engaging, and comprehensive articles that follow Google's E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) principles. You write in a natural, human tone - conversational yet professional, as if a real subject-matter expert is speaking to the reader. Vary your sentence structure and length. Avoid robotic or formulaic phrasing. NEVER use em dashes (—) or en dashes (–) under any circumstances; use commas, periods, colons, semicolons, or parentheses instead. You always produce content ready for WordPress.",
          },
          {
            role: "user",
            content: `Write a comprehensive, SEO-optimized article of approximately ${wordCount} words.

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
3. Write an introduction paragraph with its own descriptive H2 heading (DO NOT use the word "Introduction" - use an engaging, keyword-rich heading instead). The intro MUST provide a solid overview of what the article covers and include 2-3 key takeaways or highlights right away so readers immediately see the value. This matches search intent by answering the query upfront. Keep it natural and conversational, not a bullet list of promises.
4. Do NOT include a Table of Contents
5. Write the main body with H2 and H3 headings covering all the key subtopics
6. Include 3 outbound links to authoritative sources (use real, plausible URLs from the research)
7. Include an FAQ section with at least 5 questions and answers as an H2
8. Write a conclusion paragraph with a descriptive H2 heading that includes the focus keyword (DO NOT use the word "Conclusion")
9. Maintain a combined 2% keyword density across all keywords: ${(allKeywords as string[]).join(", ")}
10. Use markdown formatting throughout (H1 #, H2 ##, H3 ###, bold, italic, lists, links)
11. Write approximately ${wordCount} words - this is critical, do not write less
12. Make the content engaging, informative, and actionable
13. Use short paragraphs (2-3 sentences max) for readability
14. Include bullet points and numbered lists where appropriate
15. Follow E-E-A-T principles throughout: demonstrate first-hand experience, cite expert sources, reference authoritative data, and build trust with specific facts rather than vague claims
16. Write in a natural, humanized tone. Vary sentence length and rhythm. Use contractions, rhetorical questions, and direct address ("you") to sound like a real person, not AI
17. ABSOLUTELY NEVER use em dashes (—) or en dashes (–) anywhere in the article under any circumstances. Use commas, periods, colons, semicolons, or parentheses instead. This is a strict formatting rule with zero exceptions.
18. Avoid filler phrases like "In today's world", "It's important to note", "In this article we will", "Let's dive in", or similar AI-sounding cliches

WRITING TONE: ${tone}
TARGET AUDIENCE: ${targetAudience}
Adapt your writing style, vocabulary complexity, and examples to match the specified tone and audience level.
${links ? `
INTERNAL LINKING REQUIREMENTS (CRITICAL - follow these exactly):
${links.pillarUrl ? `- This is a CLUSTER article. You MUST include 2-3 contextual internal links back to the pillar page: [relevant anchor text](${links.pillarUrl})` : ""}
${links.pillarUrl ? `- The pillar page is about: "${links.pillarTopic}". Use natural, keyword-rich anchor text when linking to it (not "click here" or "read more")` : ""}
${links.isPillar && links.clusterUrls?.length ? `- This is the PILLAR page. You MUST include contextual internal links to these cluster articles throughout the content where relevant:
${links.clusterUrls.map((c: { url: string; title: string; keyword: string }) => `  * [${c.keyword}](${c.url}) - about: ${c.title}`).join("\n")}
- Distribute these internal links naturally throughout the article body. Use the cluster article's keyword or a natural variation as anchor text.` : ""}
${links.siblingUrls?.length ? `- Also include 1-2 contextual links to these related cluster articles where naturally relevant:
${links.siblingUrls.map((s: { url: string; title: string; keyword: string }) => `  * [${s.keyword}](${s.url}) - about: ${s.title}`).join("\n")}` : ""}
- All internal links should use descriptive, keyword-rich anchor text
- Place links within the body content naturally, not in a separate "related articles" section
` : ""}
The output should be pure markdown that can be directly pasted into a WordPress code editor.`,
          },
        ],
        temperature: 0.7,
        max_tokens: wordCount <= 2000 ? 5000 : 10000,
      }),
      openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an expert at creating hyper-realistic, cinematic photography prompts for AI image generators. Every prompt you write must look like it describes a real photograph taken by a professional photographer. No illustrations, diagrams, infographics, or abstract art. You must respond with valid JSON only.",
          },
          {
            role: "user",
            content: `Generate 4 photorealistic image prompts for an article about: "${topic}"
Title: ${title}
Focus Keyword: ${focusKeyword}

CRITICAL RULES FOR PROMPTS:
- Every prompt must describe a hyper-realistic, cinematic photograph that looks like it was taken during a real professional photoshoot
- Include specific photography details: camera angle, lens type, lighting setup (golden hour, soft natural light, studio lighting, etc.), depth of field, color grading
- NO diagrams, infographics, illustrations, text overlays, or abstract concepts
- NO customization parameters (do NOT include things like --ar 16:9, --v 6, --style, or any flags)
- The scenes should be realistic and grounded - things that could actually be photographed in real life
- Think editorial photography, documentary style, lifestyle shoots, product photography, or cinematic stills

CRITICAL RULES FOR ALT TEXTS:
- Every alt text MUST contain the exact focus keyword "${focusKeyword}" verbatim
- The alt text should naturally describe the image while incorporating the focus keyword

Generate EXACTLY this JSON format:
{
  "images": [
    {
      "type": "Featured Image",
      "prompt": "A hyper-realistic cinematic photograph that captures the essence of the article topic. Describe the scene, subjects, lighting, camera angle, lens, and mood as if directing a real photoshoot",
      "altText": "Descriptive alt text that includes the exact focus keyword: ${focusKeyword}"
    },
    {
      "type": "Article Image 1",
      "prompt": "A photorealistic shot related to a key aspect of the article. Describe real-world scene with professional photography details",
      "altText": "Descriptive alt text that includes the exact focus keyword: ${focusKeyword}"
    },
    {
      "type": "Article Image 2",
      "prompt": "Another realistic photograph related to the article. Different scene, angle, or subject but still connected to the topic",
      "altText": "Descriptive alt text that includes the exact focus keyword: ${focusKeyword}"
    },
    {
      "type": "Article Image 3",
      "prompt": "A cinematic still photograph related to the article. Focus on a specific detail or moment that a real photographer would capture",
      "altText": "Descriptive alt text that includes the exact focus keyword: ${focusKeyword}"
    }
  ]
}

Each prompt must read like a brief for a professional photographer. Alt texts must contain "${focusKeyword}" exactly as written.`,
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
      openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an expert in SEO structured data and Schema.org markup. You generate optimized JSON-LD schema that maximizes rich snippet eligibility in Google Search. You must respond with valid JSON only.",
          },
          {
            role: "user",
            content: `Generate a comprehensive JSON-LD schema for an article with these details:

Title: ${title}
Meta Description: ${metaDescription}
Focus Keyword: ${focusKeyword}
Keywords: ${(allKeywords as string[]).join(", ")}
Topic: ${topic}
Date Published: ${today}
Date Modified: ${today}
${settings.domain ? `Website Domain: ${settings.domain}` : ""}
${settings.siteName ? `Site/Publisher Name: ${settings.siteName}` : ""}
${settings.siteAbout ? `About the Site: ${settings.siteAbout}` : ""}
${settings.authorName ? `Author Name: ${settings.authorName}` : ""}
${settings.authorAbout ? `About the Author: ${settings.authorAbout}` : ""}

Generate a JSON object with a single "schema" key containing the JSON-LD script content (NOT wrapped in a script tag, just the JSON object itself).

REQUIREMENTS:
- Use @type "Article" as the primary type
- Include these properties: headline, description, keywords, author (@type Person with name ${settings.authorName ? `"${settings.authorName}"` : 'placeholder "[Author Name]"'}${settings.authorAbout ? `, description "${settings.authorAbout}"` : ""}), datePublished "${today}", dateModified "${today}", publisher (@type Organization with name ${settings.siteName ? `"${settings.siteName}"` : 'placeholder "[Site Name]"'}${settings.siteAbout ? `, description "${settings.siteAbout}"` : ""}), mainEntityOfPage, image (placeholder "[Featured Image URL]")
- Add an FAQPage schema as a secondary @graph item since the article contains an FAQ section. Include 3-5 FAQ entries based on the topic with realistic questions and short answers
- Optimize for Google rich snippets: featured snippets, FAQ rich results, and article rich results
- Use "${settings.domain ? `${settings.domain.replace(/\/$/, "")}/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : `https://www.example.com/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}" as the article URL
- All values should be SEO-optimized for the focus keyword "${focusKeyword}"

Return format:
{
  "schema": { ... the complete JSON-LD object ... }
}`,
          },
        ],
        temperature: 0.5,
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
          prompt: `Hyper-realistic cinematic photograph related to ${topic}, shot with a 50mm lens, soft natural lighting, shallow depth of field, editorial style, color graded`,
          altText: `${focusKeyword} - professional editorial photograph`,
        },
      ];
    }

    let schema = "";
    try {
      const rawSchema = schemaResult.choices[0].message.content || "{}";
      const parsedSchema = JSON.parse(rawSchema);
      schema = JSON.stringify(parsedSchema.schema || parsedSchema, null, 2);
    } catch {
      schema = "";
    }

    // Deduct 1 credit on successful generation
    const deductResult = await deductCredit(supabase, user.id, undefined, `Article: ${topic}`);

    // Fire-and-forget: store embedding for dedup checks
    storeArticleEmbedding({
      userId: user.id,
      autopilotSlotId: sessionId,
      title: title,
      keyword: focusKeyword,
      keywords: allKeywords as string[],
      topic: topic,
    }).catch((err) => console.warn("[article] Embedding storage failed:", err));

    return NextResponse.json({ article, imagePrompts, schema, credits: deductResult.credits });
  } catch (error: unknown) {
    logger.error("Failed to generate article", error);
    return NextResponse.json({ error: "Failed to generate article" }, { status: 500 });
  } finally {
    await releaseGenerationSlot(supabase, user.id);
  }
}
