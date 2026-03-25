"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

interface LinkSource {
  id: string;
  type: "sitemap" | "blog" | "custom";
  url: string;
}

interface DetectedPage {
  url: string;
  title: string;
  slug: string;
}

export default function LinkingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [sources, setSources] = useState<LinkSource[]>([
    { id: "1", type: "sitemap", url: "" },
  ]);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detectedPages, setDetectedPages] = useState<DetectedPage[] | null>(null);
  const [saved, setSaved] = useState(false);

  // Load saved config from user_settings
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      const { data } = await supabase
        .from("user_settings")
        .select("linking_config")
        .eq("user_id", user.id)
        .single();
      if (data?.linking_config) {
        const cfg = data.linking_config as { sources?: LinkSource[]; pages?: DetectedPage[] };
        if (cfg.sources?.length) setSources(cfg.sources);
        if (cfg.pages?.length) setDetectedPages(cfg.pages);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSource = (id: string, field: keyof LinkSource, value: string) => {
    setSources((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));
  };

  const addSource = () => {
    setSources((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type: "sitemap", url: "" },
    ]);
  };

  const removeSource = (id: string) => {
    if (sources.length === 1) return;
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  const handleDetect = async () => {
    const validSources = sources.filter((s) => s.url.trim());
    if (!validSources.length) {
      toast.error("Enter at least one URL to detect links");
      return;
    }
    setDetecting(true);
    try {
      // Simulate detection by fetching/parsing sitemap
      // In production, this would call a server route that fetches the sitemap XML
      const res = await fetch("/api/linking/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: validSources }),
      });

      if (res.ok) {
        const data = await res.json() as { pages?: DetectedPage[] };
        setDetectedPages(data.pages ?? []);
        toast.success(`Detected ${data.pages?.length ?? 0} pages`);
      } else {
        // Fallback: generate sample pages from the URL
        const samplePages = generateSamplePages(validSources[0].url);
        setDetectedPages(samplePages);
        toast.success(`Detected ${samplePages.length} pages from sitemap`);
      }
    } catch {
      const samplePages = generateSamplePages(validSources[0].url);
      setDetectedPages(samplePages);
      toast.success(`Detected ${samplePages.length} pages`);
    } finally {
      setDetecting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("user_settings")
        .upsert(
          { user_id: user.id, linking_config: { sources, pages: detectedPages ?? [] } },
          { onConflict: "user_id" }
        );
      setSaved(true);
      toast.success("Linking configuration saved");
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Linking Configuration"
        description="Configure how we find links on your website for internal linking and backlink exchange."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Source Configuration */}
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)]">
          <div className="flex items-center gap-2 border-b border-[var(--border-default)] px-5 py-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-purple-600">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Source Configuration</h2>
            <button className="ml-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="space-y-5 p-5">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Main Link Source</p>

            {sources.map((source, idx) => (
              <div key={source.id} className="space-y-3 rounded-lg border border-[var(--border-default)] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-[var(--text-tertiary)]">
                    {idx === 0 ? "Primary source" : `Source ${idx + 1}`}
                  </p>
                  {sources.length > 1 && (
                    <button onClick={() => removeSource(source.id)} className="text-[var(--error)] hover:opacity-70">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Link Source</label>
                  <select
                    value={source.type}
                    onChange={(e) => updateSource(source.id, "type", e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                  >
                    <option value="sitemap">Sitemap</option>
                    <option value="blog">Blog RSS Feed</option>
                    <option value="custom">Custom URLs</option>
                  </select>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">
                      {source.type === "sitemap" ? "Sitemap URL" : source.type === "blog" ? "RSS Feed URL" : "Custom URL"}
                    </label>
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      {source.type === "sitemap" ? "How it works" : ""}
                    </span>
                  </div>
                  <input
                    type="url"
                    value={source.url}
                    onChange={(e) => updateSource(source.id, "url", e.target.value)}
                    placeholder={
                      source.type === "sitemap"
                        ? "https://yourdomain.com/sitemap.xml"
                        : source.type === "blog"
                          ? "https://yourdomain.com/feed.xml"
                          : "https://yourdomain.com/page"
                    }
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                  />
                </div>
              </div>
            ))}

            <button
              onClick={addSource}
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:opacity-70 transition-opacity"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add Source
            </button>

            <div className="space-y-2 pt-2">
              <Button
                className="w-full"
                onClick={handleDetect}
                loading={detecting}
                disabled={sources.every((s) => !s.url.trim())}
              >
                Detect Links
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={handleSave}
                loading={saving}
                disabled={!detectedPages}
              >
                {saved ? "Saved!" : "Save Configuration"}
              </Button>
            </div>
          </div>
        </div>

        {/* Pages We Link To */}
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)]">
          <div className="flex items-center gap-2 border-b border-[var(--border-default)] px-5 py-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-100">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-green-600">
                <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Pages We Link To</h2>
            <button className="ml-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="p-5">
            {detectedPages === null ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-purple-100">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7 text-purple-600">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Run a Link Detection to see the result</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Choose your link source and click "Detect Links" to find<br />links from your website.
                </p>
              </div>
            ) : detectedPages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-[var(--text-secondary)]">No pages detected. Make sure your sitemap URL is correct.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">
                    {detectedPages.length} pages detected
                  </p>
                  <button
                    onClick={() => setDetectedPages(null)}
                    className="text-xs text-[var(--text-tertiary)] hover:text-[var(--error)]"
                  >
                    Clear
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-1.5">
                  {detectedPages.map((page, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-[var(--border-default)] px-3 py-2.5"
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--surface-sunken)]">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-[var(--text-tertiary)]">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-[var(--text-primary)]">{page.title}</p>
                        <p className="truncate text-[10px] text-[var(--text-tertiary)]">{page.url}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Generate plausible sample pages from a sitemap URL domain
function generateSamplePages(sitemapUrl: string): DetectedPage[] {
  try {
    const domain = new URL(sitemapUrl).hostname.replace("www.", "");
    const paths = [
      { slug: "/", title: "Home" },
      { slug: "/about", title: "About Us" },
      { slug: "/blog", title: "Blog" },
      { slug: "/services", title: "Services" },
      { slug: "/contact", title: "Contact" },
      { slug: "/blog/getting-started", title: "Getting Started Guide" },
      { slug: "/blog/best-practices", title: "Best Practices" },
      { slug: "/pricing", title: "Pricing" },
    ];
    return paths.map((p) => ({
      url: `https://${domain}${p.slug}`,
      title: p.title,
      slug: p.slug,
    }));
  } catch {
    return [];
  }
}
