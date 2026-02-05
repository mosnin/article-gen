"use client";

import { useState, useCallback } from "react";

interface ImagePrompt {
  type: string;
  prompt: string;
  altText: string;
}

interface GenerationResult {
  title: string;
  metaDescription: string;
  slug: string;
  focusKeyword: string;
  keywords: string[];
  article: string;
  imagePrompts: ImagePrompt[];
}

const STEPS = [
  "Organizing context & researching facts...",
  "Generating SEO metadata...",
  "Writing article & creating image prompts...",
];

async function safeFetch(url: string, body: object): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let data: Record<string, unknown>;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    if (text.includes("FUNCTION_INVOCATION_TIMEOUT") || text.includes("Task timed out")) {
      throw new Error("Request timed out. Please try again with a simpler topic.");
    }
    throw new Error(res.ok ? "Unexpected response from server" : `Server error (${res.status}): ${text.slice(0, 100)}`);
  }

  if (!res.ok) {
    throw new Error((data.error as string) || `Request failed (${res.status})`);
  }

  return { ok: true, data };
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200"
      style={{
        background: copied ? "var(--success)" : "var(--accent)",
        color: "#fff",
        opacity: copied ? 1 : 0.9,
      }}
      onMouseEnter={(e) => {
        if (!copied)
          (e.currentTarget as HTMLButtonElement).style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        if (!copied)
          (e.currentTarget as HTMLButtonElement).style.opacity = "0.9";
      }}
    >
      {copied ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {label || "Copy"}
        </>
      )}
    </button>
  );
}

function OutputCard({
  label,
  content,
  large,
}: {
  label: string;
  content: string;
  large?: boolean;
}) {
  return (
    <div
      className="rounded-xl border"
      style={{
        background: "var(--card)",
        borderColor: "var(--card-border)",
      }}
    >
      <div
        className="flex items-center justify-between border-b px-5 py-3"
        style={{ borderColor: "var(--card-border)" }}
      >
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          {label}
        </h3>
        <CopyButton text={content} />
      </div>
      <div className={`px-5 py-4 ${large ? "max-h-[600px] overflow-y-auto" : ""}`}>
        {large ? (
          <pre
            className="whitespace-pre-wrap text-sm leading-relaxed"
            style={{ color: "var(--foreground)", fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace" }}
          >
            {content}
          </pre>
        ) : (
          <p className="text-base leading-relaxed" style={{ color: "var(--foreground)" }}>
            {content}
          </p>
        )}
      </div>
    </div>
  );
}

function ImagePromptCard({ image }: { image: ImagePrompt }) {
  return (
    <div
      className="rounded-xl border"
      style={{
        background: "var(--card)",
        borderColor: "var(--card-border)",
      }}
    >
      <div
        className="flex items-center justify-between border-b px-5 py-3"
        style={{ borderColor: "var(--card-border)" }}
      >
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          {image.type}
        </h3>
      </div>
      <div className="space-y-3 px-5 py-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--accent)" }}>
              Midjourney Prompt
            </span>
            <CopyButton text={image.prompt} label="Copy Prompt" />
          </div>
          <p
            className="rounded-lg p-3 text-sm leading-relaxed"
            style={{
              background: "var(--background)",
              color: "var(--foreground)",
            }}
          >
            {image.prompt}
          </p>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--accent)" }}>
              Alt Text
            </span>
            <CopyButton text={image.altText} label="Copy Alt Text" />
          </div>
          <p
            className="rounded-lg p-3 text-sm leading-relaxed"
            style={{
              background: "var(--background)",
              color: "var(--foreground)",
            }}
          >
            {image.altText}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [topic, setTopic] = useState("");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("Please enter a topic for your article.");
      return;
    }

    // Reset everything for fresh context
    setError("");
    setResult(null);
    setLoading(true);
    setCurrentStep(0);

    try {
      // Batch 1: Context + Research (parallel inside the route)
      setCurrentStep(0);
      const { data: researchData } = await safeFetch("/api/generate/research", {
        topic: topic.trim(),
        focusKeyword: focusKeyword.trim() || undefined,
      });

      // Batch 2: Metadata
      setCurrentStep(1);
      const { data: metadataData } = await safeFetch("/api/generate/metadata", {
        topic: topic.trim(),
        focusKeyword: focusKeyword.trim() || undefined,
        articleContext: researchData.articleContext,
        researchContext: researchData.researchContext,
      });

      const allKeywords = [
        metadataData.focusKeyword as string,
        ...((metadataData.keywords as string[]) || []),
      ];

      // Batch 3: Article + Images (parallel inside the route)
      setCurrentStep(2);
      const { data: articleData } = await safeFetch("/api/generate/article", {
        topic: topic.trim(),
        articleContext: researchData.articleContext,
        researchContext: researchData.researchContext,
        title: metadataData.title,
        metaDescription: metadataData.metaDescription,
        focusKeyword: metadataData.focusKeyword,
        allKeywords,
      });

      setResult({
        title: metadataData.title as string,
        metaDescription: metadataData.metaDescription as string,
        slug: metadataData.slug as string,
        focusKeyword: metadataData.focusKeyword as string,
        keywords: (metadataData.keywords as string[]) || [],
        article: articleData.article as string,
        imagePrompts: articleData.imagePrompts as ImagePrompt[],
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTopic("");
    setFocusKeyword("");
    setResult(null);
    setError("");
    setCurrentStep(0);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: "var(--card-border)" }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <h1 className="gradient-text text-2xl font-bold tracking-tight">
            Article Gen
          </h1>
          {(result || error) && !loading && (
            <button
              onClick={handleReset}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={{
                border: "1px solid var(--card-border)",
                color: "var(--foreground)",
                background: "transparent",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--card)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              New Article
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Input Form */}
        {!result && !loading && (
          <div className="mx-auto max-w-xl">
            <div className="mb-10 text-center">
              <h2 className="mb-3 text-4xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
                Generate SEO Articles
              </h2>
              <p className="text-lg" style={{ color: "var(--muted)" }}>
                Enter your topic and get a complete, 4000-word SEO-optimized
                article with metadata and image prompts.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="topic"
                  className="mb-2 block text-sm font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  What should your article be about?
                </label>
                <textarea
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., The Ultimate Guide to Indoor Herb Gardening for Beginners"
                  rows={3}
                  className="w-full resize-none rounded-xl border px-4 py-3 text-base transition-colors focus:outline-none"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--card-border)",
                    color: "var(--foreground)",
                  }}
                  onFocus={(e) => {
                    (e.target as HTMLTextAreaElement).style.borderColor = "var(--accent)";
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLTextAreaElement).style.borderColor = "var(--card-border)";
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="keyword"
                  className="mb-2 block text-sm font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  Focus Keyword{" "}
                  <span style={{ color: "var(--muted)", opacity: 0.6 }}>
                    (optional)
                  </span>
                </label>
                <input
                  id="keyword"
                  type="text"
                  value={focusKeyword}
                  onChange={(e) => setFocusKeyword(e.target.value)}
                  placeholder="e.g., indoor herb gardening"
                  className="w-full rounded-xl border px-4 py-3 text-base transition-colors focus:outline-none"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--card-border)",
                    color: "var(--foreground)",
                  }}
                  onFocus={(e) => {
                    (e.target as HTMLInputElement).style.borderColor = "var(--accent)";
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLInputElement).style.borderColor = "var(--card-border)";
                  }}
                />
              </div>

              {error && (
                <div
                  className="rounded-xl border px-4 py-3 text-sm"
                  style={{
                    borderColor: "var(--error)",
                    background: "rgba(239, 68, 68, 0.1)",
                    color: "var(--error)",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full rounded-xl py-3.5 text-base font-semibold text-white transition-all duration-200"
                style={{
                  background: "var(--accent)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-hover)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--accent)";
                }}
              >
                Generate Article
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-8 flex gap-2">
              <div className="loading-dot h-3 w-3 rounded-full" style={{ background: "var(--accent)" }} />
              <div className="loading-dot h-3 w-3 rounded-full" style={{ background: "var(--accent)" }} />
              <div className="loading-dot h-3 w-3 rounded-full" style={{ background: "var(--accent)" }} />
            </div>
            <div className="space-y-3 text-center">
              {STEPS.map((step, i) => (
                <p
                  key={step}
                  className="text-sm font-medium transition-all duration-500"
                  style={{
                    color:
                      i === currentStep
                        ? "var(--accent)"
                        : i < currentStep
                        ? "var(--success)"
                        : "var(--muted)",
                    opacity: i <= currentStep ? 1 : 0.4,
                  }}
                >
                  {i < currentStep ? "\u2713 " : i === currentStep ? "\u25CB " : "  "}
                  {step}
                </p>
              ))}
            </div>
            <p className="mt-8 text-xs" style={{ color: "var(--muted)" }}>
              This may take a couple of minutes...
            </p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            <div className="mb-8">
              <h2 className="mb-1 text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                Generated Article
              </h2>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Focus: <span style={{ color: "var(--accent)" }}>{result.focusKeyword}</span>
                {result.keywords.length > 0 && (
                  <>
                    {" | "}Keywords:{" "}
                    {result.keywords.map((kw, i) => (
                      <span key={kw}>
                        <span style={{ color: "var(--accent)" }}>{kw}</span>
                        {i < result.keywords.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </>
                )}
              </p>
            </div>

            <OutputCard label="Title" content={result.title} />
            <OutputCard label="Meta Description" content={result.metaDescription} />
            <OutputCard label="Slug" content={result.slug} />
            <OutputCard label="Article (Markdown)" content={result.article} large />

            <div>
              <h3
                className="mb-4 text-lg font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                Midjourney Image Prompts
              </h3>
              <div className="space-y-4">
                {result.imagePrompts.map((image, i) => (
                  <ImagePromptCard key={i} image={image} />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t py-6 text-center" style={{ borderColor: "var(--card-border)" }}>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Article Gen &mdash; AI-Powered SEO Article Generator
        </p>
      </footer>
    </div>
  );
}
