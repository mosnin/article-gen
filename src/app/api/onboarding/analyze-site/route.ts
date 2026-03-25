import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import OpenAI from "openai";

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  const [siteContent, similarSites, searchResults] = await Promise.all([
    exaGetContents(normalizedUrl),
    exaFindSimilar(normalizedUrl, 6),
    exaSearch(`site:${domain} blog articles`, 4),
  ]);

  const hasExaData = siteContent.length > 0 || similarSites.length > 0;

  // Build context string for GPT
  const contextParts: string[] = [];
  if (siteContent) contextParts.push(`Website content from ${domain}:\n${siteContent}`);
  if (searchResults.length > 0) contextParts.push(`Related content found:\n${searchResults.join("\n\n")}`);
  if (similarSites.length > 0) {
    contextParts.push(`Similar websites (potential competitors):\n${similarSites.map((s) => `- ${s.url}: ${s.title}`).join("\n")}`);
  }
  if (niche) contextParts.push(`User-provided niche: ${niche}`);
  if (!hasExaData) {
    contextParts.push(`Note: No website data was retrieved. Make educated guesses based on the domain name "${domain}" and any provided niche.`);
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

  const completion = await openai.chat.completions.create({
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
    dataSource: hasExaData ? "exa+openai" : "openai",
  });
}
