"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { marked } from "marked";

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
}

interface WpBlog {
  id: string;
  name: string;
  url: string;
  authorName?: string;
  authorAbout?: string;
}

export default function PublishPage() {
  const router = useRouter();
  const params = useParams();
  const articleId = params.id as string;
  const supabase = createClient();

  const [article, setArticle] = useState<Article | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [postStatus, setPostStatus] = useState<"draft" | "publish">("draft");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [wpConnected, setWpConnected] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [publishResult, setPublishResult] = useState<{ postUrl: string; editUrl: string; imagesUploaded?: number; imageErrors?: string[] } | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [includeImages, setIncludeImages] = useState(true);
  const [wpBlogs, setWpBlogs] = useState<WpBlog[]>([]);
  const [activeBlogId, setActiveBlogId] = useState<string>("");

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/?auth=login");
      return;
    }

    // Fetch article with generated_images
    const { data: art } = await supabase
      .from("articles")
      .select("id, title, topic, slug, meta_description, article_markdown, posted, wp_blog_id, generated_images")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (!art) {
      setError("Article not found");
      setLoading(false);
      return;
    }

    setArticle(art as Article);
    const html = await marked(art.article_markdown || "");
    setPreviewHtml(html);

    // Load user's blogs
    const { data: settings } = await supabase
      .from("user_settings")
      .select("wp_blogs, wp_url")
      .eq("user_id", user.id)
      .single();

    const blogs: WpBlog[] = [];
    if (settings?.wp_blogs && Array.isArray(settings.wp_blogs)) {
      for (const b of settings.wp_blogs as WpBlog[]) {
        if (b.url) blogs.push(b);
      }
    }
    setWpBlogs(blogs);

    // Use article's assigned blog, or first available
    const blogId = art.wp_blog_id || (blogs.length > 0 ? blogs[0].id : "");
    setActiveBlogId(blogId);

    // Fetch categories for the selected blog
    if (blogId || settings?.wp_url) {
      try {
        const catUrl = blogId ? `/api/wordpress/categories?blogId=${blogId}` : "/api/wordpress/categories";
        const res = await fetch(catUrl);
        const data = await res.json();
        if (data.categories) {
          setCategories(data.categories);
          setWpConnected(true);
        } else {
          setError(data.error || "WordPress not connected");
        }
      } catch {
        setError("Failed to connect to WordPress");
      }
    } else {
      setError("No blogs connected. Add a blog in Settings.");
    }

    setLoading(false);
  }, [articleId, router, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleCategory = (id: number) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

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
    } catch {
      setError("Failed to create category");
    }
    setCreatingCategory(false);
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError("");
    try {
      const res = await fetch("/api/wordpress/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId,
          categoryIds: selectedCategories,
          status: postStatus,
          includeImages,
          blogId: activeBlogId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPublishResult({ postUrl: data.postUrl, editUrl: data.editUrl, imagesUploaded: data.imagesUploaded, imageErrors: data.imageErrors });
        setArticle((prev) => prev ? { ...prev, posted: true } : prev);
      } else {
        setError(data.error || "Failed to publish");
      }
    } catch {
      setError("Failed to publish article");
    }
    setPublishing(false);
  };

  // Get available images from the article's generated_images
  const availableImages = article?.generated_images?.filter((i) => i.success && i.publicUrl) || [];

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "var(--background)" }}>
        <svg className="progress-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--background)", minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--card-border)", background: "var(--background)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }} onClick={() => router.push("/app")}>
              <Image src="/logo.png" alt="Article Sauce" width={28} height={28} />
              <span style={{ fontWeight: 700, fontSize: 17 }}>Article Sauce</span>
            </div>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>/</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Publish to WordPress</span>
          </div>
          <button
            onClick={() => router.push("/app")}
            style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: "var(--card)", border: "1px solid var(--card-border)", cursor: "pointer" }}
          >
            Back to App
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {!article ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--error)" }}>{error || "Article not found"}</div>
        ) : publishResult ? (
          /* Success state */
          <div style={{ maxWidth: 500, margin: "0 auto", textAlign: "center", paddingTop: 40 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(52, 199, 89, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
              Published{postStatus === "draft" ? " as Draft" : ""}!
            </h1>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: publishResult.imageErrors ? 12 : 24 }}>
              &quot;{article.title}&quot; has been sent to your WordPress site.
              {publishResult.imagesUploaded ? ` ${publishResult.imagesUploaded} image${publishResult.imagesUploaded > 1 ? "s" : ""} uploaded.` : ""}
            </p>
            {publishResult.imageErrors && publishResult.imageErrors.length > 0 && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239, 168, 68, 0.1)", color: "#b45309", fontSize: 13, marginBottom: 24, textAlign: "left", maxWidth: 400, margin: "0 auto 24px" }}>
                <strong>Some images failed to upload:</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {publishResult.imageErrors.map((err, i) => (
                    <li key={i} style={{ fontSize: 12, marginBottom: 2 }}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <a
                href={publishResult.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: "10px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600, background: "var(--accent)", color: "#fff", textDecoration: "none", display: "inline-block" }}
              >
                View Post
              </a>
              <a
                href={publishResult.editUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: "10px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600, background: "var(--card)", border: "1px solid var(--card-border)", color: "var(--foreground)", textDecoration: "none", display: "inline-block" }}
              >
                Edit in WordPress
              </a>
            </div>
            <button
              onClick={() => router.push("/app")}
              style={{ marginTop: 20, padding: "8px 16px", borderRadius: 8, fontSize: 13, background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer" }}
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 32, alignItems: "start" }}>
            {/* Article Preview */}
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{article.title || article.topic}</h1>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
                Slug: /{article.slug} &middot; {article.article_markdown?.split(/\s+/).length || 0} words
              </p>
              <div
                className="article-preview"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                  borderRadius: 12,
                  padding: "24px 28px",
                  maxHeight: "70vh",
                  overflow: "auto",
                  fontSize: 14,
                  lineHeight: 1.7,
                }}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>

            {/* Publish Controls */}
            <div style={{ position: "sticky", top: 80 }}>
              {!wpConnected ? (
                <div style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No Blog Connected</h3>
                  <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
                    Connect a WordPress blog in Settings to enable publishing.
                  </p>
                  <button
                    onClick={() => router.push("/app/settings")}
                    style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}
                  >
                    Go to Settings
                  </button>
                </div>
              ) : (
                <div style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 12, overflow: "hidden" }}>
                  {/* Blog Selector */}
                  {wpBlogs.length > 1 && (
                    <div style={{ padding: "20px 20px 0" }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Blog</h3>
                      <select
                        value={activeBlogId}
                        onChange={async (e) => {
                          const newBlogId = e.target.value;
                          setActiveBlogId(newBlogId);
                          setCategories([]);
                          setSelectedCategories([]);
                          try {
                            const res = await fetch(`/api/wordpress/categories?blogId=${newBlogId}`);
                            const data = await res.json();
                            if (data.categories) setCategories(data.categories);
                          } catch { /* ignore */ }
                        }}
                        style={{
                          width: "100%", padding: "8px 12px", borderRadius: 8,
                          border: "1px solid var(--card-border)", background: "var(--background)",
                          fontSize: 13, fontWeight: 500, outline: "none",
                        }}
                      >
                        {wpBlogs.map((b) => (
                          <option key={b.id} value={b.id}>{b.name || b.url}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {wpBlogs.length === 1 && (
                    <div style={{ padding: "16px 20px 0", fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>
                      Publishing to <strong style={{ color: "var(--foreground)" }}>{wpBlogs[0].name || wpBlogs[0].url}</strong>
                    </div>
                  )}

                  {/* Post Status */}
                  <div style={{ padding: "20px 20px 0" }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Post Status</h3>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["draft", "publish"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setPostStatus(s)}
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            border: "1px solid",
                            borderColor: postStatus === s ? "var(--accent)" : "var(--card-border)",
                            background: postStatus === s ? "var(--accent)" : "var(--background)",
                            color: postStatus === s ? "#fff" : "var(--foreground)",
                            cursor: "pointer",
                            textTransform: "capitalize",
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Categories */}
                  <div style={{ padding: "20px" }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Categories</h3>
                    <div style={{ maxHeight: 200, overflow: "auto", marginBottom: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                      {categories.map((cat) => (
                        <label
                          key={cat.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 10px",
                            borderRadius: 8,
                            cursor: "pointer",
                            background: selectedCategories.includes(cat.id) ? "rgba(0,0,0,0.04)" : "transparent",
                            fontSize: 13,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(cat.id)}
                            onChange={() => toggleCategory(cat.id)}
                            style={{ accentColor: "var(--accent)" }}
                          />
                          <span style={{ fontWeight: 500 }}>{cat.name}</span>
                          <span style={{ color: "var(--muted)", fontSize: 11, marginLeft: "auto" }}>{cat.count}</span>
                        </label>
                      ))}
                      {categories.length === 0 && (
                        <p style={{ fontSize: 13, color: "var(--muted)", padding: "8px 0" }}>No categories found</p>
                      )}
                    </div>

                    {/* Create category */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        placeholder="New category name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); }}
                        style={{
                          flex: 1,
                          padding: "7px 12px",
                          borderRadius: 8,
                          border: "1px solid var(--card-border)",
                          background: "var(--background)",
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={handleCreateCategory}
                        disabled={creatingCategory || !newCategoryName.trim()}
                        style={{
                          padding: "7px 14px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          background: "var(--accent)",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                          opacity: creatingCategory || !newCategoryName.trim() ? 0.5 : 1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {creatingCategory ? "..." : "Add"}
                      </button>
                    </div>
                  </div>

                  {/* AI Images */}
                  {availableImages.length > 0 && (
                    <div style={{ padding: "0 20px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700 }}>AI Images ({availableImages.length})</h3>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                          <span style={{ color: "var(--muted)" }}>Include</span>
                          <div
                            onClick={() => setIncludeImages(!includeImages)}
                            style={{
                              width: 36,
                              height: 20,
                              borderRadius: 10,
                              background: includeImages ? "var(--accent)" : "var(--card-border)",
                              position: "relative",
                              cursor: "pointer",
                              transition: "background 0.2s",
                            }}
                          >
                            <div
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: "50%",
                                background: "#fff",
                                position: "absolute",
                                top: 2,
                                left: includeImages ? 18 : 2,
                                transition: "left 0.2s",
                              }}
                            />
                          </div>
                        </label>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, opacity: includeImages ? 1 : 0.4, transition: "opacity 0.2s" }}>
                        {availableImages.map((img, idx) => (
                          <div key={idx} style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--card-border)", position: "relative" }}>
                            <img
                              src={img.publicUrl}
                              alt={img.altText}
                              style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }}
                            />
                            <div style={{ padding: "4px 6px", fontSize: 10, color: "var(--muted)", background: "var(--background)" }}>
                              {img.type}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div style={{ padding: "0 20px 16px" }}>
                      <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239, 68, 68, 0.1)", color: "var(--error)", fontSize: 13 }}>
                        {error}
                      </div>
                    </div>
                  )}

                  {/* Publish Button */}
                  <div style={{ padding: "0 20px 20px" }}>
                    <button
                      onClick={handlePublish}
                      disabled={publishing}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: 10,
                        fontSize: 14,
                        fontWeight: 700,
                        background: postStatus === "publish" ? "var(--success)" : "var(--accent)",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                        opacity: publishing ? 0.6 : 1,
                      }}
                    >
                      {publishing
                        ? "Publishing..."
                        : postStatus === "publish"
                        ? "Publish to WordPress"
                        : "Save as Draft in WordPress"}
                    </button>
                    <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 8 }}>
                      {selectedCategories.length === 0
                        ? "No categories selected (will use default)"
                        : `${selectedCategories.length} categor${selectedCategories.length === 1 ? "y" : "ies"} selected`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
