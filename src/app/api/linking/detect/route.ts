import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { validatePublicUrl } from "@/lib/ssrf";

export const maxDuration = 30;

interface LinkSource {
  type: "sitemap" | "blog" | "custom";
  url: string;
}

interface DetectedPage {
  url: string;
  title: string;
  slug: string;
}

function slugFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    return path.replace(/\/$/, "").split("/").pop() ?? path;
  } catch {
    return url;
  }
}

function titleFromSlug(slug: string): string {
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\.(html|htm|php|aspx?)$/i, "")
    .trim() || slug;
}

async function parseSitemap(url: string): Promise<DetectedPage[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "ArticleGenBot/1.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];

  const text = await res.text();
  const pages: DetectedPage[] = [];

  // Match <loc> tags in sitemap XML
  const locRegex = /<loc>\s*(https?:\/\/[^<]+)\s*<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(text)) !== null && pages.length < 200) {
    const pageUrl = match[1].trim();
    // Skip image/feed/category sitemaps and non-content URLs
    if (/\.(xml|jpg|jpeg|png|gif|svg|pdf|css|js)$/i.test(pageUrl)) continue;
    if (/\/(tag|category|feed|wp-json|author)\//i.test(pageUrl)) continue;

    const slug = slugFromUrl(pageUrl);
    // Try to extract title from <xhtml:title> or neighbouring <title> tag
    const titleRegex = new RegExp(`<title>([^<]*${slug.slice(0, 10)}[^<]*)<\\/title>`, "i");
    const titleMatch = titleRegex.exec(text);
    const title = titleMatch ? titleMatch[1].trim() : titleFromSlug(slug);

    pages.push({ url: pageUrl, title, slug });
  }

  return pages;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sources } = await req.json() as { sources: LinkSource[] };
  if (!Array.isArray(sources) || sources.length === 0) {
    return NextResponse.json({ pages: [] });
  }

  const allPages: DetectedPage[] = [];
  const seen = new Set<string>();

  for (const source of sources.slice(0, 5)) {
    const url = source.url?.trim();
    if (!url) continue;

    try { validatePublicUrl(url); } catch { continue; }

    try {
      const pages = await parseSitemap(url);
      for (const p of pages) {
        if (!seen.has(p.url)) {
          seen.add(p.url);
          allPages.push(p);
        }
      }
    } catch {
      // Skip failed sources
    }
  }

  return NextResponse.json({ pages: allPages.slice(0, 500) });
}
