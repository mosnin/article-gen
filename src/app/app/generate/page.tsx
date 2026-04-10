"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";
import type {
  ImagePrompt,
  GeneratedImage,
  GenerationResult,
  ArticleSession,
  BatchQueueItem,
  WpBlog,
  AdvancedSettings,
  ClusterArticle,
  TopicCluster,
} from "../types";
import { HelpPage } from "../components/HelpPage";
import { IdeasModal } from "../components/IdeasModal";
import { ClusterView } from "../components/ClusterView";
import { ArticleResultPanel } from "../components/ArticleResultPanel";
import OutlineEditor, { type OutlineItem } from "../components/OutlineEditor";

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

export default function Home() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [sessions, setSessions] = useState<ArticleSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
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
  // Other publish platforms (count only for hasAnyPlatform check)
  const [otherPlatformCount, setOtherPlatformCount] = useState(0);

  // Generation presets
  interface Preset {
    id: string;
    name: string;
    quality: "standard" | "premium";
    wordCount: number;
    withImages: boolean;
    tone?: string;
    targetAudience?: string;
  }
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  // Outline editor
  const [outlineTitle, setOutlineTitle] = useState("");
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [showOutlineEditor, setShowOutlineEditor] = useState(false);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [generatingWithOutline, setGeneratingWithOutline] = useState(false);

  // GSC keyword import
  const [gscConnected, setGscConnected] = useState(false);
  const [gscImporting, setGscImporting] = useState(false);
  const [showGscPicker, setShowGscPicker] = useState(false);
  const [gscQueries, setGscQueries] = useState<Array<{ query: string; impressions: number; clicks: number }>>([]);

  // Brand voice settings (from selected preset)
  const [activeTone, setActiveTone] = useState("Informative");
  const [activeTargetAudience, setActiveTargetAudience] = useState("General audience");

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


  const selectedBlog = useMemo(
    () => wpBlogs.find((blog) => blog.id === selectedBlogId) || null,
    [wpBlogs, selectedBlogId]
  );
  const inGeneralMode = !selectedBlogId;

  const normalizeScopeKey = useCallback((value?: string | null) => {
    if (!value) return "";
    return value.trim().replace(/\/$/, "");
  }, []);

  const selectedScopeKeys = useMemo(() => {
    if (inGeneralMode || !selectedBlog) return [] as string[];
    return [selectedBlog.id, selectedBlog.url]
      .map((value) => normalizeScopeKey(value))
      .filter(Boolean);
  }, [inGeneralMode, selectedBlog, normalizeScopeKey]);

  const isInSelectedScope = useCallback(
    (wpBlogId?: string | null) => {
      if (inGeneralMode) return !normalizeScopeKey(wpBlogId);
      const articleKey = normalizeScopeKey(wpBlogId);
      return !!articleKey && selectedScopeKeys.includes(articleKey);
    },
    [inGeneralMode, normalizeScopeKey, selectedScopeKeys]
  );

  const scopedSessions = useMemo(
    () => sessions.filter((session) => isInSelectedScope(session.wpBlogId)),
    [sessions, isInSelectedScope]
  );

  const activeSession =
    scopedSessions.find((session) => session.id === activeSessionId) || null;

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
          const normalizedBlogs = blogs
            .filter((blog) => blog?.url)
            .map((blog, index) => ({
              ...blog,
              id: blog.id || `blog-${index}-${blog.url.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`,
            }));

          setWpBlogs(normalizedBlogs);
          setSelectedBlogId(normalizedBlogs[0]?.id || "");
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

        // Count other platform accounts
        const shopifyCount = Array.isArray(settings.shopify_accounts) ? (settings.shopify_accounts as unknown[]).length : 0;
        const mediumCount = Array.isArray(settings.medium_accounts) ? (settings.medium_accounts as unknown[]).length : 0;
        const ghostCount = Array.isArray(settings.ghost_blogs) ? (settings.ghost_blogs as unknown[]).length : 0;
        const devtoCount = Array.isArray(settings.devto_accounts) ? (settings.devto_accounts as unknown[]).length : 0;
        setOtherPlatformCount(shopifyCount + mediumCount + ghostCount + devtoCount);

        // Load presets
        if (Array.isArray(settings.presets)) {
          setPresets(settings.presets as Preset[]);
        }

        // GSC connection status
        setGscConnected(!!settings.gsc_refresh_token);
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
          wpBlogId: a.wp_blog_id || null,
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
            generatedImages: (a.generated_images as GeneratedImage[]) || undefined,
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
          const clusterBlogId =
            (pillarArticle?.wp_blog_id as string | undefined) ||
            (subArticles.find((a) => a.wp_blog_id)?.wp_blog_id as string | undefined) ||
            null;

          const mapArticle = (a: Record<string, unknown>): ArticleSession => ({
            id: a.id as string,
            topic: a.topic as string,
            focusKeyword: (a.focus_keyword as string) || "",
            wpBlogId: (a.wp_blog_id as string) || null,
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
              generatedImages: (a.generated_images as GeneratedImage[]) || undefined,
            } : null,
            currentStep: 0,
            quality: ((a.quality as string) || "premium") as "standard" | "premium",
            posted: (a.posted as boolean) || false,
          });

          loadedClusters.push({
            id: c.id,
            pillarTopic: c.pillar_topic,
            pillarKeyword: c.pillar_keyword || "",
            wpBlogId: clusterBlogId,
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
        generated_images: session.result.generatedImages?.filter((i) => i.success) || [],
        posted: session.posted,
        cluster_id: clusterId || null,
        is_pillar: isPillar || false,
        wp_blog_id: wpBlogId ?? session.wpBlogId ?? null,
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
      blogId?: string,
      tone: string = "Informative",
      targetAudience: string = "General audience"
    ) => {
      try {
        // Batch 1: Context + Research (parallel inside the route)
        const { data: researchData } = await safeFetch(
          "/api/generate/research",
          { topic, focusKeyword, tone, targetAudience }
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
            tone,
            targetAudience,
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
            tone,
            targetAudience,
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
                { prompt: img.prompt, type: img.type, altText: img.altText, articleId: id, imageIndex: i }
              );
              if (imageData.image) {
                images.push(imageData.image as GeneratedImage);
              } else {
                images.push({ type: img.type, altText: img.altText, storagePath: null, publicUrl: null, success: false });
              }
            } catch {
              images.push({ type: img.type, altText: img.altText, storagePath: null, publicUrl: null, success: false });
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
          runGeneration(item.id, item.topic, item.focusKeyword, item.quality, item.withImages, item.blogId, item.tone || "Informative", item.targetAudience || "General audience")
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
        wpBlogId: selectedBlogId || null,
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

    runGeneration(id, topic, focusKeyword, "premium", generateImages, selectedBlogId || undefined, activeTone, activeTargetAudience);
  };

  const handlePreviewOutline = async () => {
    if (!formTopic.trim()) {
      setFormError("Please enter a topic first.");
      return;
    }
    setFormError("");
    setOutlineLoading(true);
    try {
      const res = await fetch("/api/generate/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: formTopic.trim(),
          focusKeyword: formKeyword.trim() || undefined,
          advancedSettings,
          tone: activeTone,
          targetAudience: activeTargetAudience,
        }),
      });
      const data = await res.json() as { title?: string; outline?: Array<{ level: number; heading: string; notes?: string }>; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Failed to generate outline");
      setOutlineTitle(data.title || formTopic.trim());
      setOutline(
        (data.outline || []).map((item) => ({
          id: crypto.randomUUID(),
          level: (item.level === 3 ? 3 : 2) as 2 | 3,
          heading: item.heading,
          notes: item.notes,
        }))
      );
      setShowOutlineEditor(true);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to generate outline");
    } finally {
      setOutlineLoading(false);
    }
  };

  const handleGenerateFromOutline = () => {
    if (!formTopic.trim()) return;

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
        wpBlogId: selectedBlogId || null,
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
    setShowOutlineEditor(false);
    setGeneratingWithOutline(true);
    setFormTopic("");
    setFormKeyword("");
    setFormError("");

    runGeneration(id, topic, focusKeyword, "premium", generateImages, selectedBlogId || undefined, activeTone, activeTargetAudience);
    setGeneratingWithOutline(false);
    setOutline([]);
  };

  const handleGscImport = async () => {
    if (gscImporting) return;
    setGscImporting(true);
    try {
      const res = await fetch("/api/gsc/queries");
      const data = await res.json() as { queries?: Array<{ query: string; impressions: number; clicks: number }>; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "Failed to fetch GSC data");
      setGscQueries(data.queries || []);
      setShowGscPicker(true);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to import from GSC");
    } finally {
      setGscImporting(false);
    }
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
      wpBlogId: selectedBlogId || null,
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
        tone: activeTone,
        targetAudience: activeTargetAudience,
      }))
    );

    setBatchItems([{ id: crypto.randomUUID(), topic: "", keyword: "" }]);
    setFormError("");

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
      session.quality,
      false,
      undefined,
      activeTone,
      activeTargetAudience
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

  const scopedClusters = useMemo(
    () => clusters.filter((cluster) => isInSelectedScope(cluster.wpBlogId)),
    [clusters, isInSelectedScope]
  );

  const activeCluster = scopedClusters.find((c) => c.id === activeClusterId) || null;
  const handleScopeChange = (nextBlogId: string) => {
    setSelectedBlogId(nextBlogId);

    const selectedNextBlog = wpBlogs.find((blog) => blog.id === nextBlogId) || null;
    const nextScopeKeys = nextBlogId && selectedNextBlog
      ? [selectedNextBlog.id, selectedNextBlog.url]
          .map((value) => normalizeScopeKey(value))
          .filter(Boolean)
      : [];

    const inNextScope = (scopeValue?: string | null) => {
      if (!nextBlogId) return !normalizeScopeKey(scopeValue);
      const key = normalizeScopeKey(scopeValue);
      return !!key && nextScopeKeys.includes(key);
    };

    if (activeSessionId) {
      const nextActiveSession = sessions.find(
        (session) => session.id === activeSessionId && inNextScope(session.wpBlogId)
      );
      if (!nextActiveSession) setActiveSessionId(null);
    }

    if (activeClusterId) {
      const nextActiveCluster = clusters.find(
        (cluster) => cluster.id === activeClusterId && inNextScope(cluster.wpBlogId)
      );
      if (!nextActiveCluster) {
        setActiveClusterId(null);
        setShowClusterView(false);
        setClusterActiveArticleId(null);
      }
    }
  };


  const showForm = activeSessionId === null && !showHelp && !showDashboard && !showClusterView;
  const loadingCount = scopedSessions.filter((s) => s.loading).length;
  const queuedCount = scopedSessions.filter((s) => s.queued).length;
  const validBatchCount = batchItems.filter((i) => i.topic.trim()).length;
  const [progressMinimized, setProgressMinimized] = useState(false);
  const activeCount = loadingCount + queuedCount;
  const completedInBatch = scopedSessions.filter(
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
          tone: activeTone,
          targetAudience: activeTargetAudience,
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
      withImages: boolean = false,
      tone: string = "Informative",
      targetAudience: string = "General audience"
    ) => {
      try {
        const { data: researchData } = await safeFetch(
          "/api/generate/research",
          { topic, focusKeyword, tone, targetAudience }
        );

        updateClusterArticle(clusterId, articleId, { currentStep: 1 });

        const { data: metadataData } = await safeFetch(
          "/api/generate/metadata",
          {
            topic,
            focusKeyword,
            articleContext: researchData.articleContext,
            researchContext: researchData.researchContext,
            tone,
            targetAudience,
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
            tone,
            targetAudience,
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
          const isPillarArticle = articleId === "pillar";
          const saveId = isPillarArticle ? `${clusterId}-pillar` : articleId;
          updateClusterArticle(clusterId, articleId, { currentStep: 3, imageProgress: `Generating image 1 of ${total}...` });

          for (let i = 0; i < total; i++) {
            const img = clusterResult.imagePrompts[i];
            updateClusterArticle(clusterId, articleId, { imageProgress: `Generating image ${i + 1} of ${total}...` });
            try {
              const { data: imageData } = await safeFetch(
                "/api/generate/images",
                { prompt: img.prompt, type: img.type, altText: img.altText, articleId: saveId, imageIndex: i }
              );
              if (imageData.image) {
                images.push(imageData.image as GeneratedImage);
              } else {
                images.push({ type: img.type, altText: img.altText, storagePath: null, publicUrl: null, success: false });
              }
            } catch {
              images.push({ type: img.type, altText: img.altText, storagePath: null, publicUrl: null, success: false });
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
      wpBlogId: selectedBlogId || null,
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

    try {
      // Phase 1: Generate cluster article ideas
      const res = await fetch("/api/generate/cluster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pillarTopic: clusterPillarTopic.trim(),
          pillarKeyword: clusterPillarKeyword.trim() || undefined,
          count: articleCount,
          tone: activeTone,
          targetAudience: activeTargetAudience,
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
          wpBlogId: selectedBlogId || null,
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
          wpBlogId: selectedBlogId || null,
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
          withImages,
          activeTone,
          activeTargetAudience
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
          wpBlogId: selectedBlogId || null,
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
              withImages,
              activeTone,
              activeTargetAudience
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
          withImages,
          activeTone,
          activeTargetAudience
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
    <div className="bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-xl">
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text-primary)]"
      >
        <span className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          Advanced Settings
          <span className="text-xs font-normal text-[var(--text-tertiary)]">(optional)</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showAdvanced ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {showAdvanced && (
        <div className="space-y-3 border-t border-[var(--border-default)] px-4 py-4">
          <div className="flex items-center justify-end gap-1">
            <input type="file" accept=".json" id="advanced-json-import" className="hidden" onChange={handleAdvancedJsonFile} />
            <button onClick={() => document.getElementById("advanced-json-import")?.click()} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--accent)] transition-colors hover:bg-[var(--surface-base)]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              Upload
            </button>
            <span className="text-xs text-[var(--border-default)]">|</span>
            <button onClick={() => setShowAdvancedJsonPaste(!showAdvancedJsonPaste)} className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors hover:bg-[var(--surface-base)] ${showAdvancedJsonPaste ? "text-[var(--text-primary)] bg-[var(--surface-base)]" : "text-[var(--accent)]"}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              Paste
            </button>
          </div>
          {showAdvancedJsonPaste && (
            <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-lg p-3">
              <textarea value={advancedJsonValue} onChange={(e) => setAdvancedJsonValue(e.target.value)} placeholder={`{\n  "domain": "https://yourblog.com",\n  "siteName": "Your Blog Name",\n  "siteAbout": "A blog about...",\n  "authorName": "John Doe",\n  "authorAbout": "Expert in..."\n}`} rows={5} className="mb-2 w-full resize-none border border-[var(--border-default)] rounded-lg px-3 py-2 font-mono text-xs bg-[var(--surface-raised)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent" />
              <div className="flex justify-end">
                <button onClick={handleAdvancedPasteSubmit} disabled={!advancedJsonValue.trim()} className="bg-[var(--accent)] text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40">Load Settings</button>
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
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{field.label}</label>
              <input type="text" value={advancedSettings[field.key]} onChange={(e) => updateAdvanced(field.key, e.target.value)} placeholder={field.placeholder} className="border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm bg-[var(--surface-base)] text-[var(--text-primary)] w-full focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent" />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const blogSelectorPanel = wpBlogs.length > 0 ? (
    <div className="bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-xl flex items-center justify-between px-4 py-3">
      <div>
        <div className="text-sm font-medium text-[var(--text-primary)]">Publish to</div>
        <div className="text-xs text-[var(--text-secondary)]">Choose blog-specific or general mode</div>
      </div>
      <select
        value={selectedBlogId}
        onChange={(e) => handleScopeChange(e.target.value)}
        className="border border-[var(--border-default)] rounded-lg px-3 py-1.5 text-sm font-medium bg-[var(--surface-base)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
        style={{ maxWidth: 180 }}
      >
        <option value="">General mode (no specific blog)</option>
        {wpBlogs.map((blog) => (
          <option key={blog.id} value={blog.id}>{blog.name || blog.url}</option>
        ))}
      </select>
    </div>
  ) : (
    <button
      onClick={() => router.push("/app/settings")}
      className="bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-xl flex w-full items-center justify-between px-4 py-3 text-left"
    >
      <div>
        <div className="text-sm font-medium text-[var(--text-primary)]">Connect a WordPress Blog</div>
        <div className="text-xs text-[var(--text-secondary)]">Set up publishing in Settings</div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
    </button>
  );

  return (
    <>

            {/* Help Page */}
            {showHelp && (
              <HelpPage onBack={() => setShowHelp(false)} />
            )}

            {/* Dashboard */}
            {showDashboard && (
              <div className="mx-auto max-w-4xl">
                <div className="mb-8">
                  <button
                    onClick={() => setShowDashboard(false)}
                    className="mb-6 flex items-center gap-1.5 text-sm font-medium text-[var(--accent)]"
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
                  <h2 className="mb-2 text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                    Dashboard
                  </h2>
                  <p className="mb-1 text-xs text-[var(--text-tertiary)]">
                    Scope: {selectedBlog ? selectedBlog.name || selectedBlog.url : "General mode (no specific blog)"}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {scopedSessions.filter((s) => s.result && !s.posted).length} need
                    to post &middot;{" "}
                    {scopedSessions.filter((s) => s.posted).length} posted
                  </p>
                </div>

                {/* Stats Cards */}
                <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-4">
                    <div className="text-2xl font-bold text-[var(--text-primary)]">
                      {scopedSessions.filter((s) => s.result).length}
                    </div>
                    <div className="text-xs font-medium text-[var(--text-secondary)]">Articles Generated</div>
                  </div>
                  <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-4">
                    <div className="text-2xl font-bold text-[var(--text-primary)]">
                      {scopedClusters.length}
                    </div>
                    <div className="text-xs font-medium text-[var(--text-secondary)]">Topic Clusters</div>
                  </div>
                  <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-4">
                    <div className="text-2xl font-bold text-[var(--text-primary)]">
                      {scopedClusters.reduce((sum, c) => sum + c.clusterArticles.filter((a) => a.session?.result).length + (c.pillarSession?.result ? 1 : 0), 0)}
                    </div>
                    <div className="text-xs font-medium text-[var(--text-secondary)]">Cluster Articles</div>
                  </div>
                  <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-4">
                    <div className="text-2xl font-bold text-[var(--text-primary)]">
                      {scopedSessions.filter((s) => s.result && !s.posted).length + scopedClusters.reduce((sum, c) => sum + c.clusterArticles.filter((a) => a.session?.result && !a.session.posted).length + (c.pillarSession?.result && !c.pillarSession.posted ? 1 : 0), 0)}
                    </div>
                    <div className="text-xs font-medium text-[var(--text-secondary)]">Ready to Post</div>
                  </div>
                </div>

                {/* Topic Clusters Visual */}
                {scopedClusters.length > 0 && (
                  <div className="mb-8">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                      Topic Clusters
                    </h3>
                    <div className="space-y-3">
                      {scopedClusters.map((cluster) => {
                        const completedArticles = cluster.clusterArticles.filter((a) => a.session?.result).length;
                        const totalArticles = cluster.clusterArticles.length;
                        const hasPillar = !!cluster.pillarSession?.result;
                        const progress = totalArticles > 0 ? Math.round((completedArticles / totalArticles) * 100) : 0;

                        return (
                          <div key={cluster.id} className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl overflow-hidden">
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
                                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                                    {cluster.pillarKeyword || cluster.pillarTopic}
                                  </span>
                                  {cluster.generating && (
                                    <span className="sidebar-pulse inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
                                  )}
                                  {!cluster.generating && cluster.generationPhase === "done" && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                                  )}
                                </div>
                                <div className="mt-1 flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
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
                                className="flex-shrink-0 rounded-lg p-1.5 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
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
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-default)]">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${progress}%`, background: progress === 100 ? "var(--success)" : "var(--accent)" }}
                                  />
                                </div>
                              </div>
                            )}
                            {/* Cluster article pills */}
                            {totalArticles > 0 && (
                              <div className="flex flex-wrap gap-1.5 border-t border-[var(--border-default)] px-4 py-3">
                                {hasPillar && (
                                  <button
                                    onClick={() => {
                                      setActiveClusterId(cluster.id);
                                      setShowClusterView(true);
                                      setShowDashboard(false);
                                      setActiveSessionId(null);
                                      setClusterActiveArticleId("pillar");
                                    }}
                                    className="rounded-full px-2.5 py-1 text-[10px] font-semibold bg-[var(--accent-light)] text-[var(--accent)] hover:opacity-80 transition-opacity"
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
                                    className="rounded-full px-2.5 py-1 text-[10px] font-medium transition-opacity hover:opacity-80"
                                    style={{
                                      background: art.session?.result ? "rgba(52, 199, 89, 0.1)" : art.session?.loading ? "rgba(0, 122, 255, 0.08)" : "rgba(0,0,0,0.04)",
                                      color: art.session?.result ? "var(--success)" : art.session?.loading ? "var(--accent)" : "var(--text-tertiary)",
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
                {scopedSessions.filter(
                  (s) => s.result && !s.posted && !s.loading && !s.queued
                ).length > 0 && (
                  <div className="mb-8">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
                      Need to Post
                    </h3>
                    <div className="space-y-2">
                      {scopedSessions
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
                            className="group flex items-center gap-3 bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl px-4 py-3 transition-colors"
                          >
                            <button
                              onClick={() =>
                                updateSession(session.id, { posted: true })
                              }
                              className="flex-shrink-0 rounded-full border-2 border-[var(--border-default)] hover:border-[var(--accent)] p-0.5 transition-colors"
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
                              <span className="block truncate text-sm font-medium text-[var(--text-primary)]">
                                {session.result?.title || session.topic}
                              </span>
                              <span className="block truncate text-xs text-[var(--text-secondary)]">
                                {session.result?.focusKeyword}
                              </span>
                            </button>
                            <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-[var(--accent-light)] text-[var(--accent)]">
                              Ready
                            </span>
                            <button
                              onClick={() => {
                                if (confirm("Delete this article?")) {
                                  if (user) supabase.from("articles").delete().eq("id", session.id).then(() => {});
                                  setSessions((prev) => prev.filter((s) => s.id !== session.id));
                                }
                              }}
                              className="flex-shrink-0 rounded-lg p-1 opacity-0 transition-all group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-red-500"
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
                {scopedSessions.filter((s) => s.posted).length > 0 && (
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
                      {scopedSessions
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
                {scopedSessions.filter(
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
                      {scopedSessions
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
                {scopedSessions.filter(
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
                      {scopedSessions
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
              <ClusterView
                activeCluster={activeCluster}
                clusterActiveArticleId={clusterActiveArticleId}
                onSelectArticle={setClusterActiveArticleId}
                resultView={resultView}
                onResultViewChange={setResultView}
                onPublish={(articleId) => router.push(`/app/publish/${articleId}`)}
                hasAnyPlatform={wpBlogs.length > 0 || otherPlatformCount > 0}
              />
            )}

            {/* Article States (Queued / Loading / Error / Result) */}
            {activeSession && !showClusterView && (
              <ArticleResultPanel
                session={activeSession}
                resultView={resultView}
                onResultViewChange={setResultView}
                onTogglePosted={() => {
                  updateSession(activeSession.id, { posted: !activeSession.posted });
                  if (user) {
                    supabase.from("articles").update({ posted: !activeSession.posted, updated_at: new Date().toISOString() }).eq("id", activeSession.id).then(() => {});
                  }
                }}
                onRetry={() => handleRetry(activeSession)}
                onPublish={() => router.push(`/app/publish/${activeSession.id}`)}
                hasAnyPlatform={wpBlogs.length > 0 || otherPlatformCount > 0}
                batchCountdown={batchCountdown}
              />
            )}

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
        <IdeasModal
          niche={ideasNiche}
          count={ideasCount}
          loading={ideasLoading}
          results={ideasResult}
          onNicheChange={setIdeasNiche}
          onCountChange={setIdeasCount}
          onGenerate={handleGenerateIdeas}
          onLoadToBatch={handleLoadIdeasToBatch}
          onClose={() => setShowIdeas(false)}
        />
      )}
  </>
  );
}
