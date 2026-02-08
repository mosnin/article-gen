"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import { createClient } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";

interface ImagePrompt {
  type: string;
  prompt: string;
  altText: string;
}

interface GeneratedImage {
  type: string;
  altText: string;
  b64: string | null;
  success: boolean;
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
  generatedImages?: GeneratedImage[];
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
  imageProgress?: string;
}

interface BatchQueueItem {
  id: string;
  topic: string;
  focusKeyword: string | undefined;
  quality: "standard" | "premium";
  withImages: boolean;
  blogId?: string;
}

interface WpBlog {
  id: string;
  name: string;
  url: string;
  username: string;
  appPassword: string;
  authorName?: string;
  authorAbout?: string;
}

interface AdvancedSettings {
  domain: string;
  siteName: string;
  siteAbout: string;
  authorName: string;
  authorAbout: string;
  wpUrl: string;
  wpUsername: string;
  wpAppPassword: string;
}

interface ClusterArticle {
  id: string;
  concept: string;
  keyword: string;
  relation: string;
  session: ArticleSession | null;
}

interface TopicCluster {
  id: string;
  pillarTopic: string;
  pillarKeyword: string;
  pillarSession: ArticleSession | null;
  clusterArticles: ClusterArticle[];
  quality: "standard" | "premium";
  generating: boolean;
  generationPhase: "idle" | "planning" | "pillar" | "clusters" | "relinking" | "done";
  expanded: boolean;
}

const STEPS = [
  "Organizing context & researching facts...",
  "Generating SEO metadata...",
  "Writing article & creating image prompts...",
  "Generating AI images...",
];

const STEP_LABELS = ["Researching...", "Metadata...", "Writing...", "Images..."];

function getStepLabel(session: ArticleSession): string {
  if (session.currentStep === 3 && session.imageProgress) {
    return session.imageProgress;
  }
  return STEP_LABELS[session.currentStep] || "";
}

function getStepText(session: ArticleSession, stepIndex: number): string {
  if (stepIndex === 3 && session.currentStep === 3 && session.imageProgress) {
    return session.imageProgress;
  }
  return STEPS[stepIndex];
}

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

function ImagePromptCard({ image, generatedImage }: { image: ImagePrompt; generatedImage?: GeneratedImage }) {
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
      {/* Generated image preview */}
      {generatedImage?.b64 && (
        <div className="border-b px-5 py-4" style={{ borderColor: "var(--card-border)" }}>
          <img
            src={`data:image/png;base64,${generatedImage.b64}`}
            alt={image.altText}
            className="w-full rounded-lg"
            style={{ aspectRatio: "1536/1024", objectFit: "cover" }}
          />
        </div>
      )}
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
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

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
    wpUrl: "",
    wpUsername: "",
    wpAppPassword: "",
  });
  const [showAdvancedJsonPaste, setShowAdvancedJsonPaste] = useState(false);
  const [advancedJsonValue, setAdvancedJsonValue] = useState("");

  // WordPress blogs
  const [wpBlogs, setWpBlogs] = useState<WpBlog[]>([]);
  const [selectedBlogId, setSelectedBlogId] = useState<string>("");

  // AI Image generation toggles
  const [generateImages, setGenerateImages] = useState(false);
  const [batchGenerateImages, setBatchGenerateImages] = useState(false);
  const [clusterGenerateImages, setClusterGenerateImages] = useState(false);

  // Credits & role
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [userRole, setUserRole] = useState<string>("user");
  const isAdmin = userRole === "admin";

  // Mode & batch state
  const [mode, setMode] = useState<"single" | "batch" | "cluster">("single");
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

  // Auth check and data loading
  useEffect(() => {
    const init = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.replace("/?auth=login");
        return;
      }
      setUser(currentUser);

      // Load user settings
      const { data: settings } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", currentUser.id)
        .single();

      if (settings) {
        setAdvancedSettings({
          domain: settings.domain || "",
          siteName: settings.site_name || "",
          siteAbout: settings.site_about || "",
          authorName: settings.author_name || "",
          authorAbout: settings.author_about || "",
          wpUrl: settings.wp_url || "",
          wpUsername: settings.wp_username || "",
          wpAppPassword: settings.wp_app_password || "",
        });

        // Load WordPress blogs
        const blogs = settings.wp_blogs as WpBlog[] | null;
        if (blogs && Array.isArray(blogs) && blogs.length > 0) {
          setWpBlogs(blogs);
          setSelectedBlogId(blogs[0].id);
        } else if (settings.wp_url) {
          // Migrate legacy single blog
          const legacyBlog: WpBlog = {
            id: "legacy",
            name: new URL(settings.wp_url).hostname.replace("www.", ""),
            url: settings.wp_url,
            username: settings.wp_username || "",
            appPassword: settings.wp_app_password || "",
          };
          setWpBlogs([legacyBlog]);
          setSelectedBlogId(legacyBlog.id);
        }
      }

      // Load credit info
      try {
        const creditRes = await fetch("/api/credits");
        const creditData = await creditRes.json();
        if (!creditData.error) {
          setUserCredits(creditData.credits);
          setUserPlan(creditData.plan || "free");
          setUserRole(creditData.role || "user");
        }
      } catch {
        // Credits will show as loading
      }

      // Load saved articles
      const { data: articles } = await supabase
        .from("articles")
        .select("*")
        .eq("user_id", currentUser.id)
        .is("cluster_id", null)
        .order("created_at", { ascending: false });

      if (articles && articles.length > 0) {
        const loaded: ArticleSession[] = articles.map((a) => ({
          id: a.id,
          topic: a.topic,
          focusKeyword: a.focus_keyword || "",
          loading: false,
          queued: false,
          error: "",
          result: a.article_markdown ? {
            title: a.title || a.topic,
            metaDescription: a.meta_description || "",
            slug: a.slug || "",
            focusKeyword: a.focus_keyword || "",
            keywords: a.keywords || [],
            article: a.article_markdown,
            imagePrompts: (a.image_prompts as ImagePrompt[]) || [],
            schema: a.schema_json || "",
          } : null,
          currentStep: 0,
          quality: (a.quality as "standard" | "premium") || "premium",
          posted: a.posted || false,
        }));
        setSessions(loaded);
      }

      // Load clusters
      const { data: clusterRows } = await supabase
        .from("clusters")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (clusterRows && clusterRows.length > 0) {
        const loadedClusters: TopicCluster[] = [];
        for (const c of clusterRows) {
          const { data: clusterArticles } = await supabase
            .from("articles")
            .select("*")
            .eq("cluster_id", c.id)
            .order("created_at", { ascending: true });

          const pillarArticle = clusterArticles?.find((a) => a.is_pillar);
          const subArticles = clusterArticles?.filter((a) => !a.is_pillar) || [];

          const mapArticle = (a: Record<string, unknown>): ArticleSession => ({
            id: a.id as string,
            topic: a.topic as string,
            focusKeyword: (a.focus_keyword as string) || "",
            loading: false,
            queued: false,
            error: "",
            result: a.article_markdown ? {
              title: (a.title as string) || (a.topic as string),
              metaDescription: (a.meta_description as string) || "",
              slug: (a.slug as string) || "",
              focusKeyword: (a.focus_keyword as string) || "",
              keywords: (a.keywords as string[]) || [],
              article: a.article_markdown as string,
              imagePrompts: (a.image_prompts as ImagePrompt[]) || [],
              schema: (a.schema_json as string) || "",
            } : null,
            currentStep: 0,
            quality: ((a.quality as string) || "premium") as "standard" | "premium",
            posted: (a.posted as boolean) || false,
          });

          loadedClusters.push({
            id: c.id,
            pillarTopic: c.pillar_topic,
            pillarKeyword: c.pillar_keyword || "",
            pillarSession: pillarArticle ? mapArticle(pillarArticle) : null,
            clusterArticles: subArticles.map((a) => ({
              id: a.id,
              concept: a.topic,
              keyword: a.focus_keyword || "",
              relation: "",
              session: mapArticle(a),
            })),
            quality: (c.quality as "standard" | "premium") || "premium",
            generating: false,
            generationPhase: "done",
            expanded: false,
          });
        }
        setClusters(loadedClusters);
      }

      setDataLoaded(true);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save article to Supabase
  const saveArticleToDb = useCallback(
    async (session: ArticleSession, clusterId?: string, isPillar?: boolean, wpBlogId?: string) => {
      if (!user || !session.result) return;
      const { error } = await supabase.from("articles").upsert({
        id: session.id,
        user_id: user.id,
        topic: session.topic,
        focus_keyword: session.result.focusKeyword,
        quality: session.quality,
        title: session.result.title,
        meta_description: session.result.metaDescription,
        slug: session.result.slug,
        keywords: session.result.keywords,
        article_markdown: session.result.article,
        image_prompts: session.result.imagePrompts,
        schema_json: session.result.schema,
        posted: session.posted,
        cluster_id: clusterId || null,
        is_pillar: isPillar || false,
        wp_blog_id: wpBlogId || null,
        updated_at: new Date().toISOString(),
      });
      if (error) console.error("Save article error:", error);
    },
    [user, supabase]
  );

  // Save advanced settings to DB
  const saveSettingsToDb = useCallback(
    async (settings: AdvancedSettings) => {
      if (!user) return;
      const payload = {
        domain: settings.domain,
        site_name: settings.siteName,
        site_about: settings.siteAbout,
        author_name: settings.authorName,
        author_about: settings.authorAbout,
        wp_url: settings.wpUrl,
        wp_username: settings.wpUsername,
        wp_app_password: settings.wpAppPassword,
        updated_at: new Date().toISOString(),
      };
      const { data: existing } = await supabase
        .from("user_settings")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (existing) {
        await supabase.from("user_settings").update(payload).eq("user_id", user.id);
      } else {
        await supabase.from("user_settings").insert({ user_id: user.id, ...payload });
      }
    },
    [user, supabase]
  );

  // Save cluster to DB
  const saveClusterToDb = useCallback(
    async (cluster: TopicCluster, existingPillarUrl?: string) => {
      if (!user) return;
      await supabase.from("clusters").upsert({
        id: cluster.id,
        user_id: user.id,
        pillar_topic: cluster.pillarTopic,
        pillar_keyword: cluster.pillarKeyword,
        quality: cluster.quality,
        existing_pillar_url: existingPillarUrl || null,
        updated_at: new Date().toISOString(),
      });
    },
    [user, supabase]
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

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
      quality: "standard" | "premium" = "premium",
      withImages: boolean = false,
      blogId?: string
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

        // Override author info with blog-specific author if a blog is selected
        const selectedBlog = blogId ? wpBlogs.find((b) => b.id === blogId) : undefined;
        const effectiveSettings = selectedBlog?.authorName
          ? { ...advancedSettings, authorName: selectedBlog.authorName, authorAbout: selectedBlog.authorAbout || "" }
          : advancedSettings;

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
            advancedSettings: effectiveSettings,
          }
        );

        const result: GenerationResult = {
          title: metadataData.title as string,
          metaDescription: metadataData.metaDescription as string,
          slug: metadataData.slug as string,
          focusKeyword: metadataData.focusKeyword as string,
          keywords: (metadataData.keywords as string[]) || [],
          article: articleData.article as string,
          imagePrompts: articleData.imagePrompts as ImagePrompt[],
          schema: (articleData.schema as string) || "",
        };

        // Update credit display
        if (typeof articleData.credits === "number") {
          setUserCredits(articleData.credits);
        }

        // Generate AI images sequentially if toggle is on
        if (withImages && result.imagePrompts.length > 0) {
          const total = Math.min(result.imagePrompts.length, 4);
          const images: GeneratedImage[] = [];
          updateSession(id, { currentStep: 3, imageProgress: `Generating image 1 of ${total}...` });

          for (let i = 0; i < total; i++) {
            const img = result.imagePrompts[i];
            updateSession(id, { imageProgress: `Generating image ${i + 1} of ${total}...` });
            try {
              const { data: imageData } = await safeFetch(
                "/api/generate/images",
                { prompt: img.prompt, type: img.type, altText: img.altText }
              );
              if (imageData.image) {
                images.push(imageData.image as GeneratedImage);
              } else {
                images.push({ type: img.type, altText: img.altText, b64: null, success: false });
              }
            } catch {
              images.push({ type: img.type, altText: img.altText, b64: null, success: false });
            }
          }

          result.generatedImages = images;

          // Deduct 1 credit for images if any succeeded
          const successCount = images.filter((i) => i.success).length;
          if (successCount > 0) {
            try {
              const creditRes = await fetch("/api/credits/deduct", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description: "AI image generation" }),
              });
              const creditData = await creditRes.json();
              if (typeof creditData.credits === "number") {
                setUserCredits(creditData.credits);
              }
            } catch {
              // Credit deduction failed silently - images still valid
            }
          }

          updateSession(id, { imageProgress: undefined });
        }

        updateSession(id, { loading: false, result });

        // Save to DB
        saveArticleToDb({
          id, topic, focusKeyword: result.focusKeyword, loading: false, queued: false,
          error: "", result, currentStep: 0, quality, posted: false,
        }, undefined, undefined, blogId);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        updateSession(id, { loading: false, error: message });
      }
    },
    [updateSession, saveArticleToDb, advancedSettings, wpBlogs]
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
          runGeneration(item.id, item.topic, item.focusKeyword, item.quality, item.withImages, item.blogId)
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

    const creditsNeeded = generateImages ? 2 : 1;
    if (!isAdmin && userCredits !== null && userCredits < creditsNeeded) {
      setFormError(generateImages
        ? "You need 2 credits (1 article + 1 images). Please upgrade your plan."
        : "No credits remaining. Please upgrade your plan.");
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

    runGeneration(id, topic, focusKeyword, "premium", generateImages, selectedBlogId || undefined);
  };

  const handleBatchGenerate = () => {
    const validItems = batchItems.filter((item) => item.topic.trim());
    if (validItems.length === 0) {
      setFormError("Please enter at least one topic.");
      return;
    }

    const creditsPerArticle = batchGenerateImages ? 2 : 1;
    const totalCreditsNeeded = validItems.length * creditsPerArticle;
    if (!isAdmin && userCredits !== null && userCredits < totalCreditsNeeded) {
      setFormError(`You need ${totalCreditsNeeded} credits for ${validItems.length} article${validItems.length > 1 ? "s" : ""}${batchGenerateImages ? " with images" : ""}. You have ${userCredits}.`);
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
        withImages: batchGenerateImages,
        blogId: selectedBlogId || undefined,
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

  const handleDeleteSession = async (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    batchQueueRef.current = batchQueueRef.current.filter(
      (item) => item.id !== id
    );
    if (activeSessionId === id) {
      setActiveSessionId(null);
    }
    if (user) {
      await supabase.from("articles").delete().eq("id", id).eq("user_id", user.id);
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
      const updated: AdvancedSettings = {
        domain: (parsed.domain || parsed.url || "").trim(),
        siteName: (parsed.siteName || parsed.site_name || parsed.blogName || "").trim(),
        siteAbout: (parsed.siteAbout || parsed.site_about || parsed.blogAbout || parsed.about || "").trim(),
        authorName: (parsed.authorName || parsed.author_name || parsed.author || "").trim(),
        authorAbout: (parsed.authorAbout || parsed.author_about || parsed.authorBio || parsed.bio || "").trim(),
        wpUrl: (parsed.wpUrl || parsed.wp_url || "").trim(),
        wpUsername: (parsed.wpUsername || parsed.wp_username || "").trim(),
        wpAppPassword: (parsed.wpAppPassword || parsed.wp_app_password || "").trim(),
      };
      setAdvancedSettings(updated);
      saveSettingsToDb(updated);
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

  const settingsSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const updateAdvanced = (field: keyof AdvancedSettings, value: string) => {
    setAdvancedSettings((prev) => {
      const updated = { ...prev, [field]: value };
      if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current);
      settingsSaveTimer.current = setTimeout(() => saveSettingsToDb(updated), 1500);
      return updated;
    });
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

  // ── Topic Cluster State ──
  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [showClusterView, setShowClusterView] = useState(false);
  const [clusterPillarTopic, setClusterPillarTopic] = useState("");
  const [clusterPillarKeyword, setClusterPillarKeyword] = useState("");
  const [clusterQuality, setClusterQuality] = useState<"standard" | "premium">("premium");
  const [clusterCount, setClusterCount] = useState(30);
  const [clusterUseExistingPillar, setClusterUseExistingPillar] = useState(false);
  const [clusterExistingPillarUrl, setClusterExistingPillarUrl] = useState("");
  const [clusterExistingPillarSummary, setClusterExistingPillarSummary] = useState("");
  const [clusterActiveArticleId, setClusterActiveArticleId] = useState<string | null>(null);

  const activeCluster = clusters.find((c) => c.id === activeClusterId) || null;
  const activeClusterArticle = activeCluster
    ? clusterActiveArticleId === "pillar"
      ? activeCluster.pillarSession
      : activeCluster.clusterArticles.find((a) => a.id === clusterActiveArticleId)?.session || null
    : null;

  const showForm = activeSessionId === null && !showHelp && !showDashboard && !showClusterView;
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

  // Generate ideas state
  const [showIdeas, setShowIdeas] = useState(false);
  const [ideasNiche, setIdeasNiche] = useState("");
  const [ideasCount, setIdeasCount] = useState(5);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasResult, setIdeasResult] = useState<
    Array<{ concept: string; keyword: string }>
  >([]);

  const handleGenerateIdeas = async () => {
    if (!ideasNiche.trim()) return;
    setIdeasLoading(true);
    setIdeasResult([]);
    try {
      const res = await fetch("/api/generate/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: ideasNiche.trim(),
          count: ideasCount,
        }),
      });
      const data = await res.json();
      if (data.ideas) {
        setIdeasResult(data.ideas);
      }
    } catch {
      setFormError("Failed to generate ideas.");
    } finally {
      setIdeasLoading(false);
    }
  };

  const handleLoadIdeasToBatch = () => {
    const mapped = ideasResult.map((item) => ({
      id: crypto.randomUUID(),
      topic: item.concept,
      keyword: item.keyword,
    }));
    setBatchItems(mapped);
    setMode("batch");
    setShowIdeas(false);
    setIdeasResult([]);
  };


  const updateCluster = useCallback(
    (id: string, updates: Partial<TopicCluster>) => {
      setClusters((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      );
    },
    []
  );

  const updateClusterArticle = useCallback(
    (clusterId: string, articleId: string, session: Partial<ArticleSession>) => {
      setClusters((prev) =>
        prev.map((c) => {
          if (c.id !== clusterId) return c;
          if (articleId === "pillar" && c.pillarSession) {
            return { ...c, pillarSession: { ...c.pillarSession, ...session } };
          }
          return {
            ...c,
            clusterArticles: c.clusterArticles.map((a) =>
              a.id === articleId && a.session
                ? { ...a, session: { ...a.session, ...session } }
                : a
            ),
          };
        })
      );
    },
    []
  );

  const runClusterArticleGeneration = useCallback(
    async (
      clusterId: string,
      articleId: string,
      topic: string,
      focusKeyword: string | undefined,
      quality: "standard" | "premium",
      interlinking?: Record<string, unknown>,
      withImages: boolean = false
    ) => {
      try {
        const { data: researchData } = await safeFetch(
          "/api/generate/research",
          { topic, focusKeyword }
        );

        updateClusterArticle(clusterId, articleId, { currentStep: 1 });

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

        updateClusterArticle(clusterId, articleId, { currentStep: 2 });

        const targetWordCount = quality === "standard" ? 2000 : 4000;

        // Override author info with blog-specific author if a blog is selected
        const clusterBlog = selectedBlogId ? wpBlogs.find((b) => b.id === selectedBlogId) : undefined;
        const clusterSettings = clusterBlog?.authorName
          ? { ...advancedSettings, authorName: clusterBlog.authorName, authorAbout: clusterBlog.authorAbout || "" }
          : advancedSettings;

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
            advancedSettings: clusterSettings,
            interlinking,
          }
        );

        const clusterResult: GenerationResult = {
          title: metadataData.title as string,
          metaDescription: metadataData.metaDescription as string,
          slug: metadataData.slug as string,
          focusKeyword: metadataData.focusKeyword as string,
          keywords: (metadataData.keywords as string[]) || [],
          article: articleData.article as string,
          imagePrompts: articleData.imagePrompts as ImagePrompt[],
          schema: (articleData.schema as string) || "",
        };

        // Generate AI images sequentially if toggle is on
        if (withImages && clusterResult.imagePrompts.length > 0) {
          const total = Math.min(clusterResult.imagePrompts.length, 4);
          const images: GeneratedImage[] = [];
          updateClusterArticle(clusterId, articleId, { currentStep: 3, imageProgress: `Generating image 1 of ${total}...` });

          for (let i = 0; i < total; i++) {
            const img = clusterResult.imagePrompts[i];
            updateClusterArticle(clusterId, articleId, { imageProgress: `Generating image ${i + 1} of ${total}...` });
            try {
              const { data: imageData } = await safeFetch(
                "/api/generate/images",
                { prompt: img.prompt, type: img.type, altText: img.altText }
              );
              if (imageData.image) {
                images.push(imageData.image as GeneratedImage);
              } else {
                images.push({ type: img.type, altText: img.altText, b64: null, success: false });
              }
            } catch {
              images.push({ type: img.type, altText: img.altText, b64: null, success: false });
            }
          }

          clusterResult.generatedImages = images;

          if (images.filter((i) => i.success).length > 0) {
            try {
              const creditRes = await fetch("/api/credits/deduct", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description: "AI image generation (cluster)" }),
              });
              const creditData = await creditRes.json();
              if (typeof creditData.credits === "number") {
                setUserCredits(creditData.credits);
              }
            } catch { /* silent */ }
          }

          updateClusterArticle(clusterId, articleId, { imageProgress: undefined });
        }

        updateClusterArticle(clusterId, articleId, {
          loading: false,
          result: clusterResult,
        });

        // Save cluster article to DB
        const isPillar = articleId === "pillar";
        const saveId = isPillar ? `${clusterId}-pillar` : articleId;
        saveArticleToDb({
          id: saveId, topic, focusKeyword: clusterResult.focusKeyword, loading: false, queued: false,
          error: "", result: clusterResult, currentStep: 0, quality, posted: false,
        }, clusterId, isPillar, selectedBlogId || undefined);

        return metadataData.slug as string;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        updateClusterArticle(clusterId, articleId, {
          loading: false,
          error: message,
        });
        return null;
      }
    },
    [updateClusterArticle, advancedSettings, saveArticleToDb, selectedBlogId, wpBlogs]
  );

  const handleStartCluster = async () => {
    if (!clusterPillarTopic.trim()) {
      setFormError("Please enter a pillar page topic.");
      return;
    }
    if (!advancedSettings.domain.trim()) {
      setFormError("Domain is required for topic clusters (needed for internal links). Please fill in Advanced Settings.");
      return;
    }
    if (clusterUseExistingPillar && !clusterExistingPillarUrl.trim()) {
      setFormError("Please enter the URL of your existing pillar page.");
      return;
    }

    setFormError("");
    const clusterId = crypto.randomUUID();
    const domain = advancedSettings.domain.replace(/\/$/, "");
    const useExisting = clusterUseExistingPillar && clusterExistingPillarUrl.trim();
    const articleCount = Math.min(Math.max(clusterCount, 1), 30);
    const withImages = clusterGenerateImages;

    const newCluster: TopicCluster = {
      id: clusterId,
      pillarTopic: clusterPillarTopic.trim(),
      pillarKeyword: clusterPillarKeyword.trim(),
      pillarSession: null,
      clusterArticles: [],
      quality: clusterQuality,
      generating: true,
      generationPhase: "planning",
      expanded: true,
    };

    setClusters((prev) => [newCluster, ...prev]);
    saveClusterToDb(newCluster, useExisting ? clusterExistingPillarUrl.trim() : undefined);
    setActiveClusterId(clusterId);
    setShowClusterView(true);
    setClusterActiveArticleId(null);
    setActiveSessionId(null);
    setShowHelp(false);
    setShowDashboard(false);
    setSidebarOpen(false);

    try {
      // Phase 1: Generate cluster article ideas
      const res = await fetch("/api/generate/cluster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pillarTopic: clusterPillarTopic.trim(),
          pillarKeyword: clusterPillarKeyword.trim() || undefined,
          count: articleCount,
        }),
      });
      const data = await res.json();
      if (!data.clusterArticles?.length) {
        updateCluster(clusterId, { generating: false, generationPhase: "idle" });
        return;
      }

      const clusterArticles: ClusterArticle[] = data.clusterArticles.map(
        (a: { concept: string; keyword: string; relation: string }) => ({
          id: crypto.randomUUID(),
          concept: a.concept,
          keyword: a.keyword,
          relation: a.relation || "",
          session: null,
        })
      );

      let pillarUrl: string;

      if (useExisting) {
        // Use existing pillar URL - skip pillar generation
        pillarUrl = clusterExistingPillarUrl.trim().replace(/\/$/, "");

        // Create a "completed" pillar session with the provided info
        const existingPillarSession: ArticleSession = {
          id: "pillar",
          topic: clusterPillarTopic.trim(),
          focusKeyword: clusterPillarKeyword.trim(),
          loading: false,
          queued: false,
          error: "",
          result: {
            title: clusterPillarTopic.trim(),
            metaDescription: clusterExistingPillarSummary.trim() || `Pillar page about ${clusterPillarTopic.trim()}`,
            slug: pillarUrl.split("/").pop() || "",
            focusKeyword: clusterPillarKeyword.trim(),
            keywords: [],
            article: clusterExistingPillarSummary.trim() ? `*Existing pillar page*\n\n${clusterExistingPillarSummary.trim()}` : "*Existing pillar page - content hosted externally*",
            imagePrompts: [],
            schema: "",
          },
          currentStep: 0,
          quality: "premium",
          posted: true,
        };

        updateCluster(clusterId, {
          clusterArticles,
          pillarSession: existingPillarSession,
          generationPhase: "clusters",
        });
      } else {
        // Generate the pillar article first
        updateCluster(clusterId, {
          clusterArticles,
          generationPhase: "pillar",
        });

        const pillarSessionId = "pillar";
        const pillarSession: ArticleSession = {
          id: pillarSessionId,
          topic: clusterPillarTopic.trim(),
          focusKeyword: clusterPillarKeyword.trim(),
          loading: true,
          queued: false,
          error: "",
          result: null,
          currentStep: 0,
          quality: "premium",
          posted: false,
        };

        updateCluster(clusterId, { pillarSession });

        const pillarSlug = await runClusterArticleGeneration(
          clusterId,
          pillarSessionId,
          clusterPillarTopic.trim(),
          clusterPillarKeyword.trim() || undefined,
          "premium",
          undefined,
          withImages
        );

        if (!pillarSlug) {
          updateCluster(clusterId, { generating: false, generationPhase: "idle" });
          return;
        }

        pillarUrl = `${domain}/${pillarSlug}`;
      }

      // Phase 3: Generate cluster articles in batches of 2 with 60s delay
      if (activeCluster?.generationPhase !== "clusters") {
        updateCluster(clusterId, { generationPhase: "clusters" });
      }

      // Initialize all cluster sessions
      const updatedArticles = clusterArticles.map((a) => ({
        ...a,
        session: {
          id: a.id,
          topic: a.concept,
          focusKeyword: a.keyword,
          loading: false,
          queued: true,
          error: "",
          result: null,
          currentStep: 0,
          quality: clusterQuality,
          posted: false,
        } as ArticleSession,
      }));

      updateCluster(clusterId, { clusterArticles: updatedArticles });

      // Process in batches of 2
      const completedSlugs: Array<{ id: string; slug: string; title: string; keyword: string }> = [];

      for (let i = 0; i < updatedArticles.length; i += 2) {
        const batch = updatedArticles.slice(i, i + 2);

        // Mark batch as loading
        batch.forEach((a) => {
          updateClusterArticle(clusterId, a.id, { queued: false, loading: true });
        });

        // Generate batch in parallel
        const results = await Promise.all(
          batch.map((a) => {
            // Build sibling links from already-completed articles
            const siblingUrls = completedSlugs.slice(-4).map((s) => ({
              url: `${domain}/${s.slug}`,
              title: s.title,
              keyword: s.keyword,
            }));

            return runClusterArticleGeneration(
              clusterId,
              a.id,
              a.concept,
              a.keyword,
              clusterQuality,
              {
                pillarUrl,
                pillarTopic: clusterPillarTopic.trim(),
                siblingUrls,
              },
              withImages
            );
          })
        );

        // Collect completed slugs for future sibling linking
        results.forEach((slug, idx) => {
          if (slug) {
            completedSlugs.push({
              id: batch[idx].id,
              slug,
              title: batch[idx].concept,
              keyword: batch[idx].keyword,
            });
          }
        });

        // Wait 60s between batches if more remain
        if (i + 2 < updatedArticles.length) {
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

      // Phase 4: Re-generate pillar with all cluster links (only if we generated the pillar)
      if (!useExisting) {
        updateCluster(clusterId, { generationPhase: "relinking" });
        const allClusterUrls = completedSlugs.map((s) => ({
          url: `${domain}/${s.slug}`,
          title: s.title,
          keyword: s.keyword,
        }));

        updateClusterArticle(clusterId, "pillar", {
          loading: true,
          currentStep: 0,
          error: "",
          result: null,
        });

        await runClusterArticleGeneration(
          clusterId,
          "pillar",
          clusterPillarTopic.trim(),
          clusterPillarKeyword.trim() || undefined,
          "premium",
          {
            isPillar: true,
            clusterUrls: allClusterUrls,
          },
          withImages
        );
      }

      updateCluster(clusterId, {
        generating: false,
        generationPhase: "done",
      });
    } catch {
      updateCluster(clusterId, {
        generating: false,
        generationPhase: "idle",
      });
    }
  };

  // Shared advanced settings panel JSX
  const advancedSettingsPanel = (
    <div
      className="rounded-xl border"
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          Advanced Settings
          <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>(optional)</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showAdvanced ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {showAdvanced && (
        <div className="space-y-3 border-t px-4 py-4" style={{ borderColor: "var(--card-border)" }}>
          <div className="flex items-center justify-end gap-1">
            <input type="file" accept=".json" id="advanced-json-import" className="hidden" onChange={handleAdvancedJsonFile} />
            <button onClick={() => document.getElementById("advanced-json-import")?.click()} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors" style={{ color: "var(--accent)", background: "transparent" }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--background)"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              Upload
            </button>
            <span className="text-xs" style={{ color: "var(--card-border)" }}>|</span>
            <button onClick={() => setShowAdvancedJsonPaste(!showAdvancedJsonPaste)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors" style={{ color: showAdvancedJsonPaste ? "var(--foreground)" : "var(--accent)", background: showAdvancedJsonPaste ? "var(--background)" : "transparent" }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--background)"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = showAdvancedJsonPaste ? "var(--background)" : "transparent"; }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              Paste
            </button>
          </div>
          {showAdvancedJsonPaste && (
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", background: "var(--background)" }}>
              <textarea value={advancedJsonValue} onChange={(e) => setAdvancedJsonValue(e.target.value)} placeholder={`{\n  "domain": "https://yourblog.com",\n  "siteName": "Your Blog Name",\n  "siteAbout": "A blog about...",\n  "authorName": "John Doe",\n  "authorAbout": "Expert in..."\n}`} rows={5} className="mb-2 w-full resize-none rounded-lg border px-3 py-2 font-mono text-xs transition-colors focus:outline-none" style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--foreground)" }} onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "var(--accent)"; }} onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "var(--card-border)"; }} />
              <div className="flex justify-end">
                <button onClick={handleAdvancedPasteSubmit} disabled={!advancedJsonValue.trim()} className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-40" style={{ background: "var(--accent)" }}>Load Settings</button>
              </div>
            </div>
          )}
          {[
            { key: "domain" as const, label: "Domain", placeholder: "https://yourblog.com" },
            { key: "siteName" as const, label: "Site Name", placeholder: "Your Blog Name" },
            { key: "siteAbout" as const, label: "About the Blog", placeholder: "A blog about sustainable living and eco-friendly tips" },
            { key: "authorName" as const, label: "Author Name", placeholder: "John Doe" },
            { key: "authorAbout" as const, label: "About the Author", placeholder: "Expert in sustainable living with 10 years of experience" },
          ].map((field) => (
            <div key={field.key}>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--muted)" }}>{field.label}</label>
              <input type="text" value={advancedSettings[field.key]} onChange={(e) => updateAdvanced(field.key, e.target.value)} placeholder={field.placeholder} className="w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none" style={{ background: "var(--background)", borderColor: "var(--card-border)", color: "var(--foreground)" }} onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--accent)"; }} onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--card-border)"; }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const blogSelectorPanel = wpBlogs.length > 0 ? (
    <div className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
      <div>
        <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Publish to</div>
        <div className="text-xs" style={{ color: "var(--muted)" }}>Select a connected blog</div>
      </div>
      <select
        value={selectedBlogId}
        onChange={(e) => setSelectedBlogId(e.target.value)}
        className="rounded-lg border px-3 py-1.5 text-sm font-medium"
        style={{ borderColor: "var(--card-border)", background: "var(--background)", color: "var(--foreground)", outline: "none", maxWidth: 180 }}
      >
        <option value="">No blog</option>
        {wpBlogs.map((blog) => (
          <option key={blog.id} value={blog.id}>{blog.name || blog.url}</option>
        ))}
      </select>
    </div>
  ) : (
    <button
      onClick={() => router.push("/app/settings")}
      className="flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left"
      style={{ borderColor: "var(--card-border)", background: "var(--card)", cursor: "pointer" }}
    >
      <div>
        <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Connect a WordPress Blog</div>
        <div className="text-xs" style={{ color: "var(--muted)" }}>Set up publishing in Settings</div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
    </button>
  );

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
            <Image src="/logo.png" alt="Article Sauce" width={28} height={28} className="rounded" />
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
              setShowDashboard(false);
              setShowClusterView(false);
              setActiveClusterId(null);
              setClusterActiveArticleId(null);
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
                setShowClusterView(false);
                setActiveClusterId(null);
                setClusterActiveArticleId(null);
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
          {/* Topic Clusters Section */}
          {clusters.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                Topic Clusters
              </div>
              <div className="space-y-0.5">
                {clusters.map((cluster) => (
                  <div key={cluster.id}>
                    <button
                      onClick={() => {
                        const isExpanding = activeClusterId !== cluster.id;
                        setActiveClusterId(cluster.id);
                        setShowClusterView(true);
                        setActiveSessionId(null);
                        setShowHelp(false);
                        setShowDashboard(false);
                        setClusterActiveArticleId(null);
                        if (!isExpanding) {
                          updateCluster(cluster.id, { expanded: !cluster.expanded });
                        } else {
                          updateCluster(cluster.id, { expanded: true });
                        }
                        setSidebarOpen(false);
                      }}
                      className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors"
                      style={{
                        background: activeClusterId === cluster.id && showClusterView && !clusterActiveArticleId ? "var(--card)" : "transparent",
                        color: "var(--foreground)",
                      }}
                      onMouseEnter={(e) => {
                        if (!(activeClusterId === cluster.id && showClusterView && !clusterActiveArticleId))
                          (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.04)";
                      }}
                      onMouseLeave={(e) => {
                        if (!(activeClusterId === cluster.id && showClusterView && !clusterActiveArticleId))
                          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      }}
                    >
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transform: cluster.expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      <span className="flex items-center gap-1.5 truncate">
                        {cluster.generating ? (
                          <span className="sidebar-pulse block h-2 w-2 flex-shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                          </svg>
                        )}
                        <span className="truncate">{cluster.pillarKeyword || cluster.pillarTopic}</span>
                      </span>
                      {cluster.generating && (
                        <span className="ml-auto flex-shrink-0 text-[10px] tabular-nums" style={{ color: "var(--muted)" }}>
                          {cluster.generationPhase === "planning" ? "Planning..." :
                           cluster.generationPhase === "pillar" ? "Pillar..." :
                           cluster.generationPhase === "clusters" ? `${cluster.clusterArticles.filter((a) => a.session?.result).length}/${cluster.clusterArticles.length}` :
                           cluster.generationPhase === "relinking" ? "Linking..." : ""}
                        </span>
                      )}
                    </button>
                    {cluster.expanded && (
                      <div className="ml-4 space-y-0.5 border-l py-0.5 pl-2" style={{ borderColor: "var(--card-border)" }}>
                        {/* Pillar page */}
                        <button
                          onClick={() => {
                            setActiveClusterId(cluster.id);
                            setShowClusterView(true);
                            setClusterActiveArticleId("pillar");
                            setActiveSessionId(null);
                            setShowHelp(false);
                            setShowDashboard(false);
                            setSidebarOpen(false);
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors"
                          style={{
                            background: clusterActiveArticleId === "pillar" && activeClusterId === cluster.id ? "var(--card)" : "transparent",
                            color: "var(--foreground)",
                          }}
                          onMouseEnter={(e) => {
                            if (!(clusterActiveArticleId === "pillar" && activeClusterId === cluster.id))
                              (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.04)";
                          }}
                          onMouseLeave={(e) => {
                            if (!(clusterActiveArticleId === "pillar" && activeClusterId === cluster.id))
                              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                          }}
                        >
                          <span className="flex-shrink-0">
                            {cluster.pillarSession?.loading ? (
                              <span className="sidebar-pulse block h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
                            ) : cluster.pillarSession?.error ? (
                              <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "var(--error)" }} />
                            ) : cluster.pillarSession?.result ? (
                              <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "var(--success)" }} />
                            ) : (
                              <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "var(--card-border)" }} />
                            )}
                          </span>
                          <span className="truncate font-medium" style={{ color: "var(--accent)" }}>
                            Pillar: {cluster.pillarSession?.result?.title || cluster.pillarTopic}
                          </span>
                        </button>
                        {/* Cluster articles */}
                        {cluster.clusterArticles.map((article) => (
                          <button
                            key={article.id}
                            onClick={() => {
                              setActiveClusterId(cluster.id);
                              setShowClusterView(true);
                              setClusterActiveArticleId(article.id);
                              setActiveSessionId(null);
                              setShowHelp(false);
                              setShowDashboard(false);
                              setSidebarOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors"
                            style={{
                              background: clusterActiveArticleId === article.id && activeClusterId === cluster.id ? "var(--card)" : "transparent",
                            }}
                            onMouseEnter={(e) => {
                              if (!(clusterActiveArticleId === article.id && activeClusterId === cluster.id))
                                (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.04)";
                            }}
                            onMouseLeave={(e) => {
                              if (!(clusterActiveArticleId === article.id && activeClusterId === cluster.id))
                                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                            }}
                          >
                            <span className="flex-shrink-0">
                              {article.session?.loading ? (
                                <span className="sidebar-pulse block h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
                              ) : article.session?.error ? (
                                <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "var(--error)" }} />
                              ) : article.session?.result ? (
                                <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "#007aff" }} />
                              ) : article.session?.queued ? (
                                <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "var(--card-border)" }} />
                              ) : (
                                <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "var(--card-border)" }} />
                              )}
                            </span>
                            <span className="truncate" style={{ color: "var(--foreground)" }}>
                              {article.session?.result?.title || article.concept}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Articles section header */}
          {(sessions.length > 0 || clusters.length > 0) && sessions.length > 0 && clusters.length > 0 && (
            <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Articles
            </div>
          )}

          {sessions.length === 0 && clusters.length === 0 ? (
            <p
              className="px-3 py-6 text-center text-xs"
              style={{ color: "var(--muted)" }}
            >
              No articles yet. Start generating!
            </p>
          ) : sessions.length > 0 ? (
            <div className="space-y-1">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    setActiveSessionId(session.id);
                    setShowHelp(false);
                    setShowDashboard(false);
                    setShowClusterView(false);
                    setActiveClusterId(null);
                    setClusterActiveArticleId(null);
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
                        {getStepLabel(session)}
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
          ) : null}
        </div>

        {/* Credits & Navigation */}
        {user && (
          <div
            className="mt-auto border-t px-3 py-3"
            style={{ borderColor: "var(--card-border)" }}
          >
            {/* Credit display */}
            <div
              className="mb-2 rounded-lg px-3 py-2"
              style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--muted)" }}>Credits</span>
                <span className="text-xs font-bold" style={{ color: "var(--foreground)" }}>
                  {isAdmin ? "Unlimited" : userCredits !== null ? userCredits : "..."}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--muted)" }}>Plan</span>
                <span className="text-xs font-semibold" style={{ color: "var(--accent)", textTransform: "capitalize" }}>
                  {isAdmin ? "Admin" : userPlan}
                </span>
              </div>
            </div>

            {/* Nav links */}
            <div className="mb-2 flex flex-col gap-1">
              <button
                onClick={() => router.push("/app/billing")}
                className="w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors"
                style={{ color: "var(--muted)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--background)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                Billing & Credits
              </button>
              <button
                onClick={() => router.push("/app/settings")}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors"
                style={{ color: "var(--muted)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--background)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <span>Settings</span>
                {wpBlogs.length > 0 ? (
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--success)" }}>
                    <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "var(--success)" }} />
                    {wpBlogs.length} blog{wpBlogs.length > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--muted)" }}>
                    <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "var(--card-border)" }} />
                    No blogs
                  </span>
                )}
              </button>
              {isAdmin && (
                <button
                  onClick={() => router.push("/app/admin")}
                  className="w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors"
                  style={{ color: "var(--error)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--background)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  Admin Dashboard
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span
                className="truncate text-xs"
                style={{ color: "var(--muted)" }}
                title={user.email}
              >
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="ml-2 flex-shrink-0 rounded px-2 py-1 text-xs transition-colors"
                style={{ color: "var(--muted)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--error)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)";
                }}
                title="Sign out"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        )}
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
          <Image src="/logo.png" alt="Article Sauce" width={24} height={24} className="rounded" />
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

                {/* Stats Cards */}
                <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                    <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                      {sessions.filter((s) => s.result).length}
                    </div>
                    <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>Articles Generated</div>
                  </div>
                  <div className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                    <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                      {clusters.length}
                    </div>
                    <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>Topic Clusters</div>
                  </div>
                  <div className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                    <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                      {clusters.reduce((sum, c) => sum + c.clusterArticles.filter((a) => a.session?.result).length + (c.pillarSession?.result ? 1 : 0), 0)}
                    </div>
                    <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>Cluster Articles</div>
                  </div>
                  <div className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                    <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                      {sessions.filter((s) => s.result && !s.posted).length + clusters.reduce((sum, c) => sum + c.clusterArticles.filter((a) => a.session?.result && !a.session.posted).length + (c.pillarSession?.result && !c.pillarSession.posted ? 1 : 0), 0)}
                    </div>
                    <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>Ready to Post</div>
                  </div>
                </div>

                {/* Topic Clusters Visual */}
                {clusters.length > 0 && (
                  <div className="mb-8">
                    <h3
                      className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider"
                      style={{ color: "var(--muted)" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                      Topic Clusters
                    </h3>
                    <div className="space-y-3">
                      {clusters.map((cluster) => {
                        const completedArticles = cluster.clusterArticles.filter((a) => a.session?.result).length;
                        const totalArticles = cluster.clusterArticles.length;
                        const hasPillar = !!cluster.pillarSession?.result;
                        const progress = totalArticles > 0 ? Math.round((completedArticles / totalArticles) * 100) : 0;

                        return (
                          <div key={cluster.id} className="rounded-xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                            <div className="flex items-center gap-3 p-4">
                              <button
                                className="min-w-0 flex-1 text-left"
                                onClick={() => {
                                  setActiveClusterId(cluster.id);
                                  setShowClusterView(true);
                                  setShowDashboard(false);
                                  setActiveSessionId(null);
                                  setClusterActiveArticleId(null);
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                                    {cluster.pillarKeyword || cluster.pillarTopic}
                                  </span>
                                  {cluster.generating && (
                                    <span className="sidebar-pulse inline-block h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />
                                  )}
                                  {!cluster.generating && cluster.generationPhase === "done" && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                                  )}
                                </div>
                                <div className="mt-1 flex items-center gap-3 text-xs" style={{ color: "var(--muted)" }}>
                                  <span>{hasPillar ? "1 pillar" : "No pillar"}</span>
                                  <span>&middot;</span>
                                  <span>{completedArticles}/{totalArticles} articles</span>
                                  <span>&middot;</span>
                                  <span>{cluster.quality}</span>
                                </div>
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete cluster "${cluster.pillarKeyword || cluster.pillarTopic}" and all its articles?`)) {
                                    // Remove cluster articles from DB
                                    if (user) {
                                      const articleIds = cluster.clusterArticles.map((a) => a.id);
                                      if (cluster.pillarSession) articleIds.push(`${cluster.id}-pillar`);
                                      supabase.from("articles").delete().in("id", articleIds).then(() => {});
                                      supabase.from("clusters").delete().eq("id", cluster.id).then(() => {});
                                    }
                                    setClusters((prev) => prev.filter((c) => c.id !== cluster.id));
                                    if (activeClusterId === cluster.id) {
                                      setActiveClusterId(null);
                                      setShowClusterView(false);
                                    }
                                  }
                                }}
                                className="flex-shrink-0 rounded-lg p-1.5 transition-colors"
                                style={{ color: "var(--muted)" }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}
                                title="Delete cluster"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                            {/* Progress bar */}
                            {totalArticles > 0 && (
                              <div className="px-4 pb-3">
                                <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--card-border)" }}>
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${progress}%`, background: progress === 100 ? "var(--success)" : "var(--accent)" }}
                                  />
                                </div>
                              </div>
                            )}
                            {/* Cluster article pills */}
                            {totalArticles > 0 && (
                              <div className="flex flex-wrap gap-1.5 border-t px-4 py-3" style={{ borderColor: "var(--card-border)" }}>
                                {hasPillar && (
                                  <button
                                    onClick={() => {
                                      setActiveClusterId(cluster.id);
                                      setShowClusterView(true);
                                      setShowDashboard(false);
                                      setActiveSessionId(null);
                                      setClusterActiveArticleId("pillar");
                                    }}
                                    className="rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors"
                                    style={{ background: "rgba(0, 122, 255, 0.1)", color: "var(--accent)" }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0, 122, 255, 0.2)"; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0, 122, 255, 0.1)"; }}
                                  >
                                    Pillar
                                  </button>
                                )}
                                {cluster.clusterArticles.map((art) => (
                                  <button
                                    key={art.id}
                                    onClick={() => {
                                      setActiveClusterId(cluster.id);
                                      setShowClusterView(true);
                                      setShowDashboard(false);
                                      setActiveSessionId(null);
                                      setClusterActiveArticleId(art.id);
                                    }}
                                    className="rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors"
                                    style={{
                                      background: art.session?.result ? "rgba(52, 199, 89, 0.1)" : art.session?.loading ? "rgba(0, 122, 255, 0.08)" : "rgba(0,0,0,0.04)",
                                      color: art.session?.result ? "var(--success)" : art.session?.loading ? "var(--accent)" : "var(--muted)",
                                    }}
                                    title={art.concept}
                                  >
                                    {art.keyword || art.concept.slice(0, 20)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                            <button
                              onClick={() => {
                                if (confirm("Delete this article?")) {
                                  if (user) supabase.from("articles").delete().eq("id", session.id).then(() => {});
                                  setSessions((prev) => prev.filter((s) => s.id !== session.id));
                                }
                              }}
                              className="flex-shrink-0 rounded-lg p-1 opacity-0 transition-all group-hover:opacity-100"
                              style={{ color: "var(--muted)" }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}
                              title="Delete article"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
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
                            <button
                              onClick={() => {
                                if (confirm("Delete this article?")) {
                                  if (user) supabase.from("articles").delete().eq("id", session.id).then(() => {});
                                  setSessions((prev) => prev.filter((s) => s.id !== session.id));
                                }
                              }}
                              className="flex-shrink-0 rounded-lg p-1 opacity-0 transition-all group-hover:opacity-100"
                              style={{ color: "var(--muted)" }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}
                              title="Delete article"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
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
                                  ? getStepLabel(session)
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
                            <button
                              onClick={() => {
                                setSessions((prev) => prev.filter((s) => s.id !== session.id));
                              }}
                              className="flex-shrink-0 rounded-lg p-1"
                              style={{ color: "var(--muted)" }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}
                              title="Remove"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
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
                  <button
                    onClick={() => {
                      setMode("cluster");
                      setFormError("");
                    }}
                    className="flex-1 px-4 py-2.5 text-sm font-medium transition-colors"
                    style={{
                      background:
                        mode === "cluster"
                          ? "var(--accent)"
                          : "var(--card)",
                      color: mode === "cluster" ? "#fff" : "var(--foreground)",
                    }}
                  >
                    Cluster
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

                    {advancedSettingsPanel}

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

                    {blogSelectorPanel}

                    {/* Generate AI Images toggle */}
                    <div
                      className="flex items-center justify-between rounded-xl border px-4 py-3"
                      style={{ borderColor: "var(--card-border)", background: "var(--card)" }}
                    >
                      <div>
                        <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                          Generate AI Images
                        </div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>
                          +1 credit &middot; 4 images at 1536x1024
                        </div>
                      </div>
                      <button
                        onClick={() => setGenerateImages(!generateImages)}
                        className="relative h-6 w-11 rounded-full transition-colors duration-200"
                        style={{
                          background: generateImages ? "var(--success)" : "var(--card-border)",
                        }}
                      >
                        <span
                          className="absolute top-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
                          style={{
                            transform: generateImages ? "translateX(22px)" : "translateX(2px)",
                          }}
                        />
                      </button>
                    </div>

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
                      Generate Article{generateImages ? " (2 credits)" : " (1 credit)"}
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
                          <span
                            className="text-xs"
                            style={{ color: "var(--card-border)" }}
                          >
                            |
                          </span>
                          <button
                            onClick={() => setShowIdeas(true)}
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
                              <path d="M9 18h6" />
                              <path d="M10 22h4" />
                              <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
                            </svg>
                            Ideas
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

                    {blogSelectorPanel}

                    {/* Generate AI Images Toggle */}
                    <div
                      className="flex items-center justify-between rounded-xl border p-4"
                      style={{ borderColor: "var(--card-border)", background: "var(--card)" }}
                    >
                      <div>
                        <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Generate AI Images</div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>+1 credit per article &middot; 4 images each</div>
                      </div>
                      <button
                        onClick={() => setBatchGenerateImages(!batchGenerateImages)}
                        className="relative h-6 w-11 rounded-full transition-colors duration-200"
                        style={{ background: batchGenerateImages ? "var(--success)" : "var(--card-border)" }}
                      >
                        <span
                          className="absolute top-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
                          style={{ transform: batchGenerateImages ? "translateX(22px)" : "translateX(2px)" }}
                        />
                      </button>
                    </div>

                    {advancedSettingsPanel}

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
                      {batchGenerateImages ? ` (${validBatchCount * 2} credits)` : ` (${validBatchCount} credit${validBatchCount === 1 ? "" : "s"})`}
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

                {/* Cluster mode form */}
                {mode === "cluster" && (
                  <div className="space-y-5">
                    <div
                      className="rounded-xl border p-4"
                      style={{
                        background: "var(--card)",
                        borderColor: "var(--card-border)",
                      }}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                        <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                          Topic Cluster Generator
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                        Generate a comprehensive topic cluster: one pillar page plus interlinked cluster articles.
                        All articles will link back to the pillar page and cross-link to each other following SEO best practices.
                        Advanced settings with your domain are required for internal linking.
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium" style={{ color: "var(--muted)" }}>
                        Article Quality
                      </label>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setClusterQuality("standard")}
                          className="flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-colors"
                          style={{
                            background: clusterQuality === "standard" ? "var(--accent)" : "var(--card)",
                            color: clusterQuality === "standard" ? "#fff" : "var(--foreground)",
                            borderColor: clusterQuality === "standard" ? "var(--accent)" : "var(--card-border)",
                          }}
                        >
                          Standard
                          <span className="block text-xs font-normal" style={{ opacity: 0.7 }}>~2,000 words</span>
                        </button>
                        <button
                          onClick={() => setClusterQuality("premium")}
                          className="flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-colors"
                          style={{
                            background: clusterQuality === "premium" ? "var(--accent)" : "var(--card)",
                            color: clusterQuality === "premium" ? "#fff" : "var(--foreground)",
                            borderColor: clusterQuality === "premium" ? "var(--accent)" : "var(--card-border)",
                          }}
                        >
                          Premium
                          <span className="block text-xs font-normal" style={{ opacity: 0.7 }}>~4,000 words</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium" style={{ color: "var(--muted)" }}>
                        Number of Cluster Articles
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={1}
                          max={30}
                          value={clusterCount}
                          onChange={(e) => setClusterCount(Number(e.target.value))}
                          className="flex-1"
                          style={{ accentColor: "var(--accent)" }}
                        />
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={clusterCount}
                          onChange={(e) => setClusterCount(Math.min(30, Math.max(1, Number(e.target.value))))}
                          className="w-16 rounded-lg border px-3 py-2 text-center text-sm font-medium focus:outline-none"
                          style={{
                            background: "var(--card)",
                            borderColor: "var(--card-border)",
                            color: "var(--foreground)",
                          }}
                          onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--accent)"; }}
                          onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--card-border)"; }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium" style={{ color: "var(--muted)" }}>
                        Pillar Page Topic
                      </label>
                      <textarea
                        value={clusterPillarTopic}
                        onChange={(e) => setClusterPillarTopic(e.target.value)}
                        placeholder="e.g., The Complete Guide to Indoor Herb Gardening"
                        rows={3}
                        className="w-full resize-none rounded-xl border px-4 py-3 text-base transition-colors focus:outline-none"
                        style={{
                          background: "var(--card)",
                          borderColor: "var(--card-border)",
                          color: "var(--foreground)",
                        }}
                        onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "var(--accent)"; }}
                        onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "var(--card-border)"; }}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium" style={{ color: "var(--muted)" }}>
                        Pillar Focus Keyword
                      </label>
                      <input
                        type="text"
                        value={clusterPillarKeyword}
                        onChange={(e) => setClusterPillarKeyword(e.target.value)}
                        placeholder="e.g., indoor herb gardening"
                        className="w-full rounded-xl border px-4 py-3 text-base transition-colors focus:outline-none"
                        style={{
                          background: "var(--card)",
                          borderColor: "var(--card-border)",
                          color: "var(--foreground)",
                        }}
                        onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--accent)"; }}
                        onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--card-border)"; }}
                      />
                    </div>

                    {/* Existing pillar option */}
                    <div
                      className="rounded-xl border"
                      style={{ borderColor: "var(--card-border)", background: "var(--card)" }}
                    >
                      <button
                        onClick={() => setClusterUseExistingPillar(!clusterUseExistingPillar)}
                        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        <span className="flex items-center gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                          Use Existing Pillar Page
                          <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>(optional)</span>
                        </span>
                        <div
                          className="flex h-5 w-9 items-center rounded-full px-0.5 transition-colors"
                          style={{ background: clusterUseExistingPillar ? "var(--accent)" : "var(--card-border)" }}
                        >
                          <div
                            className="h-4 w-4 rounded-full bg-white shadow transition-transform"
                            style={{ transform: clusterUseExistingPillar ? "translateX(16px)" : "translateX(0)" }}
                          />
                        </div>
                      </button>
                      {clusterUseExistingPillar && (
                        <div className="space-y-3 border-t px-4 py-4" style={{ borderColor: "var(--card-border)" }}>
                          <p className="text-xs" style={{ color: "var(--muted)" }}>
                            Already have a pillar page? Provide the URL and a brief summary. Cluster articles will link to this URL instead of generating a new pillar page.
                          </p>
                          <div>
                            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--muted)" }}>
                              Pillar Page URL
                            </label>
                            <input
                              type="url"
                              value={clusterExistingPillarUrl}
                              onChange={(e) => setClusterExistingPillarUrl(e.target.value)}
                              placeholder="https://yourblog.com/pillar-article-slug"
                              className="w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none"
                              style={{
                                background: "var(--background)",
                                borderColor: "var(--card-border)",
                                color: "var(--foreground)",
                              }}
                              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--accent)"; }}
                              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--card-border)"; }}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--muted)" }}>
                              Summary of Pillar Content <span style={{ opacity: 0.6 }}>(optional, helps AI write better cluster articles)</span>
                            </label>
                            <textarea
                              value={clusterExistingPillarSummary}
                              onChange={(e) => setClusterExistingPillarSummary(e.target.value)}
                              placeholder="Brief description of what your pillar page covers..."
                              rows={3}
                              className="w-full resize-none rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none"
                              style={{
                                background: "var(--background)",
                                borderColor: "var(--card-border)",
                                color: "var(--foreground)",
                              }}
                              onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "var(--accent)"; }}
                              onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "var(--card-border)"; }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {blogSelectorPanel}

                    {/* Generate AI Images Toggle */}
                    <div
                      className="flex items-center justify-between rounded-xl border p-4"
                      style={{ borderColor: "var(--card-border)", background: "var(--card)" }}
                    >
                      <div>
                        <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Generate AI Images</div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>+1 credit per article &middot; 4 images each</div>
                      </div>
                      <button
                        onClick={() => setClusterGenerateImages(!clusterGenerateImages)}
                        className="relative h-6 w-11 rounded-full transition-colors duration-200"
                        style={{ background: clusterGenerateImages ? "var(--success)" : "var(--card-border)" }}
                      >
                        <span
                          className="absolute top-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
                          style={{ transform: clusterGenerateImages ? "translateX(22px)" : "translateX(2px)" }}
                        />
                      </button>
                    </div>

                    {advancedSettingsPanel}

                    {!advancedSettings.domain.trim() && (
                      <div
                        className="rounded-xl border px-4 py-3 text-sm"
                        style={{
                          borderColor: "var(--accent)",
                          background: "rgba(0, 122, 255, 0.06)",
                          color: "var(--accent)",
                        }}
                      >
                        Domain is required for topic clusters. Open Advanced Settings above to set your domain.
                      </div>
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
                      onClick={handleStartCluster}
                      disabled={!clusterPillarTopic.trim() || !advancedSettings.domain.trim() || (clusterUseExistingPillar && !clusterExistingPillarUrl.trim())}
                      className="w-full rounded-xl py-3.5 text-base font-semibold text-white transition-all duration-200 disabled:opacity-40"
                      style={{ background: "var(--accent)" }}
                      onMouseEnter={(e) => {
                        if (clusterPillarTopic.trim() && advancedSettings.domain.trim())
                          (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-hover)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "var(--accent)";
                      }}
                    >
                      Generate Topic Cluster ({clusterUseExistingPillar ? clusterCount : clusterCount + 1} Articles{clusterGenerateImages ? `, ${(clusterUseExistingPillar ? clusterCount : clusterCount + 1) * 2} credits` : ""})
                    </button>

                    <p className="text-center text-xs" style={{ color: "var(--muted)" }}>
                      {clusterUseExistingPillar
                        ? `Generates ${clusterCount} cluster articles linked to your existing pillar page.`
                        : `Generates 1 pillar page + ${clusterCount} cluster articles.`
                      }
                      {" "}Articles generate 2 at a time with 60-second intervals.
                      {!clusterUseExistingPillar && " The pillar page is regenerated at the end with links to all cluster articles."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Cluster View */}
            {showClusterView && activeCluster && (
              <div className="mx-auto max-w-4xl">
                {/* Cluster header */}
                <div className="mb-6">
                  <div className="mb-2 flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
                      Topic Cluster
                    </h2>
                    {activeCluster.generating && (
                      <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: "rgba(0, 122, 255, 0.1)", color: "var(--accent)" }}>
                        {activeCluster.generationPhase === "planning" ? "Planning cluster..." :
                         activeCluster.generationPhase === "pillar" ? "Generating pillar..." :
                         activeCluster.generationPhase === "clusters" ? "Generating cluster articles..." :
                         activeCluster.generationPhase === "relinking" ? "Re-linking pillar page..." : ""}
                      </span>
                    )}
                    {activeCluster.generationPhase === "done" && (
                      <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: "rgba(52, 199, 89, 0.1)", color: "var(--success)" }}>
                        Complete
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    {activeCluster.pillarKeyword || activeCluster.pillarTopic}
                  </p>
                </div>

                {/* Not viewing a specific article - show overview */}
                {!clusterActiveArticleId && (
                  <div className="space-y-4">
                    {/* Pillar card */}
                    <div
                      className="cursor-pointer rounded-xl border p-4 transition-colors"
                      style={{ borderColor: "var(--accent)", background: "rgba(0, 122, 255, 0.04)" }}
                      onClick={() => {
                        if (activeCluster.pillarSession) setClusterActiveArticleId("pillar");
                      }}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: "var(--accent)" }}>
                          Pillar
                        </span>
                        {activeCluster.pillarSession?.loading && (
                          <svg className="progress-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                        )}
                        {activeCluster.pillarSession?.result && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        )}
                        {activeCluster.pillarSession?.error && (
                          <span className="text-xs" style={{ color: "var(--error)" }}>Failed</span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                        {activeCluster.pillarSession?.result?.title || activeCluster.pillarTopic}
                      </h3>
                      <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                        {activeCluster.pillarSession?.result?.focusKeyword || activeCluster.pillarKeyword}
                      </p>
                    </div>

                    {/* Progress summary */}
                    {activeCluster.clusterArticles.length > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--card-border)" }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              background: "var(--accent)",
                              width: `${(activeCluster.clusterArticles.filter((a) => a.session?.result).length / activeCluster.clusterArticles.length) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                          {activeCluster.clusterArticles.filter((a) => a.session?.result).length}/{activeCluster.clusterArticles.length}
                        </span>
                      </div>
                    )}

                    {/* Cluster articles grid */}
                    {activeCluster.clusterArticles.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {activeCluster.clusterArticles.map((article, i) => (
                          <div
                            key={article.id}
                            className="cursor-pointer rounded-xl border p-3 transition-all hover:shadow-sm"
                            style={{
                              borderColor: article.session?.result ? "var(--card-border)" : article.session?.loading ? "var(--accent)" : "var(--card-border)",
                              background: article.session?.loading ? "rgba(0, 122, 255, 0.03)" : "var(--card)",
                              opacity: article.session?.queued && !article.session?.loading ? 0.6 : 1,
                            }}
                            onClick={() => {
                              if (article.session?.result || article.session?.error) setClusterActiveArticleId(article.id);
                            }}
                          >
                            <div className="mb-1 flex items-center gap-2">
                              <span className="text-[10px] font-bold tabular-nums" style={{ color: "var(--muted)" }}>
                                #{i + 1}
                              </span>
                              {article.session?.loading && (
                                <svg className="progress-spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                              )}
                              {article.session?.result && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                              )}
                              {article.session?.error && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                              )}
                              {article.session?.queued && (
                                <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "var(--card-border)" }} />
                              )}
                            </div>
                            <h4 className="truncate text-sm font-medium" style={{ color: "var(--foreground)" }}>
                              {article.session?.result?.title || article.concept}
                            </h4>
                            <p className="mt-0.5 truncate text-xs" style={{ color: "var(--muted)" }}>
                              {article.keyword}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Planning state */}
                    {activeCluster.generationPhase === "planning" && (
                      <div className="flex flex-col items-center py-12">
                        <svg className="progress-spinner mb-4" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Planning your topic cluster...</p>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>Generating 30 strategically interlinked article ideas</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Viewing a specific cluster article */}
                {clusterActiveArticleId && activeClusterArticle && (
                  <div>
                    <button
                      onClick={() => setClusterActiveArticleId(null)}
                      className="mb-4 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                      style={{ color: "var(--accent)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--card)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                      Back to cluster overview
                    </button>

                    {clusterActiveArticleId === "pillar" && (
                      <span className="mb-3 inline-block rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white" style={{ background: "var(--accent)" }}>
                        Pillar Page
                      </span>
                    )}

                    {/* Reuse the same result display logic as regular articles */}
                    {activeClusterArticle.loading && (
                      <div className="flex flex-col items-center justify-center py-20">
                        <div className="mb-6">
                          <div className="relative flex items-center justify-center gap-2">
                            {[0, 1, 2].map((i) => (
                              <div key={i} className="loading-dot h-2 w-2 rounded-full" style={{ background: "var(--accent)", animationDelay: `${i * 0.15}s` }} />
                            ))}
                          </div>
                        </div>
                        <h2 className="mb-2 text-center text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                          {activeClusterArticle.topic}
                        </h2>
                        <div className="mt-6 w-full max-w-xs space-y-3">
                          {STEPS.map((step, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm" style={{ color: i <= activeClusterArticle.currentStep ? "var(--foreground)" : "var(--muted)", opacity: i <= activeClusterArticle.currentStep ? 1 : 0.4 }}>
                              {i < activeClusterArticle.currentStep ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                              ) : i === activeClusterArticle.currentStep ? (
                                <svg className="progress-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                              ) : (
                                <div className="h-4 w-4 rounded-full border" style={{ borderColor: "var(--card-border)" }} />
                              )}
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeClusterArticle.error && (
                      <div className="flex flex-col items-center justify-center py-20">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(239, 68, 68, 0.1)" }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </div>
                        <h2 className="mb-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Generation Failed</h2>
                        <p className="mb-6 max-w-sm text-center text-sm" style={{ color: "var(--muted)" }}>{activeClusterArticle.error}</p>
                      </div>
                    )}

                    {activeClusterArticle.result && (
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
                            {activeClusterArticle.result.title}
                          </h2>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setResultView("data")}
                            className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                            style={{
                              background: resultView === "data" ? "var(--accent)" : "var(--card)",
                              color: resultView === "data" ? "#fff" : "var(--foreground)",
                            }}
                          >
                            Data
                          </button>
                          <button
                            onClick={() => setResultView("preview")}
                            className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                            style={{
                              background: resultView === "preview" ? "var(--accent)" : "var(--card)",
                              color: resultView === "preview" ? "#fff" : "var(--foreground)",
                            }}
                          >
                            Preview
                          </button>
                        </div>
                        {resultView === "data" ? (
                          <div className="space-y-4">
                            <OutputCard label="Title" content={activeClusterArticle.result.title} />
                            <OutputCard label="Meta Description" content={activeClusterArticle.result.metaDescription} />
                            <OutputCard label="Slug" content={activeClusterArticle.result.slug} />
                            <OutputCard label="Focus Keyword" content={activeClusterArticle.result.focusKeyword} />
                            <OutputCard label="Keywords" content={activeClusterArticle.result.keywords.join(", ")} />
                            <OutputCard label="Article (Markdown)" content={activeClusterArticle.result.article} large />
                            {activeClusterArticle.result.imagePrompts.length > 0 && (
                              <div>
                                <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--foreground)" }}>Image Prompts</h3>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  {activeClusterArticle.result.imagePrompts.map((img, i) => (
                                    <div key={i} className="rounded-xl border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                                      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "var(--card-border)" }}>
                                        <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>{img.type}</span>
                                        <CopyButton text={img.prompt} label="Copy" />
                                      </div>
                                      <div className="space-y-2 px-3 py-2.5">
                                        <div><span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>Prompt</span><p className="text-xs leading-relaxed" style={{ color: "var(--foreground)" }}>{img.prompt}</p></div>
                                        <div><span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>Alt Text</span><p className="text-xs" style={{ color: "var(--foreground)" }}>{img.altText}</p></div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {activeClusterArticle.result.schema && (
                              <OutputCard label="JSON-LD Schema" content={activeClusterArticle.result.schema} large />
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="mb-4 flex gap-2">
                              <CopyButton
                                text={activeClusterArticle.result.article.replace(/#{1,6}\s/g, "").replace(/\*\*/g, "").replace(/\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")}
                                label="Copy Plain Text"
                              />
                              <CopyButton
                                text={marked.parse(activeClusterArticle.result.article) as string}
                                label="Copy HTML"
                              />
                            </div>
                            <div
                              className="article-preview rounded-xl border p-6 sm:p-8"
                              style={{ background: "#fff", borderColor: "var(--card-border)" }}
                              dangerouslySetInnerHTML={{ __html: marked.parse(activeClusterArticle.result.article) as string }}
                            />
                          </div>
                        )}
                      </div>
                    )}
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
                      {getStepText(activeSession, i)}
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
                      onClick={() => {
                        updateSession(activeSession.id, {
                          posted: !activeSession.posted,
                        });
                        if (user) {
                          supabase.from("articles").update({ posted: !activeSession.posted, updated_at: new Date().toISOString() }).eq("id", activeSession.id).then(() => {});
                        }
                      }}
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
                    {wpBlogs.length > 0 && (
                      <button
                        onClick={() => {
                          if (activeSession.result?.generatedImages) {
                            try {
                              sessionStorage.setItem(`images-${activeSession.id}`, JSON.stringify(activeSession.result.generatedImages));
                            } catch { /* storage full, images won't be included */ }
                          }
                          router.push(`/app/publish/${activeSession.id}`);
                        }}
                        className="flex flex-shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200"
                        style={{
                          borderColor: "var(--card-border)",
                          background: "var(--card)",
                          color: "var(--accent)",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
                          (e.currentTarget as HTMLButtonElement).style.background = "var(--accent)";
                          (e.currentTarget as HTMLButtonElement).style.color = "#fff";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)";
                          (e.currentTarget as HTMLButtonElement).style.background = "var(--card)";
                          (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2L2 7l10 5 10-5-10-5z" />
                          <path d="M2 17l10 5 10-5" />
                          <path d="M2 12l10 5 10-5" />
                        </svg>
                        Publish to WordPress
                      </button>
                    )}
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
                          <ImagePromptCard key={i} image={image} generatedImage={activeSession.result?.generatedImages?.[i]} />
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

      {/* Generate Ideas Modal */}
      {showIdeas && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowIdeas(false);
            }
          }}
        >
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}
          />
          <div
            className="relative mx-4 w-full max-w-md rounded-2xl border shadow-2xl"
            style={{
              background: "var(--background)",
              borderColor: "var(--card-border)",
              animation: "modal-enter 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: "var(--card-border)" }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: "var(--card)" }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--foreground)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18h6" />
                    <path d="M10 22h4" />
                    <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
                  </svg>
                </div>
                <div>
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    Generate Ideas
                  </h3>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    AI-powered article idea generation
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowIdeas(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                style={{ color: "var(--muted)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--card)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "transparent";
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
            </div>

            {/* Body */}
            <div className="space-y-4 px-5 py-5">
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: "var(--foreground)" }}
                >
                  Niche
                </label>
                <input
                  type="text"
                  value={ideasNiche}
                  onChange={(e) => setIdeasNiche(e.target.value)}
                  placeholder="e.g., sustainable living, digital marketing, pet care"
                  className="w-full rounded-xl border px-4 py-3 text-sm transition-colors focus:outline-none"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--card-border)",
                    color: "var(--foreground)",
                  }}
                  onFocus={(e) => {
                    (e.target as HTMLInputElement).style.borderColor =
                      "var(--accent)";
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLInputElement).style.borderColor =
                      "var(--card-border)";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleGenerateIdeas();
                  }}
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: "var(--foreground)" }}
                >
                  Number of ideas
                </label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={ideasCount}
                  onChange={(e) =>
                    setIdeasCount(
                      Math.min(25, Math.max(1, Number(e.target.value)))
                    )
                  }
                  className="w-full rounded-xl border px-4 py-3 text-sm transition-colors focus:outline-none"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--card-border)",
                    color: "var(--foreground)",
                  }}
                  onFocus={(e) => {
                    (e.target as HTMLInputElement).style.borderColor =
                      "var(--accent)";
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLInputElement).style.borderColor =
                      "var(--card-border)";
                  }}
                />
              </div>
              <button
                onClick={handleGenerateIdeas}
                disabled={!ideasNiche.trim() || ideasLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-colors disabled:opacity-40"
                style={{ background: "var(--accent)" }}
                onMouseEnter={(e) => {
                  if (!(!ideasNiche.trim() || ideasLoading))
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--accent-hover)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--accent)";
                }}
              >
                {ideasLoading ? (
                  <>
                    <svg
                      className="progress-spinner"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  "Generate Ideas"
                )}
              </button>

              {/* Ideas results */}
              {ideasResult.length > 0 && (
                <div
                  className="rounded-xl border"
                  style={{
                    borderColor: "var(--card-border)",
                    background: "var(--card)",
                  }}
                >
                  <div className="px-4 py-3">
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--muted)" }}
                    >
                      {ideasResult.length} ideas generated
                    </span>
                  </div>
                  <div
                    className="max-h-56 space-y-1 overflow-y-auto border-t px-3 py-2"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    {ideasResult.map((idea, i) => (
                      <div
                        key={i}
                        className="rounded-lg px-3 py-2.5"
                        style={{ background: "var(--background)" }}
                      >
                        <span
                          className="block text-sm font-medium"
                          style={{ color: "var(--foreground)" }}
                        >
                          {idea.concept}
                        </span>
                        <span className="text-xs" style={{ color: "var(--muted)" }}>
                          {idea.keyword}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div
                    className="border-t px-4 py-3"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    <button
                      onClick={handleLoadIdeasToBatch}
                      className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-colors"
                      style={{ background: "var(--accent)" }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "var(--accent-hover)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "var(--accent)";
                      }}
                    >
                      Load into Batch Mode
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
