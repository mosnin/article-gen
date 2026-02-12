"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

interface WpBlog {
  id: string;
  name: string;
  url: string;
  username: string;
  appPassword: string;
}

interface ScheduledArticle {
  id: string;
  topic: string;
  focus_keyword: string;
  quality: string;
  generate_images: boolean;
  auto_publish: boolean;
  publish_status: string;
  wp_blog_id: string | null;
  category_ids: number[];
  scheduled_for: string;
  recurrence: string;
  recurrence_day: number | null;
  status: string;
  article_id: string | null;
  error_message: string | null;
  attempts: number;
  created_at: string;
  articles?: { title: string; posted: boolean } | null;
}

interface ExistingArticle {
  id: string;
  topic: string;
  title: string;
  focus_keyword: string;
  posted: boolean;
  quality: string;
}

interface BatchItem {
  id: string;
  topic: string;
  keyword: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type FormMode = "single" | "batch" | "existing";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function statusBadge(status: string) {
  const colors: Record<string, { bg: string; text: string }> = {
    pending: { bg: "rgba(59,130,246,0.12)", text: "rgb(59,130,246)" },
    processing: { bg: "rgba(234,179,8,0.12)", text: "rgb(202,138,4)" },
    completed: { bg: "rgba(34,197,94,0.12)", text: "rgb(22,163,74)" },
    failed: { bg: "rgba(239,68,68,0.12)", text: "rgb(220,38,38)" },
    cancelled: { bg: "rgba(156,163,175,0.12)", text: "rgb(107,114,128)" },
  };
  const c = colors[status] || colors.pending;
  return { background: c.bg, color: c.text, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5 };
}

const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--card-border)", background: "var(--background)", fontSize: 13, outline: "none" } as const;
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6 } as const;

export default function AutomatePage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<ScheduledArticle[]>([]);
  const [blogs, setBlogs] = useState<WpBlog[]>([]);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("single");
  const [formTopic, setFormTopic] = useState("");
  const [formKeyword, setFormKeyword] = useState("");
  const [formQuality, setFormQuality] = useState<"standard" | "premium">("premium");
  const [formImages, setFormImages] = useState(false);
  const [formAutoPublish, setFormAutoPublish] = useState(false);
  const [formBlogId, setFormBlogId] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("09:00");
  const [formRecurrence, setFormRecurrence] = useState<"one_time" | "daily" | "weekly">("one_time");
  const [formRecurrenceDay, setFormRecurrenceDay] = useState(1);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Batch mode state
  const [batchItems, setBatchItems] = useState<BatchItem[]>([{ id: crypto.randomUUID(), topic: "", keyword: "" }]);
  const [showJsonPaste, setShowJsonPaste] = useState(false);
  const [jsonPasteValue, setJsonPasteValue] = useState("");

  // Existing articles mode state
  const [existingArticles, setExistingArticles] = useState<ExistingArticle[]>([]);
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set());
  const [loadingArticles, setLoadingArticles] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/?auth=login"); return; }

      const [scheduleRes, settingsRes, creditRes] = await Promise.all([
        fetch("/api/schedules"),
        supabase.from("user_settings").select("wp_blogs").eq("user_id", user.id).single(),
        fetch("/api/credits"),
      ]);

      const scheduleData = await scheduleRes.json();
      if (scheduleData.schedules) setSchedules(scheduleData.schedules);

      if (settingsRes.data?.wp_blogs && Array.isArray(settingsRes.data.wp_blogs)) {
        setBlogs(settingsRes.data.wp_blogs);
      }

      const creditData = await creditRes.json();
      if (typeof creditData.credits === "number") setUserCredits(creditData.credits);
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Set default date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFormDate(tomorrow.toISOString().split("T")[0]);
  }, []);

  // Fetch existing unposted articles when switching to existing mode
  const fetchExistingArticles = useCallback(async () => {
    setLoadingArticles(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("articles")
        .select("id, topic, title, focus_keyword, posted, quality")
        .eq("user_id", user.id)
        .eq("posted", false)
        .order("created_at", { ascending: false });

      if (data) setExistingArticles(data);
    } catch {
      setFormError("Failed to load articles");
    } finally {
      setLoadingArticles(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (showForm && formMode === "existing") {
      fetchExistingArticles();
    }
  }, [showForm, formMode, fetchExistingArticles]);

  // --- Batch helpers ---

  const addBatchItem = () => {
    if (batchItems.length >= 25) return;
    setBatchItems((prev) => [...prev, { id: crypto.randomUUID(), topic: "", keyword: "" }]);
  };

  const removeBatchItem = (id: string) => {
    setBatchItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateBatchItem = (id: string, field: "topic" | "keyword", value: string) => {
    setBatchItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
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
    reader.onload = (evt) => { parseAndLoadJson(evt.target?.result as string); };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handlePasteJsonSubmit = () => {
    if (parseAndLoadJson(jsonPasteValue)) {
      setJsonPasteValue("");
      setShowJsonPaste(false);
    }
  };

  // --- Existing articles helpers ---

  const toggleArticleSelection = (id: string) => {
    setSelectedArticleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedArticleIds.size === existingArticles.length) {
      setSelectedArticleIds(new Set());
    } else {
      setSelectedArticleIds(new Set(existingArticles.map((a) => a.id)));
    }
  };

  // --- Submit handlers ---

  const handleSubmit = async () => {
    setFormError("");
    if (!formTopic.trim()) { setFormError("Topic is required"); return; }
    if (!formDate) { setFormError("Date is required"); return; }

    setFormSubmitting(true);
    try {
      const scheduledFor = new Date(`${formDate}T${formTime}:00`).toISOString();

      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: formTopic.trim(),
          focusKeyword: formKeyword.trim() || undefined,
          quality: formQuality,
          generateImages: formImages,
          autoPublish: formAutoPublish,
          publishStatus: "draft",
          wpBlogId: formBlogId || undefined,
          scheduledFor,
          recurrence: formRecurrence,
          recurrenceDay: formRecurrence === "weekly" ? formRecurrenceDay : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Failed to schedule"); return; }

      setFormTopic("");
      setFormKeyword("");
      setShowForm(false);
      fetchData();
    } catch {
      setFormError("Failed to schedule article");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleBatchSubmit = async () => {
    setFormError("");
    const validItems = batchItems.filter((item) => item.topic.trim());
    if (validItems.length === 0) { setFormError("Add at least one article with a topic"); return; }
    if (!formDate) { setFormError("Date is required"); return; }

    setFormSubmitting(true);
    try {
      const baseDate = new Date(`${formDate}T${formTime}:00`);
      let successCount = 0;

      for (let i = 0; i < validItems.length; i++) {
        const scheduledFor = new Date(baseDate.getTime() + i * 30 * 60 * 1000).toISOString();

        const res = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: validItems[i].topic.trim(),
            focusKeyword: validItems[i].keyword.trim() || undefined,
            quality: formQuality,
            generateImages: formImages,
            autoPublish: formAutoPublish,
            wpBlogId: formBlogId || undefined,
            scheduledFor,
            recurrence: "one_time",
          }),
        });

        if (res.ok) successCount++;
      }

      setBatchItems([{ id: crypto.randomUUID(), topic: "", keyword: "" }]);
      setShowForm(false);
      fetchData();
      if (successCount < validItems.length) {
        setFormError(`Scheduled ${successCount} of ${validItems.length} articles. Some may have failed due to insufficient credits.`);
      }
    } catch {
      setFormError("Failed to schedule articles");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleExistingSubmit = async () => {
    setFormError("");
    if (selectedArticleIds.size === 0) { setFormError("Select at least one article"); return; }
    if (!formBlogId) { setFormError("Select a blog to publish to"); return; }
    if (!formDate) { setFormError("Date is required"); return; }

    setFormSubmitting(true);
    try {
      const baseDate = new Date(`${formDate}T${formTime}:00`);
      const articleIds = Array.from(selectedArticleIds);
      let successCount = 0;

      for (let i = 0; i < articleIds.length; i++) {
        const scheduledFor = new Date(baseDate.getTime() + i * 5 * 60 * 1000).toISOString();

        const res = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            articleId: articleIds[i],
            wpBlogId: formBlogId,
            publishStatus: "draft",
            scheduledFor,
          }),
        });

        if (res.ok) successCount++;
      }

      setSelectedArticleIds(new Set());
      setShowForm(false);
      fetchData();
      if (successCount < articleIds.length) {
        setFormError(`Scheduled ${successCount} of ${articleIds.length} articles. Some may have failed.`);
      }
    } catch {
      setFormError("Failed to schedule articles");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch {
      // silently fail
    }
  };

  const pendingSchedules = schedules.filter((s) => s.status === "pending");
  const activeSchedules = schedules.filter((s) => s.status === "processing");
  const completedSchedules = schedules.filter((s) => s.status === "completed" || s.status === "failed" || s.status === "cancelled");

  const validBatchCount = batchItems.filter((item) => item.topic.trim()).length;

  // Determine which submit handler and label to use
  const getSubmitHandler = () => {
    if (formMode === "batch") return handleBatchSubmit;
    if (formMode === "existing") return handleExistingSubmit;
    return handleSubmit;
  };

  const getSubmitLabel = () => {
    if (formMode === "batch") return `Schedule ${validBatchCount} Article${validBatchCount !== 1 ? "s" : ""}`;
    if (formMode === "existing") return `Schedule ${selectedArticleIds.size} Article${selectedArticleIds.size !== 1 ? "s" : ""}`;
    return "Schedule";
  };

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
      <header className="glass" style={{ borderBottom: "1px solid var(--card-border)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }} onClick={() => router.push("/app")}>
              <Image src="/logo.png" alt="Article Sauce" width={28} height={28} className="rounded-lg" style={{ boxShadow: "var(--shadow-sm)" }} />
              <span style={{ fontWeight: 700, fontSize: 17 }}>Article Sauce</span>
            </div>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>/</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Automate</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {userCredits !== null && (
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", background: "var(--card)", padding: "5px 12px", borderRadius: 8, border: "1px solid var(--card-border)" }}>
                {userCredits} credits
              </span>
            )}
            <button onClick={() => router.push("/app")} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: "var(--card)", border: "1px solid var(--card-border)", cursor: "pointer" }}>
              Back to App
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        {error && <div style={{ background: "rgba(239,68,68,0.1)", color: "rgb(220,38,38)", padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 500 }}>{error}</div>}

        {/* Title + Add button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Automate</h1>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              Automate article generation and publishing on autopilot. No browser needed.
            </p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setFormError(""); }}
            className="btn-accent"
            style={{
              padding: "10px 20px", borderRadius: 10, fontSize: 14,
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New Automation
          </button>
        </div>

        {/* Schedule Form */}
        {showForm && (
          <div style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 14, padding: 24, marginBottom: 28 }}>
            {/* Mode Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 20, background: "var(--background)", borderRadius: 10, padding: 3, border: "1px solid var(--card-border)" }}>
              {([
                { key: "single" as FormMode, label: "Single", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg> },
                { key: "batch" as FormMode, label: "Batch", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg> },
                { key: "existing" as FormMode, label: "Existing Articles", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg> },
              ]).map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => { setFormMode(key); setFormError(""); }}
                  style={{
                    flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    background: formMode === key ? "var(--accent)" : "transparent",
                    color: formMode === key ? "#fff" : "var(--foreground)",
                    border: "none", transition: "all 0.15s",
                  }}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            {/* SINGLE MODE */}
            {formMode === "single" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Topic</label>
                  <input
                    type="text"
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    placeholder="Best hiking trails in Colorado"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Focus Keyword (optional)</label>
                  <input
                    type="text"
                    value={formKeyword}
                    onChange={(e) => setFormKeyword(e.target.value)}
                    placeholder="hiking trails Colorado"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Quality</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["standard", "premium"] as const).map((q) => (
                      <button
                        key={q}
                        onClick={() => setFormQuality(q)}
                        style={{
                          flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: formQuality === q ? "var(--accent)" : "var(--background)",
                          color: formQuality === q ? "#fff" : "var(--foreground)",
                          border: `1px solid ${formQuality === q ? "var(--accent)" : "var(--card-border)"}`,
                          cursor: "pointer", textTransform: "capitalize",
                        }}
                      >
                        {q} {q === "standard" ? "(~2k words)" : "(~4k words)"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* BATCH MODE */}
            {formMode === "batch" && (
              <div style={{ marginBottom: 16 }}>
                {/* Quality selector */}
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Quality</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["standard", "premium"] as const).map((q) => (
                      <button
                        key={q}
                        onClick={() => setFormQuality(q)}
                        style={{
                          flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: formQuality === q ? "var(--accent)" : "var(--background)",
                          color: formQuality === q ? "#fff" : "var(--foreground)",
                          border: `1px solid ${formQuality === q ? "var(--accent)" : "var(--card-border)"}`,
                          cursor: "pointer", textTransform: "capitalize",
                        }}
                      >
                        {q} {q === "standard" ? "(~2k words)" : "(~4k words)"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Article count + import buttons */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Articles ({batchItems.length}/25)</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="file"
                      accept=".json"
                      ref={fileInputRef}
                      onChange={handleImportJsonFile}
                      style={{ display: "none" }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", background: "rgba(99,102,241,0.08)", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
                    >
                      Upload JSON
                    </button>
                    <button
                      onClick={() => setShowJsonPaste(!showJsonPaste)}
                      style={{ fontSize: 11, fontWeight: 600, color: showJsonPaste ? "#fff" : "var(--accent)", background: showJsonPaste ? "var(--accent)" : "rgba(99,102,241,0.08)", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
                    >
                      Paste JSON
                    </button>
                  </div>
                </div>

                {/* JSON Paste textarea */}
                {showJsonPaste && (
                  <div style={{ marginBottom: 12, background: "var(--background)", borderRadius: 10, border: "1px solid var(--card-border)", padding: 12 }}>
                    <textarea
                      value={jsonPasteValue}
                      onChange={(e) => setJsonPasteValue(e.target.value)}
                      placeholder={`[\n  { "concept": "Article topic here", "keyword": "focus keyword" },\n  { "concept": "Another article topic", "keyword": "another keyword" }\n]`}
                      rows={6}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--card-border)", background: "var(--card)", fontSize: 12, outline: "none", resize: "vertical", fontFamily: "monospace" }}
                    />
                    <button
                      onClick={handlePasteJsonSubmit}
                      disabled={!jsonPasteValue.trim()}
                      style={{
                        marginTop: 8, fontSize: 12, fontWeight: 600, color: "#fff", background: "var(--accent)",
                        border: "none", borderRadius: 8, padding: "7px 16px", cursor: "pointer",
                        opacity: !jsonPasteValue.trim() ? 0.5 : 1,
                      }}
                    >
                      Load Articles
                    </button>
                  </div>
                )}

                {/* Batch items list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {batchItems.map((item, index) => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", width: 20, textAlign: "right", flexShrink: 0 }}>{index + 1}</span>
                      <input
                        type="text"
                        value={item.topic}
                        onChange={(e) => updateBatchItem(item.id, "topic", e.target.value)}
                        placeholder="Article topic / concept"
                        style={{ ...inputStyle, flex: 1, padding: "8px 12px", fontSize: 12 }}
                      />
                      <input
                        type="text"
                        value={item.keyword}
                        onChange={(e) => updateBatchItem(item.id, "keyword", e.target.value)}
                        placeholder="Keyword"
                        style={{ ...inputStyle, width: 140, flexShrink: 0, padding: "8px 12px", fontSize: 12 }}
                      />
                      {batchItems.length > 1 && (
                        <button
                          onClick={() => removeBatchItem(item.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, flexShrink: 0 }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {batchItems.length < 25 && (
                  <button
                    onClick={addBatchItem}
                    style={{
                      marginTop: 8, width: "100%", padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      color: "var(--muted)", background: "transparent",
                      border: "1px dashed var(--card-border)", cursor: "pointer",
                    }}
                  >
                    + Add Article
                  </button>
                )}

                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>Articles will be spaced 30 minutes apart starting from the scheduled time.</p>
              </div>
            )}

            {/* EXISTING ARTICLES MODE */}
            {formMode === "existing" && (
              <div style={{ marginBottom: 16 }}>
                {blogs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 16px", background: "var(--background)", borderRadius: 10 }}>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>You need a connected WordPress blog to schedule existing articles for publishing.</p>
                    <button
                      onClick={() => router.push("/app/settings")}
                      className="btn-accent"
                      style={{ padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}
                    >
                      Go to Settings
                    </button>
                  </div>
                ) : loadingArticles ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                    <svg className="progress-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                  </div>
                ) : existingArticles.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 16px", background: "var(--background)", borderRadius: 10 }}>
                    <p style={{ fontSize: 13, color: "var(--muted)" }}>No unposted articles found. Generate some articles first.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>
                        Select articles to schedule ({selectedArticleIds.size}/{existingArticles.length})
                      </label>
                      <button
                        onClick={toggleSelectAll}
                        style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
                      >
                        {selectedArticleIds.size === existingArticles.length ? "Deselect all" : "Select all"}
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto", borderRadius: 10, border: "1px solid var(--card-border)", background: "var(--background)" }}>
                      {existingArticles.map((article) => (
                        <label
                          key={article.id}
                          style={{
                            display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer",
                            background: selectedArticleIds.has(article.id) ? "rgba(99,102,241,0.06)" : "transparent",
                            transition: "background 0.1s",
                          }}
                        >
                          <div
                            onClick={(e) => { e.preventDefault(); toggleArticleSelection(article.id); }}
                            style={{
                              width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                              border: `2px solid ${selectedArticleIds.has(article.id) ? "var(--accent)" : "var(--card-border)"}`,
                              background: selectedArticleIds.has(article.id) ? "var(--accent)" : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                          >
                            {selectedArticleIds.has(article.id) && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {article.title || article.topic}
                            </div>
                            {article.focus_keyword && (
                              <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {article.focus_keyword}
                              </div>
                            )}
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 600, textTransform: "uppercase", padding: "2px 8px", borderRadius: 6, flexShrink: 0,
                            background: "rgba(0,122,255,0.1)", color: "#007aff",
                          }}>
                            {article.quality}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>Selected articles will be published to WordPress as drafts, spaced 5 minutes apart. No credits needed.</p>
                  </>
                )}
              </div>
            )}

            {/* Shared scheduling fields (all modes) */}
            {(formMode !== "existing" || (blogs.length > 0 && existingArticles.length > 0)) && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>Date</label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Time</label>
                    <input
                      type="time"
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {formMode === "single" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                    <div>
                      <label style={labelStyle}>Recurrence</label>
                      <select
                        value={formRecurrence}
                        onChange={(e) => setFormRecurrence(e.target.value as "one_time" | "daily" | "weekly")}
                        style={inputStyle}
                      >
                        <option value="one_time">One-time</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>
                    {formRecurrence === "weekly" && (
                      <div>
                        <label style={labelStyle}>Day of Week</label>
                        <select
                          value={formRecurrenceDay}
                          onChange={(e) => setFormRecurrenceDay(Number(e.target.value))}
                          style={inputStyle}
                        >
                          {DAY_NAMES.map((day, i) => <option key={i} value={i}>{day}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Blog selection + toggles */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                  <div>
                    <label style={labelStyle}>{formMode === "existing" ? "Publish to Blog" : "Publish to Blog"}</label>
                    <select
                      value={formBlogId}
                      onChange={(e) => { setFormBlogId(e.target.value); if (e.target.value) setFormAutoPublish(true); }}
                      style={inputStyle}
                    >
                      {formMode === "existing" ? (
                        <>
                          <option value="">Select a blog</option>
                          {blogs.map((blog) => (
                            <option key={blog.id} value={blog.id}>{blog.name || blog.url}</option>
                          ))}
                        </>
                      ) : (
                        <>
                          <option value="">Don&apos;t auto-publish</option>
                          {blogs.map((blog) => (
                            <option key={blog.id} value={blog.id}>{blog.name || blog.url}</option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                  {formMode !== "existing" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                        <div
                          onClick={() => setFormImages(!formImages)}
                          style={{
                            width: 40, height: 22, borderRadius: 12, position: "relative", cursor: "pointer",
                            background: formImages ? "var(--success)" : "var(--card-border)", transition: "background 0.2s",
                          }}
                        >
                          <div style={{
                            width: 18, height: 18, borderRadius: 10, background: "#fff", position: "absolute", top: 2,
                            transform: formImages ? "translateX(20px)" : "translateX(2px)", transition: "transform 0.2s",
                          }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>Generate images (+1 credit)</span>
                      </label>
                      {formBlogId && (
                        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                          <div
                            onClick={() => setFormAutoPublish(!formAutoPublish)}
                            style={{
                              width: 40, height: 22, borderRadius: 12, position: "relative", cursor: "pointer",
                              background: formAutoPublish ? "var(--success)" : "var(--card-border)", transition: "background 0.2s",
                            }}
                          >
                            <div style={{
                              width: 18, height: 18, borderRadius: 10, background: "#fff", position: "absolute", top: 2,
                              transform: formAutoPublish ? "translateX(20px)" : "translateX(2px)", transition: "transform 0.2s",
                            }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>Auto-publish as draft</span>
                        </label>
                      )}
                    </div>
                  )}
                </div>

                {formError && (
                  <div style={{ background: "rgba(239,68,68,0.1)", color: "rgb(220,38,38)", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 12, fontWeight: 500 }}>
                    {formError}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <button
                    onClick={() => { setShowForm(false); setFormError(""); }}
                    style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: "var(--background)", border: "1px solid var(--card-border)", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={getSubmitHandler()}
                    disabled={formSubmitting}
                    className="btn-accent"
                    style={{
                      padding: "10px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                      opacity: formSubmitting ? 0.6 : 1, display: "flex", alignItems: "center", gap: 8,
                    }}
                  >
                    {formSubmitting ? (
                      <><svg className="progress-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg> Scheduling...</>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        {getSubmitLabel()}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Pending / Upcoming */}
        {(pendingSchedules.length > 0 || activeSchedules.length > 0) && (
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
              Upcoming ({pendingSchedules.length + activeSchedules.length})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...activeSchedules, ...pendingSchedules].map((s) => (
                <div key={s.id} style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.articles?.title || s.topic}
                      </span>
                      <span style={statusBadge(s.status)}>{s.status}</span>
                      {s.article_id && !s.generate_images && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: "rgb(22,163,74)", background: "rgba(34,197,94,0.1)", padding: "2px 8px", borderRadius: 10, textTransform: "uppercase" }}>
                          publish only
                        </span>
                      )}
                      {s.recurrence !== "one_time" && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)", background: "rgba(99,102,241,0.1)", padding: "2px 8px", borderRadius: 10, textTransform: "uppercase" }}>
                          {s.recurrence}{s.recurrence === "weekly" && s.recurrence_day !== null ? ` (${DAY_NAMES[s.recurrence_day].slice(0, 3)})` : ""}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: "var(--muted)" }}>
                      <span>{formatDateTime(s.scheduled_for)}</span>
                      {s.wp_blog_id && blogs.find((b) => b.id === s.wp_blog_id) && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                          {blogs.find((b) => b.id === s.wp_blog_id)?.name}
                        </span>
                      )}
                      {s.generate_images && <span>+ images</span>}
                      <span>{s.quality}</span>
                    </div>
                  </div>
                  {s.status === "pending" && (
                    <button
                      onClick={() => handleDelete(s.id)}
                      style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, background: "transparent", border: "1px solid var(--card-border)", cursor: "pointer", color: "var(--muted)", marginLeft: 12 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--error)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Completed / History */}
        {completedSchedules.length > 0 && (
          <section>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
              History ({completedSchedules.length})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {completedSchedules.map((s) => (
                <div key={s.id} style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.75 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.articles?.title || s.topic}</span>
                      <span style={statusBadge(s.status)}>{s.status}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: "var(--muted)" }}>
                      <span>{formatDateTime(s.scheduled_for)}</span>
                      {s.error_message && <span style={{ color: "rgb(220,38,38)" }}>{s.error_message}</span>}
                      {s.article_id && s.articles?.title && (
                        <span
                          style={{ color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}
                          onClick={() => router.push(`/app/publish/${s.article_id}`)}
                        >
                          {s.articles.title}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(s.id)}
                    style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, background: "transparent", border: "1px solid var(--card-border)", cursor: "pointer", color: "var(--muted)", marginLeft: 12 }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {schedules.length === 0 && !showForm && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" style={{ margin: "0 auto 16px", opacity: 0.4 }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No automations yet</h3>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, maxWidth: 400, margin: "0 auto 20px" }}>
              Set up automated content generation and publishing. Articles are created and posted in the background — no browser needed.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="btn-accent"
              style={{
                padding: "10px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700,
              }}
            >
              Create Your First Automation
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
