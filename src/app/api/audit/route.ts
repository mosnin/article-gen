import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const maxDuration = 30;

export interface ArticleAuditItem {
  id: string;
  title: string;
  focusKeyword: string;
  wordCount: number;
  createdAt: string;
  publishedAt?: string;
  isPublished: boolean;
  // Health indicators
  hasImages: boolean;
  hasFaq: boolean;
  hasMetaDescription: boolean;
  wordCountHealth: "good" | "thin" | "unknown";
  ageInDays: number;
  needsRefresh: boolean;
  score: number; // 0-100
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: articles } = await supabase
    .from("articles")
    .select("id, title, focus_keyword, content, meta_description, created_at, published_at, status, word_count")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!articles) return NextResponse.json({ items: [] });

  const now = new Date();

  const items: ArticleAuditItem[] = articles.map((a) => {
    const content = a.content ?? "";
    const wordCount = a.word_count ?? content.split(/\s+/).filter(Boolean).length;
    const ageInDays = Math.floor((now.getTime() - new Date(a.created_at).getTime()) / 86400000);
    const hasImages = content.includes("![") || content.includes("<img");
    const hasFaq = content.toLowerCase().includes("faq") || content.includes("## Q:");
    const hasMetaDescription = !!a.meta_description;
    const wordCountHealth = wordCount >= 1200 ? "good" : wordCount >= 600 ? "thin" : "unknown";
    const needsRefresh = ageInDays > 90 && a.status !== "draft";

    // Compute health score
    let score = 0;
    if (wordCountHealth === "good") score += 30;
    else if (wordCountHealth === "thin") score += 15;
    if (hasImages) score += 20;
    if (hasFaq) score += 20;
    if (hasMetaDescription) score += 15;
    if (a.focus_keyword) score += 15;

    return {
      id: a.id,
      title: a.title ?? "Untitled",
      focusKeyword: a.focus_keyword ?? "",
      wordCount,
      createdAt: a.created_at,
      publishedAt: a.published_at ?? undefined,
      isPublished: a.status === "published",
      hasImages,
      hasFaq,
      hasMetaDescription,
      wordCountHealth,
      ageInDays,
      needsRefresh,
      score,
    };
  });

  const summary = {
    total: items.length,
    published: items.filter(i => i.isPublished).length,
    needsRefresh: items.filter(i => i.needsRefresh).length,
    thin: items.filter(i => i.wordCountHealth === "thin").length,
    noImages: items.filter(i => !i.hasImages).length,
    avgScore: items.length ? Math.round(items.reduce((s, i) => s + i.score, 0) / items.length) : 0,
  };

  return NextResponse.json({ items, summary });
}
