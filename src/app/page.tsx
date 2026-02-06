"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { marked } from "marked";

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
  schema: string;
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
  posted: boolean;
}

interface BatchQueueItem {
  id: string;
  topic: string;
  focusKeyword: string | undefined;
  quality: "standard" | "premium";
}

interface AdvancedSettings {
  domain: string;
  siteName: string;
  siteAbout: string;
  authorName: string;
  authorAbout: string;
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
              Prompt
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

function ArticlePreview({ article }: { article: string }) {
  const [copied, setCopied] = useState(false);

  const html = useMemo(() => {
    return marked.parse(article, { async: false }) as string;
  }, [article]);

  const handleCopyPlainText = async () => {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const plainText = temp.innerText || temp.textContent || "";
    await navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyHtml = async () => {
    await navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={handleCopyPlainText}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            borderColor: "var(--card-border)",
            background: "var(--card)",
            color: "var(--foreground)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "var(--accent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "var(--card-border)";
          }}
        >
          <svg
            width="12"
            height="12"
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
          Copy Plain Text
        </button>
        <button
          onClick={handleCopyHtml}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            borderColor: "var(--card-border)",
            background: "var(--card)",
            color: "var(--foreground)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "var(--accent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "var(--card-border)";
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          Copy HTML
        </button>
        {copied && (
          <span
            className="text-xs font-medium"
            style={{ color: "var(--accent)" }}
          >
            Copied!
          </span>
        )}
      </div>
      <div
        className="article-preview rounded-xl border p-8 md:p-12"
        style={{
          background: "var(--card)",
          borderColor: "var(--card-border)",
          color: "var(--foreground)",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
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
  const [resultView, setResultView] = useState<"data" | "preview">("data");
  const [showHelp, setShowHelp] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>({
    domain: "",
    siteName: "",
    siteAbout: "",
    authorName: "",
    authorAbout: "",
  });
  const [showAdvancedJsonPaste, setShowAdvancedJsonPaste] = useState(false);
  const [advancedJsonValue, setAdvancedJsonValue] = useState("");

  // Mode & batch state
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [batchQuality, setBatchQuality] = useState<"standard" | "premium">(
    "premium"
  );
  const [batchItems, setBatchItems] = useState<
    Array<{ id: string; topic: string; keyword: string }>
  >([{ id: crypto.randomUUID(), topic: "", keyword: "" }]);
  const [showJsonPaste, setShowJsonPaste] = useState(false);
  const [jsonPasteValue, setJsonPasteValue] = useState("");
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
            advancedSettings,
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
            schema: (articleData.schema as string) || "",
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
        posted: false,
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
      posted: false,
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

  const parseAndLoadJson = (text: string): boolean => {
    try {
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [];
      if (items.length === 0) {
        setFormError("JSON is empty or not an array.");
        return false;
      }
      const mapped = items.slice(0, 25).map((item: Record<string, string>) => ({
        id: crypto.randomUUID(),
        topic: (item.concept || item.topic || "").trim(),
        keyword: (item.keyword || item.focusKeyword || "").trim(),
      }));
      const valid = mapped.filter((m: { topic: string }) => m.topic);
      if (valid.length === 0) {
        setFormError('No valid articles found. Each item needs a "concept" field.');
        return false;
      }
      setBatchItems(valid);
      setFormError("");
      return true;
    } catch {
      setFormError("Invalid JSON. Please check the format.");
      return false;
    }
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      parseAndLoadJson(evt.target?.result as string);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handlePasteJsonSubmit = () => {
    if (parseAndLoadJson(jsonPasteValue)) {
      setJsonPasteValue("");
      setShowJsonPaste(false);
    }
  };

  const parseAndLoadAdvancedJson = (text: string): boolean => {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        setFormError("Advanced settings JSON must be an object.");
        return false;
      }
      setAdvancedSettings({
        domain: (parsed.domain || parsed.url || "").trim(),
        siteName: (parsed.siteName || parsed.site_name || parsed.blogName || "").trim(),
        siteAbout: (parsed.siteAbout || parsed.site_about || parsed.blogAbout || parsed.about || "").trim(),
        authorName: (parsed.authorName || parsed.author_name || parsed.author || "").trim(),
        authorAbout: (parsed.authorAbout || parsed.author_about || parsed.authorBio || parsed.bio || "").trim(),
      });
      setFormError("");
      return true;
    } catch {
      setFormError("Invalid JSON. Please check the format.");
      return false;
    }
  };

  const handleAdvancedJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      parseAndLoadAdvancedJson(evt.target?.result as string);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleAdvancedPasteSubmit = () => {
    if (parseAndLoadAdvancedJson(advancedJsonValue)) {
      setAdvancedJsonValue("");
      setShowAdvancedJsonPaste(false);
    }
  };

  const updateAdvanced = (field: keyof AdvancedSettings, value: string) => {
    setAdvancedSettings((prev) => ({ ...prev, [field]: value }));
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

  const showForm = activeSessionId === null && !showHelp && !showDashboard;
  const loadingCount = sessions.filter((s) => s.loading).length;
  const queuedCount = sessions.filter((s) => s.queued).length;
  const validBatchCount = batchItems.filter((i) => i.topic.trim()).length;
  const [progressMinimized, setProgressMinimized] = useState(false);
  const activeCount = loadingCount + queuedCount;
  const completedInBatch = sessions.filter(
    (s) => !s.loading && !s.queued && (s.result || s.error)
  ).length;
  const totalInProgress = activeCount + completedInBatch;
  const progressPercent =
    totalInProgress > 0
      ? Math.round((completedInBatch / totalInProgress) * 100)
      : 0;

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
          <div className="flex items-center gap-2">
            <h1 className="gradient-text text-lg font-bold tracking-tight">
              Article Sauce
            </h1>
            <button
              onClick={() => {
                setShowHelp(true);
                setActiveSessionId(null);
              }}
              className="rounded-full p-1 transition-colors"
              style={{ color: "var(--muted)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--foreground)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--muted)";
              }}
              title="How it works"
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
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>
          </div>
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
              setShowHelp(false);
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
          {sessions.filter((s) => s.result).length > 0 && (
            <button
              onClick={() => {
                setShowDashboard(true);
                setShowHelp(false);
                setActiveSessionId(null);
                setSidebarOpen(false);
              }}
              className="mt-1.5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={{
                background: showDashboard ? "var(--card)" : "transparent",
                color: "var(--foreground)",
              }}
              onMouseEnter={(e) => {
                if (!showDashboard)
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(0,0,0,0.04)";
              }}
              onMouseLeave={(e) => {
                if (!showDashboard)
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "transparent";
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
              Dashboard
            </button>
          )}
        </div>

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
                    setShowHelp(false);
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
                    ) : session.posted ? (
                      <span
                        className="block h-2 w-2 rounded-full"
                        style={{ background: "var(--success)" }}
                      />
                    ) : (
                      <span
                        className="block h-2 w-2 rounded-full"
                        style={{ background: "#007aff" }}
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
            {/* Help Page */}
            {showHelp && (
              <div className="mx-auto max-w-2xl">
                <div className="mb-8">
                  <button
                    onClick={() => {
                      setShowHelp(false);
                    }}
                    className="mb-6 flex items-center gap-1.5 text-sm font-medium"
                    style={{ color: "var(--accent)" }}
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
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Back
                  </button>
                  <h2
                    className="mb-3 text-3xl font-bold tracking-tight"
                    style={{ color: "var(--foreground)" }}
                  >
                    How Article Sauce Works
                  </h2>
                  <p style={{ color: "var(--muted)" }}>
                    A guide to generating SEO-optimized articles, using batch
                    mode, and configuring advanced settings.
                  </p>
                </div>

                <div className="space-y-8">
                  {/* Overview */}
                  <div
                    className="rounded-xl border p-6"
                    style={{
                      background: "var(--card)",
                      borderColor: "var(--card-border)",
                    }}
                  >
                    <h3
                      className="mb-3 text-lg font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      Overview
                    </h3>
                    <div
                      className="space-y-2 text-sm leading-relaxed"
                      style={{ color: "var(--foreground)" }}
                    >
                      <p>
                        Article Sauce generates comprehensive, SEO-optimized
                        articles in three steps:
                      </p>
                      <ol
                        className="list-decimal space-y-1 pl-5"
                        style={{ color: "var(--muted)" }}
                      >
                        <li>
                          <strong style={{ color: "var(--foreground)" }}>
                            Research
                          </strong>{" "}
                          - Analyzes your topic and gathers context
                        </li>
                        <li>
                          <strong style={{ color: "var(--foreground)" }}>
                            Metadata
                          </strong>{" "}
                          - Generates title, meta description, slug, focus
                          keyword, and supporting keywords
                        </li>
                        <li>
                          <strong style={{ color: "var(--foreground)" }}>
                            Content
                          </strong>{" "}
                          - Writes the article, creates image prompts, and
                          generates JSON-LD schema
                        </li>
                      </ol>
                      <p style={{ color: "var(--muted)" }}>
                        Each article includes: a markdown article, copyable
                        metadata fields, 4 photorealistic image prompts with
                        alt texts, and structured data for SEO rich snippets.
                      </p>
                    </div>
                  </div>

                  {/* Single Mode */}
                  <div
                    className="rounded-xl border p-6"
                    style={{
                      background: "var(--card)",
                      borderColor: "var(--card-border)",
                    }}
                  >
                    <h3
                      className="mb-3 text-lg font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      Single Mode
                    </h3>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--muted)" }}
                    >
                      Enter a topic and an optional focus keyword. The article
                      generates immediately at premium quality (~4,000 words).
                    </p>
                  </div>

                  {/* Batch Mode */}
                  <div
                    className="rounded-xl border p-6"
                    style={{
                      background: "var(--card)",
                      borderColor: "var(--card-border)",
                    }}
                  >
                    <h3
                      className="mb-3 text-lg font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      Batch Mode
                    </h3>
                    <div
                      className="space-y-3 text-sm leading-relaxed"
                      style={{ color: "var(--muted)" }}
                    >
                      <p>
                        Generate up to 25 articles at once. Choose between
                        Standard (~2,000 words) or Premium (~4,000 words)
                        quality. Articles process 2 at a time with 60-second
                        intervals between batches to stay within rate limits.
                      </p>
                      <p>
                        You can add articles manually or import them via JSON.
                        Use the <strong style={{ color: "var(--foreground)" }}>Upload</strong> or{" "}
                        <strong style={{ color: "var(--foreground)" }}>Paste</strong> buttons to
                        import.
                      </p>
                      <div>
                        <p
                          className="mb-2 text-xs font-medium uppercase tracking-wider"
                          style={{ color: "var(--accent)" }}
                        >
                          Batch JSON Format
                        </p>
                        <pre
                          className="overflow-x-auto rounded-lg p-4 text-xs leading-relaxed"
                          style={{
                            background: "var(--background)",
                            color: "var(--foreground)",
                          }}
                        >
                          {`[
  {
    "concept": "The Ultimate Guide to Indoor Herb Gardening",
    "keyword": "indoor herb gardening"
  },
  {
    "concept": "Best Running Shoes for Marathon Training in 2025",
    "keyword": "marathon running shoes"
  }
]`}
                        </pre>
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: "var(--muted)" }}
                      >
                        <strong style={{ color: "var(--foreground)" }}>
                          Accepted fields:
                        </strong>{" "}
                        <code>concept</code> or <code>topic</code> for the
                        article subject, <code>keyword</code> or{" "}
                        <code>focusKeyword</code> for the target keyword.
                      </div>
                    </div>
                  </div>

                  {/* Advanced Settings */}
                  <div
                    className="rounded-xl border p-6"
                    style={{
                      background: "var(--card)",
                      borderColor: "var(--card-border)",
                    }}
                  >
                    <h3
                      className="mb-3 text-lg font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      Advanced Settings
                    </h3>
                    <div
                      className="space-y-3 text-sm leading-relaxed"
                      style={{ color: "var(--muted)" }}
                    >
                      <p>
                        Optional settings that populate the JSON-LD schema with
                        your actual site and author information instead of
                        placeholders.
                      </p>
                      <div>
                        <p
                          className="mb-1 text-xs font-medium"
                          style={{ color: "var(--foreground)" }}
                        >
                          Available fields:
                        </p>
                        <ul className="list-disc space-y-1 pl-5 text-xs">
                          <li>
                            <strong style={{ color: "var(--foreground)" }}>
                              Domain
                            </strong>{" "}
                            - Your website URL (e.g., https://yourblog.com)
                          </li>
                          <li>
                            <strong style={{ color: "var(--foreground)" }}>
                              Site Name
                            </strong>{" "}
                            - Publisher/organization name
                          </li>
                          <li>
                            <strong style={{ color: "var(--foreground)" }}>
                              About the Blog
                            </strong>{" "}
                            - Short description of your site
                          </li>
                          <li>
                            <strong style={{ color: "var(--foreground)" }}>
                              Author Name
                            </strong>{" "}
                            - Article author&apos;s name
                          </li>
                          <li>
                            <strong style={{ color: "var(--foreground)" }}>
                              About the Author
                            </strong>{" "}
                            - Author bio/credentials
                          </li>
                        </ul>
                      </div>
                      <div>
                        <p
                          className="mb-2 text-xs font-medium uppercase tracking-wider"
                          style={{ color: "var(--accent)" }}
                        >
                          Advanced Settings JSON Format
                        </p>
                        <pre
                          className="overflow-x-auto rounded-lg p-4 text-xs leading-relaxed"
                          style={{
                            background: "var(--background)",
                            color: "var(--foreground)",
                          }}
                        >
                          {`{
  "domain": "https://yourblog.com",
  "siteName": "Your Blog Name",
  "siteAbout": "A blog about sustainable living",
  "authorName": "John Doe",
  "authorAbout": "Expert with 10 years of experience"
}`}
                        </pre>
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: "var(--muted)" }}
                      >
                        <strong style={{ color: "var(--foreground)" }}>
                          Accepted aliases:
                        </strong>{" "}
                        <code>domain</code>/<code>url</code>,{" "}
                        <code>siteName</code>/<code>site_name</code>/
                        <code>blogName</code>, <code>authorName</code>/
                        <code>author_name</code>/<code>author</code>,{" "}
                        <code>authorAbout</code>/<code>author_about</code>/
                        <code>authorBio</code>/<code>bio</code>,{" "}
                        <code>siteAbout</code>/<code>site_about</code>/
                        <code>blogAbout</code>/<code>about</code>
                      </div>
                    </div>
                  </div>

                  {/* Output */}
                  <div
                    className="rounded-xl border p-6"
                    style={{
                      background: "var(--card)",
                      borderColor: "var(--card-border)",
                    }}
                  >
                    <h3
                      className="mb-3 text-lg font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      Output
                    </h3>
                    <div
                      className="space-y-2 text-sm leading-relaxed"
                      style={{ color: "var(--muted)" }}
                    >
                      <p>Each generated article includes two views:</p>
                      <ul className="list-disc space-y-1 pl-5 text-xs">
                        <li>
                          <strong style={{ color: "var(--foreground)" }}>
                            Data tab
                          </strong>{" "}
                          - Copyable fields for title, meta description, slug,
                          focus keyword, keywords, markdown article, 4 image
                          prompts with alt texts, and JSON-LD schema
                        </li>
                        <li>
                          <strong style={{ color: "var(--foreground)" }}>
                            Preview tab
                          </strong>{" "}
                          - Rendered article as it would appear on a blog, with
                          buttons to copy as plain text or HTML
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dashboard */}
            {showDashboard && (
              <div className="mx-auto max-w-4xl">
                <div className="mb-8">
                  <button
                    onClick={() => setShowDashboard(false)}
                    className="mb-6 flex items-center gap-1.5 text-sm font-medium"
                    style={{ color: "var(--accent)" }}
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
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Back
                  </button>
                  <h2
                    className="mb-2 text-3xl font-bold tracking-tight"
                    style={{ color: "var(--foreground)" }}
                  >
                    Dashboard
                  </h2>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    {sessions.filter((s) => s.result && !s.posted).length} need
                    to post &middot;{" "}
                    {sessions.filter((s) => s.posted).length} posted
                  </p>
                </div>

                {/* Need to Post */}
                {sessions.filter(
                  (s) => s.result && !s.posted && !s.loading && !s.queued
                ).length > 0 && (
                  <div className="mb-8">
                    <h3
                      className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider"
                      style={{ color: "var(--muted)" }}
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: "#007aff" }}
                      />
                      Need to Post
                    </h3>
                    <div className="space-y-2">
                      {sessions
                        .filter(
                          (s) =>
                            s.result &&
                            !s.posted &&
                            !s.loading &&
                            !s.queued
                        )
                        .map((session) => (
                          <div
                            key={session.id}
                            className="group flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors"
                            style={{
                              background: "var(--card)",
                              borderColor: "var(--card-border)",
                            }}
                          >
                            <button
                              onClick={() =>
                                updateSession(session.id, { posted: true })
                              }
                              className="flex-shrink-0 rounded-full border-2 p-0.5 transition-colors"
                              style={{ borderColor: "var(--card-border)" }}
                              onMouseEnter={(e) => {
                                (
                                  e.currentTarget as HTMLButtonElement
                                ).style.borderColor = "var(--success)";
                              }}
                              onMouseLeave={(e) => {
                                (
                                  e.currentTarget as HTMLButtonElement
                                ).style.borderColor = "var(--card-border)";
                              }}
                              title="Mark as posted"
                            >
                              <span className="block h-3 w-3 rounded-full" />
                            </button>
                            <button
                              className="min-w-0 flex-1 text-left"
                              onClick={() => {
                                setActiveSessionId(session.id);
                                setShowDashboard(false);
                              }}
                            >
                              <span
                                className="block truncate text-sm font-medium"
                                style={{ color: "var(--foreground)" }}
                              >
                                {session.result?.title || session.topic}
                              </span>
                              <span
                                className="block truncate text-xs"
                                style={{ color: "var(--muted)" }}
                              >
                                {session.result?.focusKeyword}
                              </span>
                            </button>
                            <span
                              className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                              style={{
                                background: "rgba(0, 122, 255, 0.1)",
                                color: "#007aff",
                              }}
                            >
                              Ready
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Posted */}
                {sessions.filter((s) => s.posted).length > 0 && (
                  <div className="mb-8">
                    <h3
                      className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider"
                      style={{ color: "var(--muted)" }}
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: "var(--success)" }}
                      />
                      Posted
                    </h3>
                    <div className="space-y-2">
                      {sessions
                        .filter((s) => s.posted)
                        .map((session) => (
                          <div
                            key={session.id}
                            className="group flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors"
                            style={{
                              background: "var(--card)",
                              borderColor: "var(--card-border)",
                            }}
                          >
                            <button
                              onClick={() =>
                                updateSession(session.id, { posted: false })
                              }
                              className="flex-shrink-0 transition-colors"
                              style={{ color: "var(--success)" }}
                              title="Unmark as posted"
                            >
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </button>
                            <button
                              className="min-w-0 flex-1 text-left"
                              onClick={() => {
                                setActiveSessionId(session.id);
                                setShowDashboard(false);
                              }}
                            >
                              <span
                                className="block truncate text-sm font-medium"
                                style={{ color: "var(--foreground)" }}
                              >
                                {session.result?.title || session.topic}
                              </span>
                              <span
                                className="block truncate text-xs"
                                style={{ color: "var(--muted)" }}
                              >
                                {session.result?.focusKeyword}
                              </span>
                            </button>
                            <span
                              className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                              style={{
                                background: "rgba(52, 199, 89, 0.1)",
                                color: "var(--success)",
                              }}
                            >
                              Posted
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* In Progress / Queued */}
                {sessions.filter(
                  (s) => (s.loading || s.queued) && !s.error
                ).length > 0 && (
                  <div className="mb-8">
                    <h3
                      className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider"
                      style={{ color: "var(--muted)" }}
                    >
                      <span
                        className="sidebar-pulse inline-block h-2 w-2 rounded-full"
                        style={{ background: "var(--accent)" }}
                      />
                      In Progress
                    </h3>
                    <div className="space-y-2">
                      {sessions
                        .filter(
                          (s) => (s.loading || s.queued) && !s.error
                        )
                        .map((session) => (
                          <div
                            key={session.id}
                            className="flex items-center gap-3 rounded-xl border px-4 py-3"
                            style={{
                              background: "var(--card)",
                              borderColor: "var(--card-border)",
                            }}
                          >
                            <span
                              className={`block h-4 w-4 flex-shrink-0 rounded-full border-2 ${session.loading ? "sidebar-pulse" : ""}`}
                              style={{
                                borderColor: session.loading
                                  ? "var(--accent)"
                                  : "var(--card-border)",
                              }}
                            />
                            <span className="min-w-0 flex-1">
                              <span
                                className="block truncate text-sm font-medium"
                                style={{ color: "var(--foreground)" }}
                              >
                                {session.topic}
                              </span>
                              <span
                                className="block truncate text-xs"
                                style={{ color: "var(--muted)" }}
                              >
                                {session.loading
                                  ? STEP_LABELS[session.currentStep]
                                  : "Queued"}
                              </span>
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Failed */}
                {sessions.filter(
                  (s) => s.error && !s.loading && !s.queued
                ).length > 0 && (
                  <div className="mb-8">
                    <h3
                      className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider"
                      style={{ color: "var(--muted)" }}
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: "var(--error)" }}
                      />
                      Failed
                    </h3>
                    <div className="space-y-2">
                      {sessions
                        .filter(
                          (s) => s.error && !s.loading && !s.queued
                        )
                        .map((session) => (
                          <div
                            key={session.id}
                            className="flex items-center gap-3 rounded-xl border px-4 py-3"
                            style={{
                              background: "var(--card)",
                              borderColor: "var(--card-border)",
                            }}
                          >
                            <span
                              className="block h-2 w-2 flex-shrink-0 rounded-full"
                              style={{ background: "var(--error)" }}
                            />
                            <button
                              className="min-w-0 flex-1 text-left"
                              onClick={() => {
                                setActiveSessionId(session.id);
                                setShowDashboard(false);
                              }}
                            >
                              <span
                                className="block truncate text-sm font-medium"
                                style={{ color: "var(--foreground)" }}
                              >
                                {session.topic}
                              </span>
                              <span
                                className="block truncate text-xs"
                                style={{ color: "var(--error)" }}
                              >
                                {session.error}
                              </span>
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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

                {/* Advanced settings dropdown */}
                <div
                  className="mb-6 rounded-xl border"
                  style={{
                    borderColor: "var(--card-border)",
                    background: "var(--card)",
                  }}
                >
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    <span className="flex items-center gap-2">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--muted)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                      </svg>
                      Advanced Settings
                      <span
                        className="text-xs font-normal"
                        style={{ color: "var(--muted)" }}
                      >
                        (optional)
                      </span>
                    </span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--muted)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        transform: showAdvanced
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {showAdvanced && (
                    <div
                      className="space-y-3 border-t px-4 py-4"
                      style={{ borderColor: "var(--card-border)" }}
                    >
                      {/* Import buttons */}
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="file"
                          accept=".json"
                          id="advanced-json-import"
                          className="hidden"
                          onChange={handleAdvancedJsonFile}
                        />
                        <button
                          onClick={() =>
                            document
                              .getElementById("advanced-json-import")
                              ?.click()
                          }
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
                          style={{
                            color: "var(--accent)",
                            background: "transparent",
                          }}
                          onMouseEnter={(e) => {
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.background = "var(--background)";
                          }}
                          onMouseLeave={(e) => {
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.background = "transparent";
                          }}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          Upload
                        </button>
                        <span
                          className="text-xs"
                          style={{ color: "var(--card-border)" }}
                        >
                          |
                        </span>
                        <button
                          onClick={() =>
                            setShowAdvancedJsonPaste(!showAdvancedJsonPaste)
                          }
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
                          style={{
                            color: showAdvancedJsonPaste
                              ? "var(--foreground)"
                              : "var(--accent)",
                            background: showAdvancedJsonPaste
                              ? "var(--background)"
                              : "transparent",
                          }}
                          onMouseEnter={(e) => {
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.background = "var(--background)";
                          }}
                          onMouseLeave={(e) => {
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.background = showAdvancedJsonPaste
                              ? "var(--background)"
                              : "transparent";
                          }}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect
                              x="9"
                              y="9"
                              width="13"
                              height="13"
                              rx="2"
                              ry="2"
                            />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          Paste
                        </button>
                      </div>

                      {showAdvancedJsonPaste && (
                        <div
                          className="rounded-lg border p-3"
                          style={{
                            borderColor: "var(--card-border)",
                            background: "var(--background)",
                          }}
                        >
                          <textarea
                            value={advancedJsonValue}
                            onChange={(e) =>
                              setAdvancedJsonValue(e.target.value)
                            }
                            placeholder={`{
  "domain": "https://yourblog.com",
  "siteName": "Your Blog Name",
  "siteAbout": "A blog about...",
  "authorName": "John Doe",
  "authorAbout": "Expert in..."
}`}
                            rows={5}
                            className="mb-2 w-full resize-none rounded-lg border px-3 py-2 font-mono text-xs transition-colors focus:outline-none"
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
                          />
                          <div className="flex justify-end">
                            <button
                              onClick={handleAdvancedPasteSubmit}
                              disabled={!advancedJsonValue.trim()}
                              className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-40"
                              style={{ background: "var(--accent)" }}
                            >
                              Load Settings
                            </button>
                          </div>
                        </div>
                      )}

                      {[
                        {
                          key: "domain" as const,
                          label: "Domain",
                          placeholder: "https://yourblog.com",
                        },
                        {
                          key: "siteName" as const,
                          label: "Site Name",
                          placeholder: "Your Blog Name",
                        },
                        {
                          key: "siteAbout" as const,
                          label: "About the Blog",
                          placeholder:
                            "A blog about sustainable living and eco-friendly tips",
                        },
                        {
                          key: "authorName" as const,
                          label: "Author Name",
                          placeholder: "John Doe",
                        },
                        {
                          key: "authorAbout" as const,
                          label: "About the Author",
                          placeholder:
                            "Expert in sustainable living with 10 years of experience",
                        },
                      ].map((field) => (
                        <div key={field.key}>
                          <label
                            className="mb-1 block text-xs font-medium"
                            style={{ color: "var(--muted)" }}
                          >
                            {field.label}
                          </label>
                          <input
                            type="text"
                            value={advancedSettings[field.key]}
                            onChange={(e) =>
                              updateAdvanced(field.key, e.target.value)
                            }
                            placeholder={field.placeholder}
                            className="w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none"
                            style={{
                              background: "var(--background)",
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
                        </div>
                      ))}
                    </div>
                  )}
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
                      <div className="mb-2 flex items-center justify-between">
                        <label
                          className="text-sm font-medium"
                          style={{ color: "var(--muted)" }}
                        >
                          Articles ({batchItems.length}/25)
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="file"
                            accept=".json"
                            id="json-import"
                            className="hidden"
                            onChange={handleImportJsonFile}
                          />
                          <button
                            onClick={() =>
                              document.getElementById("json-import")?.click()
                            }
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
                            style={{
                              color: "var(--accent)",
                              background: "transparent",
                            }}
                            onMouseEnter={(e) => {
                              (
                                e.currentTarget as HTMLButtonElement
                              ).style.background = "var(--card)";
                            }}
                            onMouseLeave={(e) => {
                              (
                                e.currentTarget as HTMLButtonElement
                              ).style.background = "transparent";
                            }}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            Upload
                          </button>
                          <span
                            className="text-xs"
                            style={{ color: "var(--card-border)" }}
                          >
                            |
                          </span>
                          <button
                            onClick={() => {
                              setShowJsonPaste(!showJsonPaste);
                              setFormError("");
                            }}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
                            style={{
                              color: showJsonPaste
                                ? "var(--foreground)"
                                : "var(--accent)",
                              background: showJsonPaste
                                ? "var(--card)"
                                : "transparent",
                            }}
                            onMouseEnter={(e) => {
                              (
                                e.currentTarget as HTMLButtonElement
                              ).style.background = "var(--card)";
                            }}
                            onMouseLeave={(e) => {
                              (
                                e.currentTarget as HTMLButtonElement
                              ).style.background = showJsonPaste
                                ? "var(--card)"
                                : "transparent";
                            }}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect
                                x="9"
                                y="9"
                                width="13"
                                height="13"
                                rx="2"
                                ry="2"
                              />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Paste
                          </button>
                        </div>
                      </div>
                      {showJsonPaste && (
                        <div
                          className="mb-3 rounded-xl border p-3"
                          style={{
                            borderColor: "var(--card-border)",
                            background: "var(--card)",
                          }}
                        >
                          <textarea
                            value={jsonPasteValue}
                            onChange={(e) => setJsonPasteValue(e.target.value)}
                            placeholder={`[
  { "concept": "Article topic here", "keyword": "focus keyword" },
  { "concept": "Another article topic", "keyword": "another keyword" }
]`}
                            rows={6}
                            className="mb-2 w-full resize-none rounded-lg border px-3 py-2 font-mono text-xs transition-colors focus:outline-none"
                            style={{
                              background: "var(--background)",
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
                          />
                          <div className="flex items-center justify-between">
                            <span
                              className="text-xs"
                              style={{ color: "var(--muted)" }}
                            >
                              Paste a JSON array of articles
                            </span>
                            <button
                              onClick={handlePasteJsonSubmit}
                              disabled={!jsonPasteValue.trim()}
                              className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-40"
                              style={{ background: "var(--accent)" }}
                            >
                              Load Articles
                            </button>
                          </div>
                        </div>
                      )}
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
                <div className="mb-2">
                  <div className="flex items-start justify-between gap-4">
                    <h2
                      className="mb-1 text-2xl font-bold"
                      style={{ color: "var(--foreground)" }}
                    >
                      Generated Article
                    </h2>
                    <button
                      onClick={() =>
                        updateSession(activeSession.id, {
                          posted: !activeSession.posted,
                        })
                      }
                      className="flex flex-shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200"
                      style={{
                        borderColor: activeSession.posted
                          ? "var(--success)"
                          : "var(--card-border)",
                        background: activeSession.posted
                          ? "rgba(52, 199, 89, 0.1)"
                          : "var(--card)",
                        color: activeSession.posted
                          ? "var(--success)"
                          : "var(--muted)",
                      }}
                      onMouseEnter={(e) => {
                        if (!activeSession.posted) {
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.borderColor = "var(--success)";
                          (e.currentTarget as HTMLButtonElement).style.color =
                            "var(--success)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!activeSession.posted) {
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.borderColor = "var(--card-border)";
                          (e.currentTarget as HTMLButtonElement).style.color =
                            "var(--muted)";
                        }
                      }}
                    >
                      {activeSession.posted ? (
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
                      ) : (
                        <span
                          className="block h-3.5 w-3.5 rounded-full border-2"
                          style={{ borderColor: "currentColor" }}
                        />
                      )}
                      {activeSession.posted ? "Posted" : "Mark as Posted"}
                    </button>
                  </div>
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

                {/* Result view tabs */}
                <div
                  className="flex overflow-hidden rounded-lg border"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  <button
                    onClick={() => setResultView("data")}
                    className="flex-1 px-4 py-2 text-sm font-medium transition-colors"
                    style={{
                      background:
                        resultView === "data"
                          ? "var(--accent)"
                          : "var(--card)",
                      color:
                        resultView === "data" ? "#fff" : "var(--foreground)",
                    }}
                  >
                    Data
                  </button>
                  <button
                    onClick={() => setResultView("preview")}
                    className="flex-1 px-4 py-2 text-sm font-medium transition-colors"
                    style={{
                      background:
                        resultView === "preview"
                          ? "var(--accent)"
                          : "var(--card)",
                      color:
                        resultView === "preview"
                          ? "#fff"
                          : "var(--foreground)",
                    }}
                  >
                    Preview
                  </button>
                </div>

                {/* Data tab */}
                {resultView === "data" && (
                  <div className="space-y-6">
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
                      label="Focus Keyword"
                      content={activeSession.result.focusKeyword}
                    />
                    {activeSession.result.keywords.length > 0 && (
                      <OutputCard
                        label="Keywords"
                        content={activeSession.result.keywords.join(", ")}
                      />
                    )}
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
                        Image Prompts
                      </h3>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {activeSession.result.imagePrompts.map((image, i) => (
                          <ImagePromptCard key={i} image={image} />
                        ))}
                      </div>
                    </div>

                    {activeSession.result.schema && (
                      <div>
                        <h3
                          className="mb-4 text-lg font-semibold"
                          style={{ color: "var(--foreground)" }}
                        >
                          JSON-LD Schema
                        </h3>
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
                            <span
                              className="text-xs font-medium uppercase tracking-wider"
                              style={{ color: "var(--muted)" }}
                            >
                              Structured Data
                            </span>
                            <CopyButton
                              text={`<script type="application/ld+json">\n${activeSession.result.schema}\n</script>`}
                              label="Copy Schema"
                            />
                          </div>
                          <pre
                            className="overflow-x-auto p-5 text-xs leading-relaxed"
                            style={{
                              color: "var(--foreground)",
                            }}
                          >
                            {activeSession.result.schema}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Preview tab */}
                {resultView === "preview" && (
                  <ArticlePreview article={activeSession.result.article} />
                )}
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

      {/* Floating progress pill */}
      {activeCount > 0 && (
        <>
          {progressMinimized ? (
            <button
              onClick={() => setProgressMinimized(false)}
              className="progress-fab fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
              style={{
                background: "#1d1d1f",
                boxShadow:
                  "0 4px 24px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.08)",
              }}
              title="Show progress"
            >
              <svg
                className="progress-spinner"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              <span
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                style={{ background: "#fff", color: "#1d1d1f" }}
              >
                {activeCount}
              </span>
            </button>
          ) : (
            <div
              className="progress-pill fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full shadow-2xl transition-all duration-300"
              style={{
                background: "#1d1d1f",
                boxShadow:
                  "0 4px 30px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06)",
                minWidth: "320px",
                maxWidth: "420px",
              }}
            >
              <div className="flex items-center gap-3 px-5 py-3">
                {/* Spinner */}
                <svg
                  className="progress-spinner flex-shrink-0"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-white">
                      {batchCountdown > 0
                        ? `Next batch in ${batchCountdown}s`
                        : `Generating ${loadingCount === 1 ? "article" : "articles"}`}
                    </span>
                    <span
                      className="flex-shrink-0 text-xs tabular-nums"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      {completedInBatch}/{totalInProgress}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div
                    className="mt-2 h-1 w-full overflow-hidden rounded-full"
                    style={{ background: "rgba(255,255,255,0.15)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.max(progressPercent, activeCount > 0 ? 3 : 0)}%`,
                        background: "#fff",
                      }}
                    />
                  </div>
                </div>

                {/* Minimize button */}
                <button
                  onClick={() => setProgressMinimized(true)}
                  className="flex-shrink-0 rounded-full p-1 transition-colors"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color =
                      "rgba(255,255,255,0.8)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color =
                      "rgba(255,255,255,0.4)";
                  }}
                  title="Minimize"
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
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
