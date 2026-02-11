// Supabase Edge Function: process-schedules
// Runs on a cron schedule (every 5 minutes) via pg_cron + pg_net
// Picks up pending scheduled articles, generates them via OpenAI, and optionally publishes to WordPress

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const OPENAI_MODEL = "gpt-4.1-mini";
const IMAGE_MODEL = "gpt-image-1-mini";
const MAX_PER_RUN = 2; // Process at most 2 articles per invocation to stay within timeout

interface WpBlog {
  id: string;
  name: string;
  url: string;
  username: string;
  appPassword: string;
  authorName?: string;
  authorAbout?: string;
}

interface ScheduledArticle {
  id: string;
  user_id: string;
  topic: string;
  focus_keyword: string;
  quality: string;
  generate_images: boolean;
  auto_publish: boolean;
  publish_status: string;
  wp_blog_id: string | null;
  category_ids: number[];
  recurrence: string;
  recurrence_day: number | null;
  scheduled_for: string;
  attempts: number;
}

interface ImagePromptItem {
  type: string;
  prompt: string;
  altText: string;
}

interface GeneratedImage {
  type: string;
  altText: string;
  storagePath: string | null;
  publicUrl: string | null;
  success: boolean;
}

// --- OpenAI helpers ---

async function openaiChat(
  apiKey: string,
  messages: { role: string; content: string }[],
  options: { temperature?: number; responseFormat?: boolean; maxTokens?: number } = {}
): Promise<string> {
  const body: Record<string, unknown> = {
    model: OPENAI_MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
  };
  if (options.responseFormat) body.response_format = { type: "json_object" };
  if (options.maxTokens) body.max_tokens = options.maxTokens;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function openaiImage(apiKey: string, prompt: string): Promise<string | null> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      size: "1536x1024",
      quality: "medium",
      response_format: "b64_json",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.[0]?.b64_json || null;
}

// --- Generation pipeline (mirrors the existing Vercel routes) ---

async function generateArticle(
  apiKey: string,
  topic: string,
  focusKeyword: string,
  quality: string,
  settings: { domain?: string; siteName?: string; siteAbout?: string; authorName?: string; authorAbout?: string }
) {
  // Step 1: Research (2 parallel calls)
  const [articleContext, researchContext] = await Promise.all([
    openaiChat(apiKey, [
      { role: "system", content: "You are an expert content strategist and SEO specialist. Your job is to organize the context and structure for a comprehensive article." },
      { role: "user", content: `Organize the context for a comprehensive, SEO-optimized article about: "${topic}"${focusKeyword ? `. The main focus keyword is: "${focusKeyword}"` : ""}.

Please provide:
1. The main theme and angle of the article
2. Target audience
3. Key points to cover (at least 8-10 subtopics)
4. The logical flow and structure
5. What questions readers might have
6. Suggested focus keyword if not provided
7. 5 high-intent related keywords

Format your response clearly with labeled sections.` },
    ]),
    openaiChat(apiKey, [
      { role: "system", content: "You are a research assistant. Provide factual, well-sourced information with real URLs to authoritative sources. Include statistics, expert opinions, and recent developments." },
      { role: "user", content: `Research and provide approximately 1000 words of factual context about: "${topic}"

Include:
- Current statistics and data points
- Expert opinions and quotes
- Recent developments and trends
- Historical context where relevant
- At least 5 authoritative source URLs (from sites like .gov, .edu, major publications, industry leaders)

Format each fact with its source URL. Make sure all information is accurate and verifiable.` },
    ], { temperature: 0.5 }),
  ]);

  // Step 2: Metadata
  const metadataRaw = await openaiChat(apiKey, [
    { role: "system", content: "You are an SEO expert specializing in content optimization. Generate highly optimized metadata for articles. You must respond with valid JSON only." },
    { role: "user", content: `Based on this article context and research, generate optimized metadata.

ARTICLE CONTEXT:
${articleContext}

RESEARCH:
${researchContext}

TOPIC: ${topic}
${focusKeyword ? `PREFERRED FOCUS KEYWORD: ${focusKeyword}` : ""}

Generate the following in EXACTLY this JSON format:
{
  "title": "An SEO-optimized title (50-60 characters) that includes the focus keyword",
  "metaDescription": "A compelling meta description (150-160 characters) with the focus keyword",
  "slug": "url-friendly-slug-with-keyword",
  "focusKeyword": "the main focus keyword",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

The 5 keywords should be high-intent keywords related to the topic.` },
  ], { temperature: 0.5, responseFormat: true });

  let metadata: { title: string; metaDescription: string; slug: string; focusKeyword: string; keywords: string[] };
  try {
    const parsed = JSON.parse(metadataRaw);
    const resolvedKeyword = parsed.focusKeyword || focusKeyword || topic;
    const keywordSlug = resolvedKeyword.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    metadata = {
      title: parsed.title || topic,
      metaDescription: parsed.metaDescription || `Learn everything about ${topic}`,
      slug: keywordSlug,
      focusKeyword: resolvedKeyword,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    };
  } catch {
    const fallbackKeyword = focusKeyword || topic;
    metadata = {
      title: topic,
      metaDescription: `Learn everything about ${topic}`,
      slug: fallbackKeyword.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      focusKeyword: fallbackKeyword,
      keywords: [],
    };
  }

  // Step 3: Article + Image prompts + Schema (parallel)
  const allKeywords = [metadata.focusKeyword, ...metadata.keywords];
  const targetWordCount = quality === "standard" ? 2000 : 4000;
  const today = new Date().toISOString().split("T")[0];

  const [articleMd, imagePromptsRaw, schemaRaw] = await Promise.all([
    openaiChat(apiKey, [
      { role: "system", content: "You are an expert SEO content writer who creates highly optimized, engaging, and comprehensive articles that follow Google's E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) principles. You write in a natural, human tone - conversational yet professional, as if a real subject-matter expert is speaking to the reader. Vary your sentence structure and length. Avoid robotic or formulaic phrasing. NEVER use em dashes (—) or en dashes (–) under any circumstances; use commas, periods, colons, semicolons, or parentheses instead. You always produce content ready for WordPress." },
      { role: "user", content: `Write a comprehensive, SEO-optimized article of approximately ${targetWordCount} words.

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
3. Write an introduction paragraph with its own descriptive H2 heading (DO NOT use the word "Introduction" - use an engaging, keyword-rich heading instead). The intro MUST provide a solid overview of what the article covers and include 2-3 key takeaways or highlights right away so readers immediately see the value.
4. Do NOT include a Table of Contents
5. Write the main body with H2 and H3 headings covering all the key subtopics
6. Include 3 outbound links to authoritative sources (use real, plausible URLs from the research)
7. Include an FAQ section with at least 5 questions and answers as an H2
8. Write a conclusion paragraph with a descriptive H2 heading that includes the focus keyword (DO NOT use the word "Conclusion")
9. Maintain a combined 2% keyword density across all keywords: ${allKeywords.join(", ")}
10. Use markdown formatting throughout (H1 #, H2 ##, H3 ###, bold, italic, lists, links)
11. Write approximately ${targetWordCount} words - this is critical, do not write less
12. Make the content engaging, informative, and actionable
13. Use short paragraphs (2-3 sentences max) for readability
14. Include bullet points and numbered lists where appropriate
15. Follow E-E-A-T principles throughout
16. Write in a natural, humanized tone. Vary sentence length and rhythm.
17. ABSOLUTELY NEVER use em dashes or en dashes anywhere in the article.
18. Avoid filler phrases like "In today's world", "It's important to note", "In this article we will", "Let's dive in"
${settings.authorName ? `\nAUTHOR: ${settings.authorName}${settings.authorAbout ? ` - ${settings.authorAbout}` : ""}` : ""}
${settings.siteName ? `SITE: ${settings.siteName}` : ""}

The output should be pure markdown that can be directly pasted into a WordPress code editor.` },
    ], { maxTokens: targetWordCount <= 2000 ? 5000 : 10000 }),

    openaiChat(apiKey, [
      { role: "system", content: "You are an expert at creating hyper-realistic, cinematic photography prompts for AI image generators. Every prompt you write must look like it describes a real photograph taken by a professional photographer. No illustrations, diagrams, infographics, or abstract art. You must respond with valid JSON only." },
      { role: "user", content: `Generate 4 photorealistic image prompts for an article about: "${topic}"
Title: ${metadata.title}
Focus Keyword: ${metadata.focusKeyword}

CRITICAL RULES FOR PROMPTS:
- Every prompt must describe a hyper-realistic, cinematic photograph
- Include specific photography details: camera angle, lens type, lighting setup, depth of field, color grading
- NO diagrams, infographics, illustrations, text overlays, or abstract concepts
- NO customization parameters (do NOT include things like --ar 16:9, --v 6, --style, or any flags)

CRITICAL RULES FOR ALT TEXTS:
- Every alt text MUST contain the exact focus keyword "${metadata.focusKeyword}" verbatim

Generate EXACTLY this JSON format:
{
  "images": [
    { "type": "Featured Image", "prompt": "...", "altText": "..." },
    { "type": "Article Image 1", "prompt": "...", "altText": "..." },
    { "type": "Article Image 2", "prompt": "...", "altText": "..." },
    { "type": "Article Image 3", "prompt": "...", "altText": "..." }
  ]
}` },
    ], { responseFormat: true }),

    openaiChat(apiKey, [
      { role: "system", content: "You are an expert in SEO structured data and Schema.org markup. You generate optimized JSON-LD schema that maximizes rich snippet eligibility in Google Search. You must respond with valid JSON only." },
      { role: "user", content: `Generate a comprehensive JSON-LD schema for an article with these details:

Title: ${metadata.title}
Meta Description: ${metadata.metaDescription}
Focus Keyword: ${metadata.focusKeyword}
Keywords: ${allKeywords.join(", ")}
Topic: ${topic}
Date Published: ${today}
Date Modified: ${today}
${settings.domain ? `Website Domain: ${settings.domain}` : ""}
${settings.siteName ? `Site/Publisher Name: ${settings.siteName}` : ""}
${settings.authorName ? `Author Name: ${settings.authorName}` : ""}

Generate a JSON object with a single "schema" key containing the JSON-LD object.
Use @type "Article" as the primary type. Include FAQPage schema as secondary @graph item.

Return format: { "schema": { ... } }` },
    ], { temperature: 0.5, responseFormat: true }),
  ]);

  let imagePrompts: ImagePromptItem[] = [];
  try {
    const parsed = JSON.parse(imagePromptsRaw);
    imagePrompts = parsed.images || [];
  } catch {
    imagePrompts = [{
      type: "Featured Image",
      prompt: `Hyper-realistic cinematic photograph related to ${topic}, shot with a 50mm lens, soft natural lighting, shallow depth of field`,
      altText: `${metadata.focusKeyword} - professional editorial photograph`,
    }];
  }

  let schema = "";
  try {
    const parsed = JSON.parse(schemaRaw);
    schema = JSON.stringify(parsed.schema || parsed, null, 2);
  } catch {
    schema = "";
  }

  return { ...metadata, article: articleMd, imagePrompts, schema };
}

// --- Image generation + storage ---

async function generateAndStoreImages(
  apiKey: string,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  articleId: string,
  imagePrompts: ImagePromptItem[]
): Promise<GeneratedImage[]> {
  const images: GeneratedImage[] = [];
  const total = Math.min(imagePrompts.length, 4);

  for (let i = 0; i < total; i++) {
    const img = imagePrompts[i];
    try {
      const b64 = await openaiImage(apiKey, img.prompt);
      if (!b64) {
        images.push({ type: img.type, altText: img.altText, storagePath: null, publicUrl: null, success: false });
        continue;
      }

      // Convert base64 to Uint8Array for storage
      const binaryString = atob(b64);
      const bytes = new Uint8Array(binaryString.length);
      for (let j = 0; j < binaryString.length; j++) {
        bytes[j] = binaryString.charCodeAt(j);
      }

      const filename = i === 0 ? "featured" : `image-${i}`;
      const path = `${userId}/${articleId}/${filename}.png`;

      const { error } = await supabase.storage
        .from("article-images")
        .upload(path, bytes, { contentType: "image/png", upsert: true });

      if (error) {
        images.push({ type: img.type, altText: img.altText, storagePath: null, publicUrl: null, success: false });
        continue;
      }

      const { data: urlData } = supabase.storage.from("article-images").getPublicUrl(path);
      images.push({
        type: img.type,
        altText: img.altText,
        storagePath: path,
        publicUrl: urlData.publicUrl,
        success: true,
      });
    } catch {
      images.push({ type: img.type, altText: img.altText, storagePath: null, publicUrl: null, success: false });
    }
  }

  return images;
}

// --- WordPress publishing ---

async function publishToWordPress(
  wpUrl: string,
  auth: string,
  article: {
    title: string;
    htmlContent: string;
    slug: string;
    metaDescription: string;
    categoryIds: number[];
    generatedImages: GeneratedImage[];
  }
): Promise<{ success: boolean; postUrl?: string; error?: string }> {
  const uploadedImages: { wpMediaId: number; wpUrl: string; altText: string; type: string }[] = [];
  let featuredMediaId: number | null = null;

  // Upload images to WordPress
  const imagesToProcess = article.generatedImages.filter((i) => i.success && i.storagePath);
  for (let i = 0; i < imagesToProcess.length; i++) {
    const img = imagesToProcess[i];
    try {
      // Download from Supabase storage public URL
      const imgRes = await fetch(img.publicUrl!);
      if (!imgRes.ok) continue;
      const imgBuffer = await imgRes.arrayBuffer();

      const filename = `${article.slug}-${i === 0 ? "featured" : `image-${i}`}`;
      const uploadRes = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="${filename}.png"`,
          "User-Agent": "ArticleSauce/1.0",
        },
        body: new Uint8Array(imgBuffer),
      });

      if (uploadRes.ok) {
        const media = await uploadRes.json();
        uploadedImages.push({ wpMediaId: media.id, wpUrl: media.source_url, altText: img.altText, type: img.type });
        if (img.type === "Featured Image") featuredMediaId = media.id;

        // Set alt text
        if (img.altText) {
          await fetch(`${wpUrl}/wp-json/wp/v2/media/${media.id}`, {
            method: "POST",
            headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", "User-Agent": "ArticleSauce/1.0" },
            body: JSON.stringify({ alt_text: img.altText }),
          });
        }
      }
    } catch {
      // Skip failed image uploads
    }
  }

  // Inject inline images into HTML
  let htmlContent = article.htmlContent;
  const inlineImages = uploadedImages.filter((img) => img.type !== "Featured Image");
  if (inlineImages.length > 0) {
    const h2Regex = /<h2[^>]*>/gi;
    const h2Matches: number[] = [];
    let match;
    while ((match = h2Regex.exec(htmlContent)) !== null) {
      h2Matches.push(match.index);
    }
    if (h2Matches.length >= 2) {
      const insertPositions: number[] = [];
      const sectionCount = h2Matches.length - 1;
      const step = Math.max(1, Math.floor(sectionCount / (inlineImages.length + 1)));
      for (let i = 0; i < inlineImages.length && i * step + 1 < h2Matches.length; i++) {
        insertPositions.push(h2Matches[i * step + 1]);
      }
      for (let i = insertPositions.length - 1; i >= 0; i--) {
        if (i < inlineImages.length) {
          const img = inlineImages[i];
          const imgHtml = `\n<figure class="wp-block-image size-large"><img src="${img.wpUrl}" alt="${img.altText.replace(/"/g, "&quot;")}" class="wp-image-${img.wpMediaId}" /><figcaption>${img.altText}</figcaption></figure>\n\n`;
          htmlContent = htmlContent.slice(0, insertPositions[i]) + imgHtml + htmlContent.slice(insertPositions[i]);
        }
      }
    }
  }

  // Create WordPress post
  const postPayload: Record<string, unknown> = {
    title: article.title,
    content: htmlContent,
    slug: article.slug,
    status: "draft",
    excerpt: article.metaDescription,
  };
  if (article.categoryIds.length > 0) postPayload.categories = article.categoryIds;
  if (featuredMediaId) postPayload.featured_media = featuredMediaId;

  const res = await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", "User-Agent": "ArticleSauce/1.0" },
    body: JSON.stringify(postPayload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    return { success: false, error: errData.message || `WordPress error (${res.status})` };
  }

  const post = await res.json();
  return { success: true, postUrl: post.link };
}

// Simple markdown to HTML (for Deno environment without 'marked' library)
function markdownToHtml(md: string): string {
  let html = md;
  // Headings
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Unordered lists
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  // Paragraphs (lines not already wrapped in tags)
  html = html.replace(/^(?!<[hulo]|<li)(.*\S.*)$/gm, "<p>$1</p>");
  // Clean up extra newlines
  html = html.replace(/\n{2,}/g, "\n");
  return html;
}

// --- Main handler ---

Deno.serve(async (req: Request) => {
  // Verify this is called with the service role key or from pg_cron
  const authHeader = req.headers.get("Authorization");
  const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("CRON_SECRET");

  // Allow calls from pg_cron (no auth) or with service role key or cron secret
  const url = new URL(req.url);
  const providedSecret = url.searchParams.get("secret");

  if (authHeader !== `Bearer ${expectedKey}` && providedSecret !== cronSecret) {
    // Also allow if called internally by Supabase (pg_net)
    if (!authHeader?.includes(expectedKey || "")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

  if (!openaiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch pending articles that are due
  const now = new Date().toISOString();
  const { data: pending, error: fetchError } = await supabase
    .from("scheduled_articles")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(MAX_PER_RUN);

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ message: "No pending articles to process", processed: 0 }));
  }

  const results: { id: string; status: string; error?: string }[] = [];

  for (const item of pending as ScheduledArticle[]) {
    // Mark as processing
    await supabase
      .from("scheduled_articles")
      .update({ status: "processing", attempts: item.attempts + 1, updated_at: new Date().toISOString() })
      .eq("id", item.id);

    try {
      // Check credits
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("credits, role")
        .eq("user_id", item.user_id)
        .single();

      if (!profile) throw new Error("User profile not found");

      const isAdmin = profile.role === "admin";
      const creditsNeeded = item.generate_images ? 2 : 1;
      if (!isAdmin && profile.credits < creditsNeeded) {
        throw new Error(`Insufficient credits (need ${creditsNeeded}, have ${profile.credits})`);
      }

      // Get user settings for author info
      const { data: settings } = await supabase
        .from("user_settings")
        .select("domain, site_name, site_about, author_name, author_about, wp_blogs, wp_url, wp_username, wp_app_password")
        .eq("user_id", item.user_id)
        .single();

      // Get blog-specific author info
      const blogs = (settings?.wp_blogs as WpBlog[]) || [];
      const selectedBlog = item.wp_blog_id ? blogs.find((b) => b.id === item.wp_blog_id) : undefined;
      const effectiveSettings = {
        domain: settings?.domain || "",
        siteName: settings?.site_name || "",
        siteAbout: settings?.site_about || "",
        authorName: selectedBlog?.authorName || settings?.author_name || "",
        authorAbout: selectedBlog?.authorAbout || settings?.author_about || "",
      };

      // Generate article
      const result = await generateArticle(
        openaiKey,
        item.topic,
        item.focus_keyword,
        item.quality,
        effectiveSettings
      );

      // Generate a UUID for the article
      const articleId = crypto.randomUUID();

      // Generate images if requested
      let generatedImages: GeneratedImage[] = [];
      if (item.generate_images && result.imagePrompts.length > 0) {
        generatedImages = await generateAndStoreImages(openaiKey, supabase, item.user_id, articleId, result.imagePrompts);
      }

      // Save article to DB (using service role, bypasses RLS)
      const { error: insertError } = await supabase
        .from("articles")
        .insert({
          id: articleId,
          user_id: item.user_id,
          topic: item.topic,
          focus_keyword: result.focusKeyword,
          quality: item.quality,
          title: result.title,
          meta_description: result.metaDescription,
          slug: result.slug,
          keywords: result.keywords,
          article_markdown: result.article,
          image_prompts: result.imagePrompts,
          generated_images: generatedImages.filter((i) => i.success),
          schema_json: result.schema,
          posted: false,
          wp_blog_id: item.wp_blog_id,
        });

      if (insertError) throw new Error(`Failed to save article: ${insertError.message}`);

      // Deduct credits
      if (!isAdmin) {
        const newCredits = profile.credits - 1;
        await supabase
          .from("user_profiles")
          .update({ credits: newCredits, updated_at: new Date().toISOString() })
          .eq("user_id", item.user_id);

        await supabase.from("credit_transactions").insert({
          user_id: item.user_id,
          amount: -1,
          type: "usage",
          description: `Scheduled article: ${item.topic}`,
          article_id: articleId,
        });

        // Deduct image credit if images were generated
        if (item.generate_images && generatedImages.some((i) => i.success)) {
          await supabase
            .from("user_profiles")
            .update({ credits: newCredits - 1, updated_at: new Date().toISOString() })
            .eq("user_id", item.user_id);

          await supabase.from("credit_transactions").insert({
            user_id: item.user_id,
            amount: -1,
            type: "usage",
            description: "AI image generation (scheduled)",
            article_id: articleId,
          });
        }
      }

      // Auto-publish to WordPress if configured
      let publishResult = null;
      if (item.auto_publish && item.wp_blog_id && settings) {
        const blog = blogs.find((b) => b.id === item.wp_blog_id);
        if (blog?.url && blog?.username && blog?.appPassword) {
          const wpUrl = blog.url.replace(/\/$/, "");
          const auth = btoa(`${blog.username}:${blog.appPassword}`);
          const htmlContent = markdownToHtml(result.article);

          publishResult = await publishToWordPress(wpUrl, auth, {
            title: result.title,
            htmlContent,
            slug: result.slug,
            metaDescription: result.metaDescription,
            categoryIds: item.category_ids || [],
            generatedImages,
          });

          if (publishResult.success) {
            await supabase
              .from("articles")
              .update({ posted: true, updated_at: new Date().toISOString() })
              .eq("id", articleId);
          }
        }
      }

      // Mark schedule as completed
      await supabase
        .from("scheduled_articles")
        .update({
          status: "completed",
          article_id: articleId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      // Handle recurrence: create the next scheduled item
      if (item.recurrence !== "one_time") {
        const nextDate = new Date(item.scheduled_for);
        if (item.recurrence === "daily") {
          nextDate.setDate(nextDate.getDate() + 1);
        } else if (item.recurrence === "weekly") {
          nextDate.setDate(nextDate.getDate() + 7);
        }

        await supabase.from("scheduled_articles").insert({
          user_id: item.user_id,
          topic: item.topic,
          focus_keyword: item.focus_keyword,
          quality: item.quality,
          generate_images: item.generate_images,
          auto_publish: item.auto_publish,
          publish_status: item.publish_status,
          wp_blog_id: item.wp_blog_id,
          category_ids: item.category_ids,
          scheduled_for: nextDate.toISOString(),
          recurrence: item.recurrence,
          recurrence_day: item.recurrence_day,
          status: "pending",
        });
      }

      results.push({ id: item.id, status: "completed" });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      await supabase
        .from("scheduled_articles")
        .update({
          status: "failed",
          error_message: errorMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      results.push({ id: item.id, status: "failed", error: errorMsg });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
