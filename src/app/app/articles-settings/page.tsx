"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TabId = "articles" | "blog";

interface ArticleSettings {
  autoPublish: boolean;
  autoKeywordGeneration: boolean;
  articleStyle: string;
  internalLinks: string;
  globalInstructions: string;
  brandColor: string;
}

interface BlogSettings {
  sitemapUrl: string;
  blogUrl: string;
  exampleArticleUrl1: string;
  exampleArticleUrl2: string;
  exampleArticleUrl3: string;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2",
        checked ? "bg-[var(--accent)]" : "bg-[var(--border-default)]"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

export default function ArticlesSettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<TabId>("articles");
  const [saving, setSaving] = useState(false);

  const [articleSettings, setArticleSettings] = useState<ArticleSettings>({
    autoPublish: false,
    autoKeywordGeneration: true,
    articleStyle: "Informative",
    internalLinks: "3 links per article",
    globalInstructions: "",
    brandColor: "#000000",
  });

  const [blogSettings, setBlogSettings] = useState<BlogSettings>({
    sitemapUrl: "",
    blogUrl: "",
    exampleArticleUrl1: "",
    exampleArticleUrl2: "",
    exampleArticleUrl3: "",
  });

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const { data } = await supabase
        .from("user_settings")
        .select("article_settings, blog_settings")
        .eq("user_id", user.id)
        .single();

      if (data?.article_settings) {
        setArticleSettings((prev) => ({ ...prev, ...(data.article_settings as Partial<ArticleSettings>) }));
      }
      if (data?.blog_settings) {
        setBlogSettings((prev) => ({ ...prev, ...(data.blog_settings as Partial<BlogSettings>) }));
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: user.id,
            article_settings: articleSettings,
            blog_settings: blogSettings,
          },
          { onConflict: "user_id" }
        );
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const updateArticle = <K extends keyof ArticleSettings>(key: K, val: ArticleSettings[K]) => {
    setArticleSettings((prev) => ({ ...prev, [key]: val }));
  };

  const updateBlog = <K extends keyof BlogSettings>(key: K, val: BlogSettings[K]) => {
    setBlogSettings((prev) => ({ ...prev, [key]: val }));
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "articles", label: "Articles" },
    { id: "blog", label: "Blog" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Tab switcher */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-md px-5 py-1.5 text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-[var(--surface-base)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "articles" && (
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Configure your article preferences</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Set your preferences once to ensure all future articles maintain your quality standards and brand consistency
            </p>
          </div>

          {/* Content & SEO */}
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] overflow-hidden">
            <div className="border-b border-[var(--border-default)] px-5 py-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Content & SEO</h2>
            </div>
            <div className="divide-y divide-[var(--border-default)]">
              {/* Auto-publish */}
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">Auto-publish</p>
                  <p className="text-xs text-[var(--text-secondary)]">Publish new articles automatically</p>
                </div>
                <Toggle
                  checked={articleSettings.autoPublish}
                  onChange={(v) => updateArticle("autoPublish", v)}
                />
              </div>

              {/* Auto keyword generation */}
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">Automatic Keyword Generation</p>
                  <p className="text-xs text-[var(--text-secondary)]">Automatically maintains 25–30 keywords in your content planner</p>
                </div>
                <Toggle
                  checked={articleSettings.autoKeywordGeneration}
                  onChange={(v) => updateArticle("autoKeywordGeneration", v)}
                />
              </div>

              {/* Article Style + Internal Links */}
              <div className="grid grid-cols-2 gap-4 px-5 py-4">
                <div>
                  <div className="mb-1.5 flex items-center gap-1">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">Article Style</label>
                    <button className="text-[var(--text-tertiary)]">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  <select
                    value={articleSettings.articleStyle}
                    onChange={(e) => updateArticle("articleStyle", e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    {["Informative", "Conversational", "Professional", "Educational", "Persuasive", "Storytelling"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center gap-1">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">Internal Links</label>
                    <button className="text-[var(--text-tertiary)]">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  <select
                    value={articleSettings.internalLinks}
                    onChange={(e) => updateArticle("internalLinks", e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    {["No internal links", "1 link per article", "2 links per article", "3 links per article", "5 links per article", "Auto"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="px-5 py-3">
                <button className="text-xs text-[var(--accent)] hover:underline">
                  Finetune with your articles →
                </button>
              </div>

              {/* Global Instructions */}
              <div className="px-5 py-4">
                <div className="mb-1.5 flex items-center gap-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Global Article Instructions</label>
                  <button className="text-[var(--text-tertiary)]">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={articleSettings.globalInstructions}
                  onChange={(e) => updateArticle("globalInstructions", e.target.value)}
                  placeholder="Enter global instructions for all articles (e.g., 'Always include practical examples', 'Focus on actionable insights')..."
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
                />
              </div>
            </div>
          </div>

          {/* Engagement */}
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] overflow-hidden">
            <div className="border-b border-[var(--border-default)] px-5 py-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Engagement</h2>
            </div>
            <div className="px-5 py-4">
              <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">Brand Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={articleSettings.brandColor}
                  onChange={(e) => updateArticle("brandColor", e.target.value)}
                  className="h-9 w-9 cursor-pointer rounded-lg border border-[var(--border-default)] p-0.5"
                />
                <input
                  type="text"
                  value={articleSettings.brandColor}
                  onChange={(e) => updateArticle("brandColor", e.target.value)}
                  className="w-40 rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  placeholder="#000000"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "blog" && (
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Content details</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Share your content details to help us create more relevant and targeted blog posts for your audience
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] overflow-hidden">
            <div className="divide-y divide-[var(--border-default)]">
              {/* Sitemap URL */}
              <div className="px-5 py-4">
                <div className="mb-1.5 flex items-center gap-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Sitemap URL</label>
                  <button className="text-[var(--text-tertiary)]">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <input
                  type="url"
                  value={blogSettings.sitemapUrl}
                  onChange={(e) => updateBlog("sitemapUrl", e.target.value)}
                  placeholder="https://yourdomain.com/sitemap.xml"
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>

              {/* Main blog address */}
              <div className="px-5 py-4">
                <div className="mb-1.5 flex items-center gap-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Main blog address</label>
                  <button className="text-[var(--text-tertiary)]">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <input
                  type="url"
                  value={blogSettings.blogUrl}
                  onChange={(e) => updateBlog("blogUrl", e.target.value)}
                  placeholder="https://yourblog.com/blog"
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>

              {/* Example article URLs */}
              <div className="px-5 py-4">
                <div className="mb-1.5 flex items-center gap-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Your best article examples URL</label>
                  <button className="text-[var(--text-tertiary)]">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-2">
                  {[
                    { key: "exampleArticleUrl1" as const, placeholder: "Your top article URL #1" },
                    { key: "exampleArticleUrl2" as const, placeholder: "Your top article URL #2" },
                    { key: "exampleArticleUrl3" as const, placeholder: "Your top article URL #3" },
                  ].map((field) => (
                    <input
                      key={field.key}
                      type="url"
                      value={blogSettings[field.key]}
                      onChange={(e) => updateBlog(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving} className="px-8">
          Save
        </Button>
      </div>
    </div>
  );
}
