import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import OpenAI from "openai";

export const maxDuration = 60;

const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Exa helpers ─────────────────────────────────────────────────────────────

async function exaSearch(query: string, numResults = 5): Promise<string[]> {
  const EXA_KEY = process.env.EXA_API_KEY;
  if (!EXA_KEY) return [];

  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": EXA_KEY,
      },
      body: JSON.stringify({
        query,
        numResults,
        type: "keyword",
        useAutoprompt: true,
        contents: { text: { maxCharacters: 800 } },
      }),
    });

    if (!res.ok) return [];

    const data = await res.json() as {
      results?: Array<{ url: string; text?: string; title?: string }>;
    };

    return (data.results ?? []).map((r) => `${r.title ?? r.url}: ${r.text ?? ""}`);
  } catch {
    return [];
  }
}

async function exaFindSimilar(url: string, numResults = 5): Promise<Array<{ url: string; title: string }>> {
  const EXA_KEY = process.env.EXA_API_KEY;
  if (!EXA_KEY) return [];

  try {
    const res = await fetch("https://api.exa.ai/findSimilar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": EXA_KEY,
      },
      body: JSON.stringify({
        url,
        numResults,
        excludeSourceDomain: true,
        contents: { text: { maxCharacters: 400 } },
      }),
    });

    if (!res.ok) return [];

    const data = await res.json() as {
      results?: Array<{ url: string; title?: string }>;
    };

    return (data.results ?? []).map((r) => ({
      url: new URL(r.url).hostname.replace("www.", ""),
      title: r.title ?? r.url,
    }));
  } catch {
    return [];
  }
}

async function exaGetContents(url: string): Promise<string> {
  const EXA_KEY = process.env.EXA_API_KEY;
  if (!EXA_KEY) return "";

  try {
    const res = await fetch("https://api.exa.ai/contents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": EXA_KEY,
      },
      body: JSON.stringify({
        ids: [url],
        text: { maxCharacters: 2000 },
      }),
    });

    if (!res.ok) return "";

    const data = await res.json() as {
      results?: Array<{ text?: string }>;
    };

    return data.results?.[0]?.text ?? "";
  } catch {
    return "";
  }
}

// ─── Direct fetch fallback (no Exa needed) ─────────────────────────────────

async function fetchSiteDirectly(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ArticleSauce/1.0)",
        Accept: "text/html",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) return "";

    const html = await res.text();

    // Strip scripts, styles, and tags to get raw text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Return first 3000 chars of meaningful content
    return text.slice(0, 3000);
  } catch {
    return "";
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url, niche } = await req.json() as { url?: string; niche?: string };

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Normalize URL
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http")) normalizedUrl = `https://${normalizedUrl}`;

  let domain: string;
  try {
    domain = new URL(normalizedUrl).hostname.replace("www.", "");
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // ── Gather context in parallel ──────────────────────────────────────────────
  const hasExa = !!process.env.EXA_API_KEY;

  const [siteContent, similarSites, searchResults, directContent] = await Promise.all([
    exaGetContents(normalizedUrl),
    exaFindSimilar(normalizedUrl, 6),
    exaSearch(`site:${domain} blog articles`, 4),
    hasExa ? Promise.resolve("") : fetchSiteDirectly(normalizedUrl),
  ]);

  // Use Exa content if available, otherwise use direct fetch
  const pageContent = siteContent.length > 0 ? siteContent : directContent;
  const hasRealData = pageContent.length > 0;

  // Build context string for GPT
  const contextParts: string[] = [];
  if (pageContent) contextParts.push(`Website content from ${domain}:\n${pageContent}`);
  if (searchResults.length > 0) contextParts.push(`Related content found:\n${searchResults.join("\n\n")}`);
  if (similarSites.length > 0) {
    contextParts.push(`Similar websites (potential competitors):\n${similarSites.map((s) => `- ${s.url}: ${s.title}`).join("\n")}`);
  }
  if (niche) contextParts.push(`User-provided niche: ${niche}`);
  if (!hasRealData) {
    contextParts.push(`IMPORTANT: No website content could be retrieved. You MUST only use the domain name "${domain}" and user-provided niche (if any). Do NOT fabricate or guess what the business does. If unsure, use generic placeholders like "Digital Business" for niche and ask the user to fill in details manually.`);
  }

  const context = contextParts.join("\n\n---\n\n");

  // ── GPT analysis ─────────────────────────────────────────────────────────
  const prompt = `You are an SEO and content strategy expert. Based on the following data about a website, provide a structured analysis.

${context}

Respond ONLY with valid JSON in this exact format:
{
  "niche": "A 3-10 word description of the site's niche/industry",
  "businessDescription": "1-2 sentences describing what this business does and who it serves",
  "targetAudiences": ["audience 1 (10-40 words)", "audience 2 (10-40 words)", "audience 3 (10-40 words)", "audience 4 (10-40 words)", "audience 5 (10-40 words)"],
  "competitors": ["competitor1.com", "competitor2.com", "competitor3.com", "competitor4.com", "competitor5.com"],
  "topKeywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6", "keyword 7", "keyword 8"],
  "contentThemes": ["theme 1", "theme 2", "theme 3", "theme 4"],
  "suggestedSitemapUrl": "https://${domain}/sitemap.xml",
  "suggestedBlogUrl": "https://${domain}/blog"
}

Rules:
- targetAudiences: describe real people with specific needs (e.g. "B2B SaaS founders looking to grow organic traffic without a content team")
- competitors: real domains that compete in the same space, do NOT include the user's own domain
- topKeywords: SEO keywords this site should target, 2-5 words each
- Be specific and actionable, not generic`;

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    response_format: { type: "json_object" },
  });

  const rawJson = completion.choices[0]?.message?.content ?? "{}";

  let analysis: {
    niche?: string;
    businessDescription?: string;
    targetAudiences?: string[];
    competitors?: string[];
    topKeywords?: string[];
    contentThemes?: string[];
    suggestedSitemapUrl?: string;
    suggestedBlogUrl?: string;
  };

  try {
    analysis = JSON.parse(rawJson);
  } catch {
    return NextResponse.json({ error: "Failed to parse analysis" }, { status: 500 });
  }

  // Merge Exa-found competitors with GPT-suggested ones, deduplicate
  const exaCompetitorDomains = similarSites.map((s) => s.url);
  const allCompetitors = [...new Set([...exaCompetitorDomains, ...(analysis.competitors ?? [])])].slice(0, 7);

  return NextResponse.json({
    domain,
    niche: analysis.niche ?? "",
    businessDescription: analysis.businessDescription ?? "",
    targetAudiences: analysis.targetAudiences ?? [],
    competitors: allCompetitors,
    topKeywords: analysis.topKeywords ?? [],
    contentThemes: analysis.contentThemes ?? [],
    suggestedSitemapUrl: analysis.suggestedSitemapUrl ?? `https://${domain}/sitemap.xml`,
    suggestedBlogUrl: analysis.suggestedBlogUrl ?? `https://${domain}/blog`,
    dataSource: hasRealData ? (hasExa ? "exa+openai" : "direct+openai") : "openai-only",
  });
}
