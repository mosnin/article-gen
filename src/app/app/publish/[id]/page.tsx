"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import SnippetOptimizerPanel from "./SnippetOptimizerPanel";
import { toast } from "sonner";
import type { NLPScoreResult } from "@/lib/nlp-scorer";

type Platform = "wordpress" | "shopify" | "medium" | "ghost" | "devto";

interface Category {
  id: number;
  name: string;
  slug: string;
  count: number;
}

interface StoredImage {
  type: string;
  altText: string;
  storagePath: string;
  publicUrl: string;
  success: boolean;
}

interface Article {
  id: string;
  title: string;
  topic: string;
  slug: string;
  meta_description: string;
  article_markdown: string;
  posted: boolean;
  wp_blog_id?: string;
  generated_images?: StoredImage[];
  publish_at?: string | null;
  scheduled_platform?: string | null;
}

interface WpBlog { id: string; name: string; url: string; }
interface ShopifyAccount { id: string; name: string; shopDomain: string; }
interface MediumAccount { id: string; name: string; }
interface GhostBlog { id: string; name: string; url: string; }
interface DevToAccount { id: string; name: string; }

const inputStyle = {
  width: "100%", padding: "8px 12px", borderRadius: 8,
  border: "1px solid var(--border-default)", background: "var(--surface-base)",
  color: "var(--text-primary)", fontSize: 13, outline: "none",
} as const;

const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 } as const;

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "wordpress", label: "WordPress" },
  { id: "shopify", label: "Shopify" },
  { id: "medium", label: "Medium" },
  { id: "ghost", label: "Ghost" },
  { id: "devto", label: "Dev.to" },
];

export default function PublishPage() {
  const router = useRouter();
  const params = useParams();
  const articleId = params.id as string;
  const supabase = createClient();

  const [article, setArticle] = useState<Article | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [publishResult, setPublishResult] = useState<{ postUrl: string; editUrl: string; platform: string; imagesUploaded?: number; imageErrors?: string[] } | null>(null);
  const [publishLogs, setPublishLogs] = useState<Array<{ id: string; platform: string; account_name: string | null; post_url: string | null; published_at: string }>>([]);

  // Platform selection
  const [activePlatform, setActivePlatform] = useState<Platform>("wordpress");

  // WordPress state
  const [wpBlogs, setWpBlogs] = useState<WpBlog[]>([]);
  const [activeBlogId, setActiveBlogId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [postStatus, setPostStatus] = useState<"draft" | "publish">("draft");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [includeImages, setIncludeImages] = useState(true);

  // Shopify state
  const [shopifyAccounts, setShopifyAccounts] = useState<ShopifyAccount[]>([]);
  const [activeShopifyId, setActiveShopifyId] = useState("");

  // Medium state
  const [mediumAccounts, setMediumAccounts] = useState<MediumAccount[]>([]);
  const [activeMediumId, setActiveMediumId] = useState("");
  const [mediumStatus, setMediumStatus] = useState<"draft" | "public" | "unlisted">("draft");
  const [mediumCanonical, setMediumCanonical] = useState("");

  // Ghost state
  const [ghostBlogs, setGhostBlogs] = useState<GhostBlog[]>([]);
  const [activeGhostId, setActiveGhostId] = useState("");
  const [ghostStatus, setGhostStatus] = useState<"draft" | "published">("draft");

  // Dev.to state
  const [devtoAccounts, setDevtoAccounts] = useState<DevToAccount[]>([]);
  const [activeDevtoId, setActiveDevtoId] = useState("");
  const [devtoPublished, setDevtoPublished] = useState(false);
  const [devtoCanonical, setDevtoCanonical] = useState("");
  const [tagInput, setTagInput] = useState("");

  // Schedule state
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<{ scheduledAt: string } | null>(null);

  // Batch publish state
  const [batchMode, setBatchMode] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(new Set());
  const [batchPublishing, setBatchPublishing] = useState(false);
  const [batchResults, setBatchResults] = useState<Array<{ platform: string; success: boolean; postUrl?: string; editUrl?: string; error?: string }> | null>(null);

  // AI refresh state
  const [aiRefreshing, setAiRefreshing] = useState(false);
  const [aiRefreshStats, setAiRefreshStats] = useState<{ wordsAdded: number; serpTopics: string[] } | null>(null);

  // NLP SEO score state
  const [nlpScoring, setNlpScoring] = useState(false);
  const [nlpScore, setNlpScore] = useState<NLPScoreResult | null>(null);
  const [nlpScoreOpen, setNlpScoreOpen] = useState(false);

  // Focus mode
  const [focusMode, setFocusMode] = useState(false);

  // Editor ref + floating toolbar
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });
  const [editMode, setEditMode] = useState(false);

  const availableImages = article?.generated_images?.filter((i) => i.success && i.publicUrl) ?? [];

  const handleApplySnippetSection = async (section: string) => {
    if (!article) return;
    const updated = article.article_markdown
      ? `${article.article_markdown}\n\n---\n\n${section}`
      : section;
    setArticle((prev) => prev ? { ...prev, article_markdown: updated } : prev);
    const html = DOMPurify.sanitize(await marked(updated));
    setPreviewHtml(html);
  };

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/?auth=login"); return; }

    const { data: art } = await supabase
      .from("articles")
      .select("id, title, topic, slug, meta_description, article_markdown, posted, wp_blog_id, generated_images, publish_at, scheduled_platform")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (!art) { setError("Article not found"); setLoading(false); return; }

    setArticle(art as Article);
    const html = DOMPurify.sanitize(await marked(art.article_markdown || ""));
    setPreviewHtml(html);

    // Load publish history
    const logsRes = await fetch(`/api/publish-logs?articleId=${articleId}`);
    if (logsRes.ok) {
      const { logs } = await logsRes.json();
      setPublishLogs(logs ?? []);
    }

    // Load all platform settings
    const res = await fetch("/api/settings");
    if (res.ok) {
      const { settings } = await res.json();
      if (settings) {
        // WordPress
        const blogs: WpBlog[] = [];
        if (Array.isArray(settings.wp_blogs)) {
          for (const b of settings.wp_blogs as WpBlog[]) { if (b.url) blogs.push(b); }
        }
        setWpBlogs(blogs);
        const blogId = (art as Article).wp_blog_id || (blogs[0]?.id ?? "");
        setActiveBlogId(blogId);
        if (blogId) {
          try {
            const catRes = await fetch(`/api/wordpress/categories?blogId=${blogId}`);
            const catData = await catRes.json();
            if (catData.categories) setCategories(catData.categories);
          } catch { /* ignore */ }
        }

        // Shopify
        const shopify: ShopifyAccount[] = Array.isArray(settings.shopify_accounts) ? settings.shopify_accounts : [];
        setShopifyAccounts(shopify);
        if (shopify[0]) setActiveShopifyId(shopify[0].id);

        // Medium
        const medium: MediumAccount[] = Array.isArray(settings.medium_accounts) ? settings.medium_accounts : [];
        setMediumAccounts(medium);
        if (medium[0]) setActiveMediumId(medium[0].id);

        // Ghost
        const ghost: GhostBlog[] = Array.isArray(settings.ghost_blogs) ? settings.ghost_blogs : [];
        setGhostBlogs(ghost);
        if (ghost[0]) setActiveGhostId(ghost[0].id);

        // Dev.to
        const devto: DevToAccount[] = Array.isArray(settings.devto_accounts) ? settings.devto_accounts : [];
        setDevtoAccounts(devto);
        if (devto[0]) setActiveDevtoId(devto[0].id);

        // Auto-select first available platform
        if (blogs.length > 0) setActivePlatform("wordpress");
        else if (shopify.length > 0) setActivePlatform("shopify");
        else if (medium.length > 0) setActivePlatform("medium");
        else if (ghost.length > 0) setActivePlatform("ghost");
        else if (devto.length > 0) setActivePlatform("devto");
      }
    }

    setLoading(false);
  }, [articleId, router, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reload categories when blog changes
  const handleBlogChange = async (blogId: string) => {
    setActiveBlogId(blogId);
    setCategories([]);
    setSelectedCategories([]);
    try {
      const res = await fetch(`/api/wordpress/categories?blogId=${blogId}`);
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
    } catch { /* ignore */ }
  };

  const toggleCategory = (id: number) =>
    setSelectedCategories((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    try {
      const res = await fetch("/api/wordpress/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim(), blogId: activeBlogId || undefined }),
      });
      const data = await res.json();
      if (data.category) {
        setCategories((prev) => [...prev, data.category]);
        setSelectedCategories((prev) => [...prev, data.category.id]);
        setNewCategoryName("");
      } else {
        setError(data.error || "Failed to create category");
      }
    } catch { setError("Failed to create category"); }
    setCreatingCategory(false);
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError("");
    try {
      let res: Response;
      if (activePlatform === "wordpress") {
        res = await fetch("/api/wordpress/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId, categoryIds: selectedCategories, status: postStatus, includeImages, blogId: activeBlogId || undefined }),
        });
      } else if (activePlatform === "shopify") {
        res = await fetch("/api/shopify/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId, accountId: activeShopifyId || undefined }),
        });
      } else if (activePlatform === "medium") {
        const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
        res = await fetch("/api/medium/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId, accountId: activeMediumId || undefined, tags, status: mediumStatus, canonicalUrl: mediumCanonical || undefined }),
        });
      } else if (activePlatform === "ghost") {
        const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
        res = await fetch("/api/ghost/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId, blogId: activeGhostId || undefined, tags, status: ghostStatus }),
        });
      } else {
        // Dev.to
        const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
        res = await fetch("/api/devto/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId, accountId: activeDevtoId || undefined, tags, published: devtoPublished, canonicalUrl: devtoCanonical || undefined }),
        });
      }

      const data = await res!.json();
      if (data.success) {
        setPublishResult({ postUrl: data.postUrl, editUrl: data.editUrl, platform: activePlatform, imagesUploaded: data.imagesUploaded, imageErrors: data.imageErrors });
        setArticle((prev) => prev ? { ...prev, posted: true } : prev);
        // Refresh publish history
        const logsRes = await fetch(`/api/publish-logs?articleId=${articleId}`);
        if (logsRes.ok) { const { logs } = await logsRes.json(); setPublishLogs(logs ?? []); }
      } else {
        setError(data.error || "Failed to publish");
      }
    } catch {
      setError("Failed to publish article");
    }
    setPublishing(false);
  };

  const handleSchedule = async () => {
    if (!scheduleDateTime) { setError("Please select a date and time"); return; }
    setScheduling(true);
    setError("");
    try {
      let accountId: string | undefined;
      let scheduledOptions: Record<string, unknown> = {};

      if (activePlatform === "wordpress") {
        accountId = activeBlogId || undefined;
        scheduledOptions = { status: postStatus, categoryIds: selectedCategories, includeImages };
      } else if (activePlatform === "shopify") {
        accountId = activeShopifyId || undefined;
        scheduledOptions = { status: "publish" };
      } else if (activePlatform === "medium") {
        accountId = activeMediumId || undefined;
        const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
        scheduledOptions = { status: mediumStatus, tags, canonicalUrl: mediumCanonical || undefined };
      } else if (activePlatform === "ghost") {
        accountId = activeGhostId || undefined;
        const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
        scheduledOptions = { status: ghostStatus, tags };
      } else {
        accountId = activeDevtoId || undefined;
        const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
        scheduledOptions = { published: devtoPublished, tags, canonicalUrl: devtoCanonical || undefined };
      }

      const res = await fetch("/api/articles/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId,
          platform: activePlatform,
          accountId,
          publishAt: scheduleDateTime,
          scheduledOptions,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setScheduleResult({ scheduledAt: data.scheduledAt });
        setArticle((prev) => prev ? { ...prev, publish_at: data.scheduledAt, scheduled_platform: activePlatform } : prev);
      } else {
        setError(data.error || "Failed to schedule");
      }
    } catch {
      setError("Failed to schedule article");
    }
    setScheduling(false);
  };

  const togglePlatformSelection = (p: Platform) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const handleBatchPublish = async () => {
    if (selectedPlatforms.size === 0) return;
    setBatchPublishing(true);
    setError("");
    setBatchResults(null);
    try {
      const platforms = Array.from(selectedPlatforms).map((p) => {
        const entry: { platform: string; accountId?: string; options?: Record<string, unknown> } = { platform: p };
        if (p === "wordpress") {
          entry.accountId = activeBlogId || undefined;
          entry.options = { status: postStatus, categoryIds: selectedCategories, includeImages };
        } else if (p === "shopify") {
          entry.accountId = activeShopifyId || undefined;
        } else if (p === "medium") {
          entry.accountId = activeMediumId || undefined;
          const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
          entry.options = { status: mediumStatus, tags, canonicalUrl: mediumCanonical || undefined };
        } else if (p === "ghost") {
          entry.accountId = activeGhostId || undefined;
          const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
          entry.options = { status: ghostStatus, tags };
        } else if (p === "devto") {
          entry.accountId = activeDevtoId || undefined;
          const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
          entry.options = { published: devtoPublished, tags, canonicalUrl: devtoCanonical || undefined };
        }
        return entry;
      });

      const res = await fetch("/api/publish/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, platforms }),
      });

      const data = await res.json();
      if (data.results) {
        setBatchResults(data.results);
        const anySuccess = data.results.some((r: { success: boolean }) => r.success);
        if (anySuccess) {
          setArticle((prev) => prev ? { ...prev, posted: true } : prev);
          // Refresh publish history
          const logsRes = await fetch(`/api/publish-logs?articleId=${articleId}`);
          if (logsRes.ok) { const { logs } = await logsRes.json(); setPublishLogs(logs ?? []); }
        }
      } else {
        setError(data.error || "Failed to batch publish");
      }
    } catch {
      setError("Failed to batch publish");
    }
    setBatchPublishing(false);
  };

  const handleExportMarkdown = () => {
    if (!article) return;
    const blob = new Blob([article.article_markdown || ""], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${article.slug || "article"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAiRefresh = async () => {
    if (!article) return;
    const confirmed = window.confirm(
      "This will expand and update the article with latest SERP insights. Continue?"
    );
    if (!confirmed) return;

    setAiRefreshing(true);
    setAiRefreshStats(null);
    const toastId = toast.loading("Refreshing article with latest SERP data...");

    try {
      const res = await fetch("/api/articles/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          focusKeyword: article.topic,
          currentContent: article.article_markdown,
          articleId: article.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to refresh article", { id: toastId });
      } else {
        const { content, wordsAdded, serpTopics } = data as {
          content: string;
          wordCount: number;
          previousWordCount: number;
          wordsAdded: number;
          serpTopics: string[];
          questionsAdded: string[];
        };

        setArticle((prev) =>
          prev ? { ...prev, article_markdown: content } : prev
        );
        const html = DOMPurify.sanitize(await marked(content || ""));
        setPreviewHtml(html);

        const topicsLabel = serpTopics.slice(0, 3).join(", ");
        const statsMsg = `Words added: +${wordsAdded}${topicsLabel ? ` | SERP topics: ${topicsLabel}` : ""}`;
        toast.success(statsMsg, { id: toastId, duration: 8000 });
        setAiRefreshStats({ wordsAdded, serpTopics });
      }
    } catch {
      toast.error("Failed to refresh article", { id: toastId });
    }

    setAiRefreshing(false);
  };

  const platformLabel: Record<Platform, string> = {
    wordpress: "WordPress",
    shopify: "Shopify",
    medium: "Medium",
    ghost: "Ghost",
    devto: "Dev.to",
  };

  const hasPlatform: Record<Platform, boolean> = {
    wordpress: wpBlogs.length > 0,
    shopify: shopifyAccounts.length > 0,
    medium: mediumAccounts.length > 0,
    ghost: ghostBlogs.length > 0,
    devto: devtoAccounts.length > 0,
  };

  const hasAnyPlatform = Object.values(hasPlatform).some(Boolean);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "var(--surface-base)" }}>
        <svg className="progress-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--surface-base)", minHeight: "100vh" }}>
      <header style={{ borderBottom: "1px solid var(--border-default)", background: "var(--surface-base)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }} onClick={() => router.push("/app")}>
              <Image src="/logo.png" alt="Article Sauce" width={28} height={28} />
              <span style={{ fontWeight: 700, fontSize: 17 }}>Article Sauce</span>
            </div>
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>/</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Publish Article</span>
          </div>
          <button onClick={() => router.push("/app")} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: "var(--surface-raised)", border: "1px solid var(--border-default)", cursor: "pointer" }}>
            Back to App
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {!article ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--error)" }}>{error || "Article not found"}</div>
        ) : batchResults ? (
          /* Batch publish results */
          <div style={{ maxWidth: 540, margin: "0 auto", paddingTop: 48 }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Batch Publish Results</h1>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {batchResults.filter((r) => r.success).length} of {batchResults.length} platforms published successfully
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {batchResults.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 10, background: "var(--surface-base)", border: "1px solid var(--border-default)" }}>
                  {r.success ? (
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--success-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                  ) : (
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--error-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{platformLabel[r.platform as Platform] ?? r.platform}</div>
                    <div style={{ fontSize: 12, color: r.success ? "var(--success)" : "var(--error)", marginTop: 1 }}>
                      {r.success ? "Published successfully" : (r.error || "Failed")}
                    </div>
                  </div>
                  {r.success && r.postUrl && (
                    <a href={r.postUrl} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "var(--accent)", whiteSpace: "nowrap", textDecoration: "none", fontWeight: 600, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border-default)" }}>
                      View →
                    </a>
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 28, display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => { setBatchResults(null); setBatchMode(false); setSelectedPlatforms(new Set()); }}
                style={{ padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--surface-base)", border: "1px solid var(--border-default)", color: "var(--text-primary)", cursor: "pointer" }}>
                Publish More
              </button>
              <button onClick={() => router.push("/app")}
                style={{ padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>
                Back to Dashboard
              </button>
            </div>
          </div>
        ) : publishResult ? (
          /* Success state */
          <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", paddingTop: 56 }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--success-light)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>
              Published to {platformLabel[publishResult.platform as Platform] ?? publishResult.platform}
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: publishResult.imageErrors?.length ? 16 : 28, lineHeight: 1.6 }}>
              &quot;{article.title}&quot; has been sent successfully.
              {publishResult.imagesUploaded ? ` ${publishResult.imagesUploaded} image${publishResult.imagesUploaded > 1 ? "s" : ""} uploaded.` : ""}
            </p>
            {publishResult.imageErrors && publishResult.imageErrors.length > 0 && (
              <div style={{ padding: "12px 16px", borderRadius: 8, background: "var(--warning-light)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontSize: 13, marginBottom: 24, textAlign: "left" }}>
                <strong style={{ color: "var(--warning)" }}>Some images failed to upload:</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "var(--text-secondary)" }}>
                  {publishResult.imageErrors.map((err, i) => <li key={i} style={{ fontSize: 12 }}>{err}</li>)}
                </ul>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              {publishResult.postUrl && (
                <a href={publishResult.postUrl} target="_blank" rel="noopener noreferrer"
                  style={{ padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", textDecoration: "none", display: "inline-block" }}>
                  View Post
                </a>
              )}
              {publishResult.editUrl && publishResult.editUrl !== publishResult.postUrl && (
                <a href={publishResult.editUrl} target="_blank" rel="noopener noreferrer"
                  style={{ padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--surface-base)", border: "1px solid var(--border-default)", color: "var(--text-primary)", textDecoration: "none", display: "inline-block" }}>
                  Edit Post
                </a>
              )}
            </div>
            <button onClick={() => router.push("/app")}
              style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, fontSize: 13, background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 32, alignItems: "start" }}>
            {/* Article Preview */}
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--text-primary)", lineHeight: 1.3 }}>{article.title || article.topic}</h1>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, marginBottom: 0 }}>
                    <span style={{ fontFamily: "monospace", background: "var(--surface-sunken)", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--border-default)" }}>/{article.slug}</span>
                    <span style={{ margin: "0 6px", color: "var(--border-strong)" }}>·</span>
                    {article.article_markdown?.split(/\s+/).length || 0} words
                  </p>
                </div>
                <button onClick={handleExportMarkdown}
                  style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--surface-base)", border: "1px solid var(--border-default)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", color: "var(--text-primary)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Export Markdown
                </button>
              </div>

              {/* Article content card */}
              <div className="article-preview"
                style={{ background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "28px 32px", maxHeight: "70vh", overflow: "auto", fontSize: 14, lineHeight: 1.75, marginTop: 14 }}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />

              {/* AI Refresh bar */}
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={handleAiRefresh}
                  disabled={aiRefreshing}
                  style={{
                    padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: "var(--surface-base)", border: "1px solid var(--border-default)", color: "var(--text-primary)",
                    cursor: aiRefreshing ? "not-allowed" : "pointer",
                    opacity: aiRefreshing ? 0.6 : 1,
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {aiRefreshing ? (
                    <>
                      <svg className="progress-spinner" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                      Refreshing with AI…
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.95" /></svg>
                      Refresh with AI
                    </>
                  )}
                </button>
                {aiRefreshStats && (
                  <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 500 }}>
                    +{aiRefreshStats.wordsAdded} words
                    {aiRefreshStats.serpTopics.length > 0 && (
                      <span style={{ color: "var(--text-secondary)" }}> · SERP: {aiRefreshStats.serpTopics.slice(0, 3).join(", ")}</span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Publish Panel */}
            <div style={{ position: "sticky", top: 80 }}>
              {!hasAnyPlatform ? (
                <div style={{ background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 24 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>No Platform Connected</h3>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
                    Connect a publishing platform in Settings to enable publishing.
                  </p>
                  <button onClick={() => router.push("/app/settings")}
                    style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>
                    Go to Settings
                  </button>
                </div>
              ) : (
                <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, overflow: "hidden" }}>
                  {/* Platform tabs */}
                  <div style={{ display: "flex", borderBottom: "1px solid var(--border-default)", overflowX: "auto" }}>
                    {PLATFORMS.filter((p) => hasPlatform[p.id]).map((p) => (
                      <button key={p.id} onClick={() => { setActivePlatform(p.id); setError(""); }}
                        style={{
                          flex: 1, minWidth: "fit-content", padding: "12px 14px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                          background: activePlatform === p.id ? "var(--surface-base)" : "transparent",
                          color: activePlatform === p.id ? "var(--accent)" : "var(--text-secondary)",
                          borderBottom: activePlatform === p.id ? "2px solid var(--accent)" : "2px solid transparent",
                        }}>
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Batch mode toggle */}
                    {Object.values(hasPlatform).filter(Boolean).length > 1 && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>Publish to Multiple Platforms</label>
                        <div onClick={() => { setBatchMode(!batchMode); setError(""); setBatchResults(null); if (!batchMode) setSelectedPlatforms(new Set()); }}
                          style={{ width: 36, height: 20, borderRadius: 10, background: batchMode ? "var(--accent)" : "var(--border-default)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
                          <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: batchMode ? 18 : 2, transition: "left 0.2s" }} />
                        </div>
                      </div>
                    )}

                    {/* Batch mode: platform checkboxes */}
                    {batchMode && (
                      <>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {PLATFORMS.filter((p) => hasPlatform[p.id]).map((p) => (
                            <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: selectedPlatforms.has(p.id) ? "rgba(0,0,0,0.04)" : "transparent", fontSize: 13, fontWeight: 500 }}>
                              <input type="checkbox" checked={selectedPlatforms.has(p.id)} onChange={() => togglePlatformSelection(p.id)} style={{ accentColor: "var(--accent)" }} />
                              {p.label}
                            </label>
                          ))}
                        </div>
                        {selectedPlatforms.size > 0 && (
                          <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: -8 }}>
                            {selectedPlatforms.size} platform{selectedPlatforms.size > 1 ? "s" : ""} selected. Each platform will use its default options configured below.
                          </p>
                        )}
                      </>
                    )}

                    {/* WordPress options */}
                    {activePlatform === "wordpress" && (
                      <>
                        {wpBlogs.length > 1 && (
                          <div>
                            <label style={labelStyle}>Blog</label>
                            <select value={activeBlogId} onChange={(e) => handleBlogChange(e.target.value)}
                              style={{ ...inputStyle, fontWeight: 500 }}>
                              {wpBlogs.map((b) => <option key={b.id} value={b.id}>{b.name || b.url}</option>)}
                            </select>
                          </div>
                        )}
                        {wpBlogs.length === 1 && (
                          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Publishing to <strong style={{ color: "var(--text-primary)" }}>{wpBlogs[0].name || wpBlogs[0].url}</strong></p>
                        )}
                        <div>
                          <label style={labelStyle}>Status</label>
                          <div style={{ display: "flex", gap: 8 }}>
                            {(["draft", "publish"] as const).map((s) => (
                              <button key={s} onClick={() => setPostStatus(s)}
                                style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "1px solid", borderColor: postStatus === s ? "var(--accent)" : "var(--border-default)", background: postStatus === s ? "var(--accent)" : "var(--surface-base)", color: postStatus === s ? "#fff" : "var(--text-primary)", cursor: "pointer", textTransform: "capitalize" }}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>Categories</label>
                          <div style={{ maxHeight: 160, overflow: "auto", marginBottom: 8, display: "flex", flexDirection: "column", gap: 2 }}>
                            {categories.map((cat) => (
                              <label key={cat.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6, cursor: "pointer", background: selectedCategories.includes(cat.id) ? "rgba(0,0,0,0.04)" : "transparent", fontSize: 13 }}>
                                <input type="checkbox" checked={selectedCategories.includes(cat.id)} onChange={() => toggleCategory(cat.id)} style={{ accentColor: "var(--accent)" }} />
                                <span style={{ fontWeight: 500 }}>{cat.name}</span>
                                <span style={{ color: "var(--text-secondary)", fontSize: 11, marginLeft: "auto" }}>{cat.count}</span>
                              </label>
                            ))}
                            {categories.length === 0 && <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>No categories found</p>}
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input type="text" placeholder="New category" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); }}
                              style={{ flex: 1, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--surface-base)", fontSize: 13, outline: "none" }} />
                            <button onClick={handleCreateCategory} disabled={creatingCategory || !newCategoryName.trim()}
                              style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", opacity: creatingCategory || !newCategoryName.trim() ? 0.5 : 1 }}>
                              {creatingCategory ? "..." : "Add"}
                            </button>
                          </div>
                        </div>
                        {availableImages.length > 0 && (
                          <div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                              <label style={labelStyle}>AI Images ({availableImages.length})</label>
                              <div onClick={() => setIncludeImages(!includeImages)}
                                style={{ width: 36, height: 20, borderRadius: 10, background: includeImages ? "var(--accent)" : "var(--border-default)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
                                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: includeImages ? 18 : 2, transition: "left 0.2s" }} />
                              </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, opacity: includeImages ? 1 : 0.4, transition: "opacity 0.2s" }}>
                              {availableImages.map((img, i) => (
                                <div key={i} style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-default)" }}>
                                  <img src={img.publicUrl} alt={img.altText} style={{ width: "100%", height: 70, objectFit: "cover", display: "block" }} />
                                  <div style={{ padding: "3px 6px", fontSize: 10, color: "var(--text-secondary)" }}>{img.type}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Shopify options */}
                    {activePlatform === "shopify" && (
                      <>
                        {shopifyAccounts.length > 1 && (
                          <div>
                            <label style={labelStyle}>Store</label>
                            <select value={activeShopifyId} onChange={(e) => setActiveShopifyId(e.target.value)} style={{ ...inputStyle, fontWeight: 500 }}>
                              {shopifyAccounts.map((a) => <option key={a.id} value={a.id}>{a.name || a.shopDomain}</option>)}
                            </select>
                          </div>
                        )}
                        {shopifyAccounts.length === 1 && (
                          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Publishing to <strong style={{ color: "var(--text-primary)" }}>{shopifyAccounts[0].name || shopifyAccounts[0].shopDomain}</strong></p>
                        )}
                        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Article will be published to your Shopify blog.</p>
                      </>
                    )}

                    {/* Medium options */}
                    {activePlatform === "medium" && (
                      <>
                        {mediumAccounts.length > 1 && (
                          <div>
                            <label style={labelStyle}>Account</label>
                            <select value={activeMediumId} onChange={(e) => setActiveMediumId(e.target.value)} style={{ ...inputStyle, fontWeight: 500 }}>
                              {mediumAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                          </div>
                        )}
                        <div>
                          <label style={labelStyle}>Publish Status</label>
                          <div style={{ display: "flex", gap: 8 }}>
                            {(["draft", "public", "unlisted"] as const).map((s) => (
                              <button key={s} onClick={() => setMediumStatus(s)}
                                style={{ flex: 1, padding: "7px 8px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid", borderColor: mediumStatus === s ? "var(--accent)" : "var(--border-default)", background: mediumStatus === s ? "var(--accent)" : "var(--surface-base)", color: mediumStatus === s ? "#fff" : "var(--text-primary)", cursor: "pointer", textTransform: "capitalize" }}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>Tags (comma separated, max 5)</label>
                          <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="technology, programming, web" style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Canonical URL (optional)</label>
                          <input type="text" value={mediumCanonical} onChange={(e) => setMediumCanonical(e.target.value)} placeholder="https://yourblog.com/post" style={inputStyle} />
                        </div>
                      </>
                    )}

                    {/* Ghost options */}
                    {activePlatform === "ghost" && (
                      <>
                        {ghostBlogs.length > 1 && (
                          <div>
                            <label style={labelStyle}>Blog</label>
                            <select value={activeGhostId} onChange={(e) => setActiveGhostId(e.target.value)} style={{ ...inputStyle, fontWeight: 500 }}>
                              {ghostBlogs.map((b) => <option key={b.id} value={b.id}>{b.name || b.url}</option>)}
                            </select>
                          </div>
                        )}
                        {ghostBlogs.length === 1 && (
                          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Publishing to <strong style={{ color: "var(--text-primary)" }}>{ghostBlogs[0].name || ghostBlogs[0].url}</strong></p>
                        )}
                        <div>
                          <label style={labelStyle}>Status</label>
                          <div style={{ display: "flex", gap: 8 }}>
                            {(["draft", "published"] as const).map((s) => (
                              <button key={s} onClick={() => setGhostStatus(s)}
                                style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "1px solid", borderColor: ghostStatus === s ? "var(--accent)" : "var(--border-default)", background: ghostStatus === s ? "var(--accent)" : "var(--surface-base)", color: ghostStatus === s ? "#fff" : "var(--text-primary)", cursor: "pointer", textTransform: "capitalize" }}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>Tags (comma separated)</label>
                          <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="technology, tutorials" style={inputStyle} />
                        </div>
                      </>
                    )}

                    {/* Dev.to options */}
                    {activePlatform === "devto" && (
                      <>
                        {devtoAccounts.length > 1 && (
                          <div>
                            <label style={labelStyle}>Account</label>
                            <select value={activeDevtoId} onChange={(e) => setActiveDevtoId(e.target.value)} style={{ ...inputStyle, fontWeight: 500 }}>
                              {devtoAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <label style={{ ...labelStyle, marginBottom: 0 }}>Publish immediately</label>
                          <div onClick={() => setDevtoPublished(!devtoPublished)}
                            style={{ width: 36, height: 20, borderRadius: 10, background: devtoPublished ? "var(--accent)" : "var(--border-default)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
                            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: devtoPublished ? 18 : 2, transition: "left 0.2s" }} />
                          </div>
                        </div>
                        {!devtoPublished && <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: -8 }}>Will be saved as draft on Dev.to</p>}
                        <div>
                          <label style={labelStyle}>Tags (comma separated, max 4, lowercase)</label>
                          <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="javascript, webdev, tutorial" style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Canonical URL (optional)</label>
                          <input type="text" value={devtoCanonical} onChange={(e) => setDevtoCanonical(e.target.value)} placeholder="https://yourblog.com/post" style={inputStyle} />
                        </div>
                      </>
                    )}

                    {/* Schedule mode toggle */}
                    <div style={{ display: "flex", gap: 6, borderRadius: 8, background: "var(--surface-base)", border: "1px solid var(--border-default)", padding: 4 }}>
                      <button onClick={() => { setScheduleMode(false); setError(""); setScheduleResult(null); }}
                        style={{ flex: 1, padding: "7px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: !scheduleMode ? "var(--accent)" : "transparent", color: !scheduleMode ? "#fff" : "var(--text-secondary)", transition: "all 0.15s" }}>
                        Publish Now
                      </button>
                      <button onClick={() => { setScheduleMode(true); setError(""); setScheduleResult(null); }}
                        style={{ flex: 1, padding: "7px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: scheduleMode ? "var(--accent)" : "transparent", color: scheduleMode ? "#fff" : "var(--text-secondary)", transition: "all 0.15s" }}>
                        Schedule
                      </button>
                    </div>

                    {/* Schedule datetime picker */}
                    {scheduleMode && (
                      <div>
                        <label style={labelStyle}>Publish Date &amp; Time</label>
                        <input
                          type="datetime-local"
                          value={scheduleDateTime}
                          onChange={(e) => setScheduleDateTime(e.target.value)}
                          min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                          style={{ ...inputStyle, colorScheme: "dark" }}
                        />
                      </div>
                    )}

                    {/* Scheduled confirmation */}
                    {scheduleResult && (
                      <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(52, 199, 89, 0.1)", color: "var(--success)", fontSize: 13, fontWeight: 500 }}>
                        Scheduled for {new Date(scheduleResult.scheduledAt).toLocaleString()}
                      </div>
                    )}

                    {/* Error */}
                    {error && (
                      <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239, 68, 68, 0.1)", color: "var(--error)", fontSize: 13 }}>
                        {error}
                      </div>
                    )}

                    {/* Publish / Schedule / Batch button */}
                    {batchMode ? (
                      <button onClick={handleBatchPublish} disabled={batchPublishing || selectedPlatforms.size === 0}
                        style={{ width: "100%", padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 700, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", opacity: (batchPublishing || selectedPlatforms.size === 0) ? 0.6 : 1 }}>
                        {batchPublishing ? "Publishing..." : `Publish to ${selectedPlatforms.size} Platform${selectedPlatforms.size !== 1 ? "s" : ""}`}
                      </button>
                    ) : scheduleMode ? (
                      <button onClick={handleSchedule} disabled={scheduling || !scheduleDateTime}
                        style={{ width: "100%", padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 700, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", opacity: (scheduling || !scheduleDateTime) ? 0.6 : 1 }}>
                        {scheduling ? "Scheduling..." : `Schedule for ${platformLabel[activePlatform]}`}
                      </button>
                    ) : (
                      <button onClick={handlePublish} disabled={publishing}
                        style={{ width: "100%", padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 700, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", opacity: publishing ? 0.6 : 1 }}>
                        {publishing ? "Publishing..." : `Publish to ${platformLabel[activePlatform]}`}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Scheduled status */}
              {article.publish_at && !article.posted && (
                <div style={{ marginTop: 16, background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                      Scheduled for {new Date(article.publish_at).toLocaleString()}
                    </div>
                    {article.scheduled_platform && (
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "capitalize" }}>
                        Platform: {article.scheduled_platform}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Publish History */}
              {publishLogs.length > 0 && (
                <div style={{ marginTop: 24, background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-default)" }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Publish History</h3>
                  </div>
                  <div style={{ padding: "8px 0" }}>
                    {publishLogs.map((log) => (
                      <div key={log.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{log.platform}</div>
                          {log.account_name && <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.account_name}</div>}
                          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{new Date(log.published_at).toLocaleDateString()}</div>
                        </div>
                        {log.post_url && (
                          <a href={log.post_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 12, color: "var(--accent)", whiteSpace: "nowrap", textDecoration: "none", fontWeight: 500 }}>
                            View →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Featured Snippet Optimizer */}
              <SnippetOptimizerPanel
                focusKeyword={article.topic || article.title || ""}
                articleContent={article.article_markdown || ""}
                onApplySection={handleApplySnippetSection}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
