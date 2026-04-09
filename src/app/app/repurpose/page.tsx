"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { PageHeader } from "@/components/layout/page-header";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Article {
  id: string;
  title: string;
  topic: string;
  content: string | null;
}

interface SocialResult {
  twitter: { thread: string[]; singleTweet: string };
  linkedin: { post: string };
  instagram: { caption: string; hashtags: string[] };
  facebook: { post: string };
}

interface NewsletterResult {
  subject: string;
  previewText: string;
  htmlContent: string;
  plainText: string;
}

type Tab = "social" | "newsletter";
type SocialPlatform = "twitter" | "linkedin" | "instagram";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] transition-colors"
    >
      {copied ? (
        <>
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-green-500">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

function OutputBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{label}</span>
        <CopyButton text={text} />
      </div>
      <textarea
        readOnly
        value={text}
        rows={Math.min(Math.max(text.split("\n").length + 1, 3), 12)}
        className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2.5 text-sm text-[var(--text-primary)] font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Social Media Tab
// ---------------------------------------------------------------------------

const SOCIAL_PLATFORMS: { key: SocialPlatform; label: string; icon: React.ReactNode }[] = [
  {
    key: "twitter",
    label: "Twitter / X Thread",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    key: "linkedin",
    label: "LinkedIn Post",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    key: "instagram",
    label: "Instagram Caption",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
];

function SocialTab({ articleId, articleContent }: { articleId: string; articleContent: string | null }) {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<SocialResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>("twitter");

  const generate = async (platform: SocialPlatform) => {
    setActivePlatform(platform);
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/repurpose/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, platform }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const data: SocialResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Platform buttons */}
      <div>
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Choose a platform to generate optimised content from your article.
        </p>
        <div className="flex flex-wrap gap-2">
          {SOCIAL_PLATFORMS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => generate(key)}
              disabled={generating}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                generating && activePlatform === key
                  ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
                  : "border-[var(--border-default)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] hover:bg-[var(--brand)]/5"
              }`}
            >
              {generating && activePlatform === key ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                icon
              )}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && !generating && (
        <div className="space-y-5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {SOCIAL_PLATFORMS.find(p => p.key === activePlatform)?.label} — Generated Output
            </h3>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
              Ready
            </span>
          </div>

          {activePlatform === "twitter" && (
            <div className="space-y-4">
              <OutputBlock
                label="Single Tweet"
                text={result.twitter.singleTweet}
              />
              {result.twitter.thread.length > 0 && (
                <OutputBlock
                  label={`Thread (${result.twitter.thread.length} tweets)`}
                  text={result.twitter.thread.map((t, i) => `${i + 1}/ ${t}`).join("\n\n")}
                />
              )}
            </div>
          )}

          {activePlatform === "linkedin" && (
            <OutputBlock label="LinkedIn Post" text={result.linkedin.post} />
          )}

          {activePlatform === "instagram" && (
            <div className="space-y-4">
              <OutputBlock label="Caption" text={result.instagram.caption} />
              {result.instagram.hashtags.length > 0 && (
                <OutputBlock
                  label="Hashtags"
                  text={result.instagram.hashtags.map(h => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Newsletter Tab
// ---------------------------------------------------------------------------

function NewsletterTab({ articleId }: { articleId: string }) {
  const [authorName, setAuthorName] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<NewsletterResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeOutput, setActiveOutput] = useState<"html" | "plain">("plain");

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/repurpose/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, authorName, ctaText, ctaUrl }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const data: NewsletterResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--text-secondary)]">
        Fill in the optional details below, then generate a ready-to-send newsletter from your article.
      </p>

      {/* Fields */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
            Author Name
          </label>
          <input
            type="text"
            placeholder="e.g. Jane Smith"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
            CTA Text
          </label>
          <input
            type="text"
            placeholder="e.g. Read the full article"
            value={ctaText}
            onChange={(e) => setCtaText(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
            CTA URL
          </label>
          <input
            type="url"
            placeholder="https://yourblog.com/article"
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
          />
        </div>
      </div>

      {/* Generate button */}
      <div>
        <button
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating…
            </>
          ) : (
            <>
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              Generate Newsletter
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && !generating && (
        <div className="space-y-5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Newsletter — Generated Output</h3>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
              Ready
            </span>
          </div>

          {/* Subject + preview */}
          <div className="grid gap-4 sm:grid-cols-2">
            <OutputBlock label="Subject Line" text={result.subject} />
            <OutputBlock label="Preview Text" text={result.previewText} />
          </div>

          {/* Toggle: plain / html */}
          <div>
            <div className="mb-3 flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] p-1 w-fit">
              {(["plain", "html"] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setActiveOutput(view)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    activeOutput === view
                      ? "bg-[var(--surface-base)] text-[var(--text-primary)] shadow-sm"
                      : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {view === "plain" ? "Plain Text" : "HTML"}
                </button>
              ))}
            </div>

            {activeOutput === "plain" && (
              <OutputBlock label="Plain Text Body" text={result.plainText} />
            )}
            {activeOutput === "html" && (
              <OutputBlock label="HTML Body" text={result.htmlContent} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function RepurposePage() {
  const router = useRouter();
  const supabase = createClient();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("social");

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }

      const { data } = await supabase
        .from("articles")
        .select("id, title, topic, content")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const items = data ?? [];
      setArticles(items);
      if (items.length > 0) setSelectedId(items[0].id);
      setLoadingArticles(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedArticle = articles.find((a) => a.id === selectedId) ?? null;

  const TABS: { key: Tab; label: string }[] = [
    { key: "social", label: "Social Media" },
    { key: "newsletter", label: "Newsletter" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repurpose Content"
        description="Turn your articles into social media posts and newsletters in one click."
      />

      {/* Article selector */}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-2">
          Select Article
        </label>
        {loadingArticles ? (
          <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--surface-sunken)]" />
        ) : articles.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">
            No articles found.{" "}
            <a href="/app/generate" className="font-medium text-[var(--brand)] hover:underline">
              Generate your first article
            </a>{" "}
            to get started.
          </p>
        ) : (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
          >
            {articles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title || a.topic}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tabs + content */}
      {selectedArticle && (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-[var(--border-default)]">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  tab === key
                    ? "border-[var(--brand)] text-[var(--brand)] bg-[var(--brand)]/5"
                    : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">
            {tab === "social" && (
              <SocialTab
                articleId={selectedArticle.id}
                articleContent={selectedArticle.content}
              />
            )}
            {tab === "newsletter" && (
              <NewsletterTab articleId={selectedArticle.id} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
