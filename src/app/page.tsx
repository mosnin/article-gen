"use client";

import { useState, useCallback, useRef } from "react";

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

interface ArticleSession {
  id: string;
  topic: string;
  focusKeyword: string;
  loading: boolean;
  queued: boolean;
  error: string;
  result: GenerationResult | null;
  currentStep: number;
  quality: "standard" | "premium";
}

interface BatchQueueItem {
  id: string;
  topic: string;
  focusKeyword: string | undefined;
  quality: "standard" | "premium";
}

const STEPS = [
  "Organizing context & researching facts...",
  "Generating SEO metadata...",
  "Writing article & creating image prompts...",
];

const STEP_LABELS = ["Researching...", "Metadata...", "Writing..."];

async function safeFetch(
  url: string,
  body: object
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
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
    if (
      text.includes("FUNCTION_INVOCATION_TIMEOUT") ||
      text.includes("Task timed out")
    ) {
      throw new Error(
        "Request timed out. Please try again with a simpler topic."
      );
    }
    throw new Error(
      res.ok
        ? "Unexpected response from server"
        : `Server error (${res.status}): ${text.slice(0, 100)}`
    );
  }

  if (!res.ok) {
    throw new Error(
      (data.error as string) || `Request failed (${res.status})`
    );
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
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--muted)" }}
        >
          {label}
        </h3>
        <CopyButton text={content} />
      </div>
      <div
        className={`px-5 py-4 ${large ? "max-h-[600px] overflow-y-auto" : ""}`}
      >
        {large ? (
          <pre
            className="whitespace-pre-wrap text-sm leading-relaxed"
            style={{
              color: "var(--foreground)",
              fontFamily:
                "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace",
            }}
          >
            {content}
          </pre>
        ) : (
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--foreground)" }}
          >
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
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--muted)" }}
        >
          {image.type}
        </h3>
      </div>
      <div className="space-y-3 px-5 py-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--accent)" }}
            >
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
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--accent)" }}
            >
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
  const [sessions, setSessions] = useState<ArticleSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formTopic, setFormTopic] = useState("");
  const [formKeyword, setFormKeyword] = useState("");
  const [formError, setFormError] = useState("");

  // Mode & batch state
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [batchQuality, setBatchQuality] = useState<"standard" | "premium">(
    "premium"
  );
  const [batchItems, setBatchItems] = useState<
    Array<{ id: string; topic: string; keyword: string }>
  >([{ id: crypto.randomUUID(), topic: "", keyword: "" }]);
  const [batchCountdown, setBatchCountdown] = useState(0);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const batchQueueRef = useRef<BatchQueueItem[]>([]);
  const batchRunningRef = useRef(false);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || null;

  const updateSession = useCallback(
    (id: string, updates: Partial<ArticleSession>) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
      );
    },
    []
  );

  const runGeneration = useCallback(
    async (
      id: string,
      topic: string,
      focusKeyword: string | undefined,
      quality: "standard" | "premium" = "premium"
    ) => {
      try {
        // Batch 1: Context + Research (parallel inside the route)
        const { data: researchData } = await safeFetch(
          "/api/generate/research",
          { topic, focusKeyword }
        );

        updateSession(id, { currentStep: 1 });

        // Batch 2: Metadata
        const { data: metadataData } = await safeFetch(
          "/api/generate/metadata",
          {
            topic,
            focusKeyword,
            articleContext: researchData.articleContext,
            researchContext: researchData.researchContext,
          }
        );

        const allKeywords = [
          metadataData.focusKeyword as string,
          ...((metadataData.keywords as string[]) || []),
        ];

        updateSession(id, { currentStep: 2 });

        const targetWordCount = quality === "standard" ? 2000 : 4000;

        // Batch 3: Article + Images (parallel inside the route)
        const { data: articleData } = await safeFetch(
          "/api/generate/article",
          {
            topic,
            articleContext: researchData.articleContext,
            researchContext: researchData.researchContext,
            title: metadataData.title,
            metaDescription: metadataData.metaDescription,
            focusKeyword: metadataData.focusKeyword,
            allKeywords,
            targetWordCount,
          }
        );

        updateSession(id, {
          loading: false,
          result: {
            title: metadataData.title as string,
            metaDescription: metadataData.metaDescription as string,
            slug: metadataData.slug as string,
            focusKeyword: metadataData.focusKeyword as string,
            keywords: (metadataData.keywords as string[]) || [],
            article: articleData.article as string,
            imagePrompts: articleData.imagePrompts as ImagePrompt[],
          },
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        updateSession(id, { loading: false, error: message });
      }
    },
    [updateSession]
  );

  // Batch queue processor: 2 at a time, 60s between batches
  const processBatchQueue = useCallback(async () => {
    if (batchRunningRef.current) return;
    batchRunningRef.current = true;
    setBatchProcessing(true);

    while (batchQueueRef.current.length > 0) {
      const batch = batchQueueRef.current.splice(0, 2);

      batch.forEach((item) => {
        updateSession(item.id, { queued: false, loading: true });
      });

      await Promise.all(
        batch.map((item) =>
          runGeneration(item.id, item.topic, item.focusKeyword, item.quality)
        )
      );

      if (batchQueueRef.current.length > 0) {
        await new Promise<void>((resolve) => {
          let seconds = 60;
          setBatchCountdown(seconds);
          const timer = setInterval(() => {
            seconds--;
            setBatchCountdown(seconds);
            if (seconds <= 0) {
              clearInterval(timer);
              setBatchCountdown(0);
              resolve();
            }
          }, 1000);
        });
      }
    }

    batchRunningRef.current = false;
    setBatchProcessing(false);
  }, [updateSession, runGeneration]);

  const handleGenerate = () => {
    if (!formTopic.trim()) {
      setFormError("Please enter a topic for your article.");
      return;
    }

    const id = crypto.randomUUID();
    const topic = formTopic.trim();
    const focusKeyword = formKeyword.trim() || undefined;

    setSessions((prev) => [
      {
        id,
        topic,
        focusKeyword: formKeyword.trim(),
        loading: true,
        queued: false,
        error: "",
        result: null,
        currentStep: 0,
        quality: "premium",
      },
      ...prev,
    ]);
    setActiveSessionId(id);
    setFormTopic("");
    setFormKeyword("");
    setFormError("");
    setSidebarOpen(false);

    runGeneration(id, topic, focusKeyword, "premium");
  };

  const handleBatchGenerate = () => {
    const validItems = batchItems.filter((item) => item.topic.trim());
    if (validItems.length === 0) {
      setFormError("Please enter at least one topic.");
      return;
    }

    const newSessions: ArticleSession[] = validItems.map((item) => ({
      id: crypto.randomUUID(),
      topic: item.topic.trim(),
      focusKeyword: item.keyword.trim(),
      loading: false,
      queued: true,
      error: "",
      result: null,
      currentStep: 0,
      quality: batchQuality,
    }));

    setSessions((prev) => [...newSessions, ...prev]);
    setActiveSessionId(newSessions[0].id);

    batchQueueRef.current.push(
      ...newSessions.map((s) => ({
        id: s.id,
        topic: s.topic,
        focusKeyword: s.focusKeyword || undefined,
        quality: batchQuality,
      }))
    );

    setBatchItems([{ id: crypto.randomUUID(), topic: "", keyword: "" }]);
    setFormError("");
    setSidebarOpen(false);

    processBatchQueue();
  };

  const handleRetry = (session: ArticleSession) => {
    updateSession(session.id, {
      loading: true,
      queued: false,
      error: "",
      currentStep: 0,
      result: null,
    });
    runGeneration(
      session.id,
      session.topic,
      session.focusKeyword || undefined,
      session.quality
    );
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    batchQueueRef.current = batchQueueRef.current.filter(
      (item) => item.id !== id
    );
    if (activeSessionId === id) {
      setActiveSessionId(null);
    }
  };

  const addBatchItem = () => {
    if (batchItems.length >= 25) return;
    setBatchItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), topic: "", keyword: "" },
    ]);
  };

  const removeBatchItem = (id: string) => {
    setBatchItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateBatchItem = (
    id: string,
    field: "topic" | "keyword",
    value: string
  ) => {
    setBatchItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const showForm = activeSessionId === null;
  const loadingCount = sessions.filter((s) => s.loading).length;
  const queuedCount = sessions.filter((s) => s.queued).length;
  const validBatchCount = batchItems.filter((i) => i.topic.trim()).length;

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar-aside fixed z-50 flex h-full w-[280px] flex-col border-r transition-transform duration-300 md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "var(--sidebar-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-4"
          style={{ borderColor: "var(--card-border)" }}
        >
          <h1 className="gradient-text text-lg font-bold tracking-tight">
            Article Sauce
          </h1>
          <button
            className="rounded p-1 md:hidden"
            onClick={() => setSidebarOpen(false)}
            style={{ color: "var(--muted)" }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-3">
          <button
            onClick={() => {
              setActiveSessionId(null);
              setFormError("");
              setSidebarOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200"
            style={{ background: "var(--accent)", color: "#fff" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--accent-hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--accent)";
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Article
          </button>
        </div>

        {/* Batch progress banner */}
        {(batchProcessing || batchCountdown > 0) && (
          <div
            className="mx-3 mb-2 rounded-lg px-3 py-2 text-xs font-medium"
            style={{
              background: "var(--card)",
              borderColor: "var(--card-border)",
              color: "var(--foreground)",
            }}
          >
            {batchCountdown > 0 ? (
              <span>Next batch in {batchCountdown}s</span>
            ) : (
              <span>Processing batch...</span>
            )}
            {queuedCount > 0 && (
              <span style={{ color: "var(--muted)" }}>
                {" "}
                &middot; {queuedCount} queued
              </span>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {sessions.length === 0 ? (
            <p
              className="px-3 py-6 text-center text-xs"
              style={{ color: "var(--muted)" }}
            >
              No articles yet. Start generating!
            </p>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    setActiveSessionId(session.id);
                    setSidebarOpen(false);
                  }}
                  className="group flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors"
                  style={{
                    background:
                      activeSessionId === session.id
                        ? "var(--card)"
                        : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (activeSessionId !== session.id)
                      (
                        e.currentTarget as HTMLButtonElement
                      ).style.background = "rgba(0,0,0,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    if (activeSessionId !== session.id)
                      (
                        e.currentTarget as HTMLButtonElement
                      ).style.background = "transparent";
                  }}
                >
                  <span className="mt-0.5 flex-shrink-0">
                    {session.queued ? (
                      <span
                        className="block h-2 w-2 rounded-full"
                        style={{ background: "var(--card-border)" }}
                      />
                    ) : session.loading ? (
                      <span
                        className="sidebar-pulse block h-2 w-2 rounded-full"
                        style={{ background: "var(--accent)" }}
                      />
                    ) : session.error ? (
                      <span
                        className="block h-2 w-2 rounded-full"
                        style={{ background: "var(--error)" }}
                      />
                    ) : (
                      <span
                        className="block h-2 w-2 rounded-full"
                        style={{ background: "var(--success)" }}
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-sm"
                      style={{ color: "var(--foreground)" }}
                    >
                      {session.result?.title || session.topic}
                    </span>
                    {session.queued && (
                      <span
                        className="block truncate text-xs"
                        style={{ color: "var(--muted)" }}
                      >
                        Queued
                      </span>
                    )}
                    {session.loading && (
                      <span
                        className="block truncate text-xs"
                        style={{ color: "var(--muted)" }}
                      >
                        {STEP_LABELS[session.currentStep]}
                      </span>
                    )}
                    {session.error && (
                      <span
                        className="block truncate text-xs"
                        style={{ color: "var(--error)" }}
                      >
                        Failed
                      </span>
                    )}
                  </span>
                  <span
                    className="mt-0.5 flex-shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-black/5 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(session.id);
                    }}
                    style={{ color: "var(--muted)" }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header
          className="flex items-center gap-3 border-b px-4 py-3 md:hidden"
          style={{ borderColor: "var(--card-border)" }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="relative rounded p-1"
            style={{ color: "var(--foreground)" }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            {loadingCount > 0 && (
              <span
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: "var(--accent)" }}
              >
                {loadingCount}
              </span>
            )}
          </button>
          <h1 className="gradient-text text-lg font-bold tracking-tight">
            Article Sauce
          </h1>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-6 py-10">
            {/* Input Form */}
            {showForm && (
              <div className="mx-auto max-w-2xl">
                <div className="mb-10 text-center">
                  <h2
                    className="mb-3 text-4xl font-bold tracking-tight"
                    style={{ color: "var(--foreground)" }}
                  >
                    Generate SEO Articles
                  </h2>
                  <p className="text-lg" style={{ color: "var(--muted)" }}>
                    Create SEO-optimized articles with metadata and image
                    prompts.
                  </p>
                </div>

                {/* Mode toggle */}
                <div
                  className="mb-8 flex overflow-hidden rounded-lg border"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  <button
                    onClick={() => {
                      setMode("single");
                      setFormError("");
                    }}
                    className="flex-1 px-4 py-2.5 text-sm font-medium transition-colors"
                    style={{
                      background:
                        mode === "single"
                          ? "var(--accent)"
                          : "var(--card)",
                      color: mode === "single" ? "#fff" : "var(--foreground)",
                    }}
                  >
                    Single
                  </button>
                  <button
                    onClick={() => {
                      setMode("batch");
                      setFormError("");
                    }}
                    className="flex-1 px-4 py-2.5 text-sm font-medium transition-colors"
                    style={{
                      background:
                        mode === "batch"
                          ? "var(--accent)"
                          : "var(--card)",
                      color: mode === "batch" ? "#fff" : "var(--foreground)",
                    }}
                  >
                    Batch
                  </button>
                </div>

                {/* Single mode form */}
                {mode === "single" && (
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
                        value={formTopic}
                        onChange={(e) => setFormTopic(e.target.value)}
                        placeholder="e.g., The Ultimate Guide to Indoor Herb Gardening for Beginners"
                        rows={3}
                        className="w-full resize-none rounded-xl border px-4 py-3 text-base transition-colors focus:outline-none"
                        style={{
                          background: "var(--card)",
                          borderColor: "var(--card-border)",
                          color: "var(--foreground)",
                        }}
                        onFocus={(e) => {
                          (
                            e.target as HTMLTextAreaElement
                          ).style.borderColor = "var(--accent)";
                        }}
                        onBlur={(e) => {
                          (
                            e.target as HTMLTextAreaElement
                          ).style.borderColor = "var(--card-border)";
                        }}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            (e.metaKey || e.ctrlKey)
                          ) {
                            handleGenerate();
                          }
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
                        <span
                          style={{ color: "var(--muted)", opacity: 0.6 }}
                        >
                          (optional)
                        </span>
                      </label>
                      <input
                        id="keyword"
                        type="text"
                        value={formKeyword}
                        onChange={(e) => setFormKeyword(e.target.value)}
                        placeholder="e.g., indoor herb gardening"
                        className="w-full rounded-xl border px-4 py-3 text-base transition-colors focus:outline-none"
                        style={{
                          background: "var(--card)",
                          borderColor: "var(--card-border)",
                          color: "var(--foreground)",
                        }}
                        onFocus={(e) => {
                          (
                            e.target as HTMLInputElement
                          ).style.borderColor = "var(--accent)";
                        }}
                        onBlur={(e) => {
                          (
                            e.target as HTMLInputElement
                          ).style.borderColor = "var(--card-border)";
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleGenerate();
                          }
                        }}
                      />
                    </div>

                    {formError && (
                      <div
                        className="rounded-xl border px-4 py-3 text-sm"
                        style={{
                          borderColor: "var(--error)",
                          background: "rgba(239, 68, 68, 0.1)",
                          color: "var(--error)",
                        }}
                      >
                        {formError}
                      </div>
                    )}

                    <button
                      onClick={handleGenerate}
                      className="w-full rounded-xl py-3.5 text-base font-semibold text-white transition-all duration-200"
                      style={{ background: "var(--accent)" }}
                      onMouseEnter={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "var(--accent-hover)";
                      }}
                      onMouseLeave={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "var(--accent)";
                      }}
                    >
                      Generate Article
                    </button>
                  </div>
                )}

                {/* Batch mode form */}
                {mode === "batch" && (
                  <div className="space-y-5">
                    {/* Quality selector */}
                    <div>
                      <label
                        className="mb-2 block text-sm font-medium"
                        style={{ color: "var(--muted)" }}
                      >
                        Article Quality
                      </label>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setBatchQuality("standard")}
                          className="flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-colors"
                          style={{
                            background:
                              batchQuality === "standard"
                                ? "var(--accent)"
                                : "var(--card)",
                            color:
                              batchQuality === "standard"
                                ? "#fff"
                                : "var(--foreground)",
                            borderColor:
                              batchQuality === "standard"
                                ? "var(--accent)"
                                : "var(--card-border)",
                          }}
                        >
                          Standard
                          <span
                            className="block text-xs font-normal"
                            style={{
                              opacity: 0.7,
                            }}
                          >
                            ~2,000 words
                          </span>
                        </button>
                        <button
                          onClick={() => setBatchQuality("premium")}
                          className="flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-colors"
                          style={{
                            background:
                              batchQuality === "premium"
                                ? "var(--accent)"
                                : "var(--card)",
                            color:
                              batchQuality === "premium"
                                ? "#fff"
                                : "var(--foreground)",
                            borderColor:
                              batchQuality === "premium"
                                ? "var(--accent)"
                                : "var(--card-border)",
                          }}
                        >
                          Premium
                          <span
                            className="block text-xs font-normal"
                            style={{
                              opacity: 0.7,
                            }}
                          >
                            ~4,000 words
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Article list */}
                    <div>
                      <label
                        className="mb-2 block text-sm font-medium"
                        style={{ color: "var(--muted)" }}
                      >
                        Articles ({batchItems.length}/25)
                      </label>
                      <div className="space-y-2">
                        {batchItems.map((item, index) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2"
                          >
                            <span
                              className="w-6 text-right text-xs tabular-nums"
                              style={{ color: "var(--muted)" }}
                            >
                              {index + 1}
                            </span>
                            <input
                              type="text"
                              value={item.topic}
                              onChange={(e) =>
                                updateBatchItem(
                                  item.id,
                                  "topic",
                                  e.target.value
                                )
                              }
                              placeholder="Article topic"
                              className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none"
                              style={{
                                background: "var(--card)",
                                borderColor: "var(--card-border)",
                                color: "var(--foreground)",
                              }}
                              onFocus={(e) => {
                                (
                                  e.target as HTMLInputElement
                                ).style.borderColor = "var(--accent)";
                              }}
                              onBlur={(e) => {
                                (
                                  e.target as HTMLInputElement
                                ).style.borderColor = "var(--card-border)";
                              }}
                            />
                            <input
                              type="text"
                              value={item.keyword}
                              onChange={(e) =>
                                updateBatchItem(
                                  item.id,
                                  "keyword",
                                  e.target.value
                                )
                              }
                              placeholder="Keyword"
                              className="w-36 rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none"
                              style={{
                                background: "var(--card)",
                                borderColor: "var(--card-border)",
                                color: "var(--foreground)",
                              }}
                              onFocus={(e) => {
                                (
                                  e.target as HTMLInputElement
                                ).style.borderColor = "var(--accent)";
                              }}
                              onBlur={(e) => {
                                (
                                  e.target as HTMLInputElement
                                ).style.borderColor = "var(--card-border)";
                              }}
                            />
                            {batchItems.length > 1 && (
                              <button
                                onClick={() => removeBatchItem(item.id)}
                                className="rounded p-1 transition-colors"
                                style={{ color: "var(--muted)" }}
                                onMouseEnter={(e) => {
                                  (
                                    e.currentTarget as HTMLButtonElement
                                  ).style.color = "var(--error)";
                                }}
                                onMouseLeave={(e) => {
                                  (
                                    e.currentTarget as HTMLButtonElement
                                  ).style.color = "var(--muted)";
                                }}
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Add article button */}
                    {batchItems.length < 25 && (
                      <button
                        onClick={addBatchItem}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-2.5 text-sm font-medium transition-colors"
                        style={{
                          borderColor: "var(--card-border)",
                          color: "var(--muted)",
                        }}
                        onMouseEnter={(e) => {
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.borderColor = "var(--accent)";
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.color = "var(--foreground)";
                        }}
                        onMouseLeave={(e) => {
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.borderColor = "var(--card-border)";
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.color = "var(--muted)";
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Article
                      </button>
                    )}

                    {formError && (
                      <div
                        className="rounded-xl border px-4 py-3 text-sm"
                        style={{
                          borderColor: "var(--error)",
                          background: "rgba(239, 68, 68, 0.1)",
                          color: "var(--error)",
                        }}
                      >
                        {formError}
                      </div>
                    )}

                    <button
                      onClick={handleBatchGenerate}
                      disabled={validBatchCount === 0}
                      className="w-full rounded-xl py-3.5 text-base font-semibold text-white transition-all duration-200 disabled:opacity-40"
                      style={{ background: "var(--accent)" }}
                      onMouseEnter={(e) => {
                        if (validBatchCount > 0)
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.background = "var(--accent-hover)";
                      }}
                      onMouseLeave={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "var(--accent)";
                      }}
                    >
                      Generate {validBatchCount}{" "}
                      {validBatchCount === 1 ? "Article" : "Articles"}
                    </button>

                    <p
                      className="text-center text-xs"
                      style={{ color: "var(--muted)" }}
                    >
                      Articles generate 2 at a time with 60-second intervals
                      between batches to stay within rate limits.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Queued State */}
            {activeSession?.queued && (
              <div className="flex flex-col items-center justify-center py-20">
                <div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: "var(--card)" }}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--muted)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h2
                  className="mb-2 text-lg font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  Queued
                </h2>
                <p
                  className="mb-1 text-sm font-medium"
                  style={{ color: "var(--foreground)" }}
                >
                  {activeSession.topic}
                </p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  Waiting in batch queue.{" "}
                  {batchCountdown > 0 &&
                    `Next batch starts in ${batchCountdown}s.`}
                </p>
              </div>
            )}

            {/* Loading State */}
            {activeSession?.loading && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="mb-4 text-center">
                  <h2
                    className="text-lg font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    {activeSession.topic}
                  </h2>
                  {activeSession.quality === "standard" && (
                    <span
                      className="text-xs"
                      style={{ color: "var(--muted)" }}
                    >
                      Standard (~2,000 words)
                    </span>
                  )}
                </div>
                <div className="mb-8 flex gap-2">
                  <div
                    className="loading-dot h-3 w-3 rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                  <div
                    className="loading-dot h-3 w-3 rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                  <div
                    className="loading-dot h-3 w-3 rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                </div>
                <div className="space-y-3 text-center">
                  {STEPS.map((step, i) => (
                    <p
                      key={step}
                      className="text-sm font-medium transition-all duration-500"
                      style={{
                        color:
                          i === activeSession.currentStep
                            ? "var(--accent)"
                            : i < activeSession.currentStep
                            ? "var(--success)"
                            : "var(--muted)",
                        opacity: i <= activeSession.currentStep ? 1 : 0.4,
                      }}
                    >
                      {i < activeSession.currentStep
                        ? "\u2713 "
                        : i === activeSession.currentStep
                        ? "\u25CB "
                        : "  "}
                      {step}
                    </p>
                  ))}
                </div>
                <p
                  className="mt-8 text-xs"
                  style={{ color: "var(--muted)" }}
                >
                  This may take a couple of minutes...
                </p>
              </div>
            )}

            {/* Error State */}
            {activeSession &&
              !activeSession.loading &&
              !activeSession.queued &&
              activeSession.error && (
                <div className="flex flex-col items-center justify-center py-20">
                  <div
                    className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ background: "rgba(239, 68, 68, 0.1)" }}
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--error)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  </div>
                  <h2
                    className="mb-2 text-lg font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    Generation Failed
                  </h2>
                  <p
                    className="mb-1 text-sm"
                    style={{ color: "var(--muted)" }}
                  >
                    Topic: {activeSession.topic}
                  </p>
                  <div
                    className="mb-6 max-w-md rounded-xl border px-4 py-3 text-center text-sm"
                    style={{
                      borderColor: "var(--error)",
                      background: "rgba(239, 68, 68, 0.1)",
                      color: "var(--error)",
                    }}
                  >
                    {activeSession.error}
                  </div>
                  <button
                    onClick={() => handleRetry(activeSession)}
                    className="rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-all duration-200"
                    style={{ background: "var(--accent)" }}
                    onMouseEnter={(e) => {
                      (
                        e.currentTarget as HTMLButtonElement
                      ).style.background = "var(--accent-hover)";
                    }}
                    onMouseLeave={(e) => {
                      (
                        e.currentTarget as HTMLButtonElement
                      ).style.background = "var(--accent)";
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}

            {/* Results */}
            {activeSession?.result && (
              <div className="space-y-6">
                <div className="mb-8">
                  <h2
                    className="mb-1 text-2xl font-bold"
                    style={{ color: "var(--foreground)" }}
                  >
                    Generated Article
                  </h2>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    Focus:{" "}
                    <span style={{ color: "var(--accent)" }}>
                      {activeSession.result.focusKeyword}
                    </span>
                    {activeSession.result.keywords.length > 0 && (
                      <>
                        {" | "}Keywords:{" "}
                        {activeSession.result.keywords.map((kw, i) => (
                          <span key={kw}>
                            <span style={{ color: "var(--accent)" }}>
                              {kw}
                            </span>
                            {i < activeSession.result!.keywords.length - 1
                              ? ", "
                              : ""}
                          </span>
                        ))}
                      </>
                    )}
                  </p>
                </div>

                <OutputCard
                  label="Title"
                  content={activeSession.result.title}
                />
                <OutputCard
                  label="Meta Description"
                  content={activeSession.result.metaDescription}
                />
                <OutputCard
                  label="Slug"
                  content={activeSession.result.slug}
                />
                <OutputCard
                  label="Article (Markdown)"
                  content={activeSession.result.article}
                  large
                />

                <div>
                  <h3
                    className="mb-4 text-lg font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    Midjourney Image Prompts
                  </h3>
                  <div className="space-y-4">
                    {activeSession.result.imagePrompts.map((image, i) => (
                      <ImagePromptCard key={i} image={image} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        <footer
          className="border-t py-4 text-center"
          style={{ borderColor: "var(--card-border)" }}
        >
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Article Sauce
          </p>
        </footer>
      </div>
    </div>
  );
}
