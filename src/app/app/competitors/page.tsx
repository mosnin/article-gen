"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Competitor = {
  id: string;
  user_id: string;
  domain: string;
  feed_url: string | null;
  sitemap_url: string | null;
  label: string | null;
  active: boolean;
  last_checked_at: string | null;
  created_at: string;
};

type Classification =
  | "informational"
  | "comparison"
  | "launch"
  | "tutorial"
  | "listicle"
  | "news"
  | "other";

type ArticleStatus = "discovered" | "dismissed" | "queued" | "written";

type CompetitorArticle = {
  id: string;
  user_id: string;
  competitor_id: string | null;
  run_id: string | null;
  url: string;
  title: string;
  published_at: string | null;
  classification: Classification | null;
  rebuttal_topic: string | null;
  rebuttal_focus_keyword: string | null;
  rebuttal_angle: string | null;
  status: ArticleStatus;
  written_article_id: string | null;
  created_at: string;
};

type StatusTab = ArticleStatus;

const STATUS_TABS: Array<{ key: StatusTab; label: string }> = [
  { key: "discovered", label: "Discovered" },
  { key: "dismissed", label: "Dismissed" },
  { key: "queued", label: "Queued" },
  { key: "written", label: "Written" },
];

const PAGE_SIZE = 20;

function classificationPillClass(c: Classification | null): string {
  switch (c) {
    case "comparison":
      return "bg-[var(--warning-light)] text-[var(--warning)]";
    case "launch":
      return "bg-[var(--accent-light)] text-[var(--accent)]";
    case "tutorial":
      return "bg-[var(--success-light)] text-[var(--success)]";
    case "listicle":
      return "bg-[var(--surface-sunken)] text-[var(--text-secondary)]";
    case "news":
      return "bg-[var(--error-light)] text-[var(--error)]";
    case "informational":
      return "bg-[var(--accent-light)] text-[var(--accent)]";
    case "other":
    default:
      return "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]";
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompetitorsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [niche, setNiche] = useState<string>("");
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [articles, setArticles] = useState<CompetitorArticle[]>([]);
  const [tab, setTab] = useState<StatusTab>("discovered");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scanningId, setScanningId] = useState<string | null>(null);

  // Add/edit form state.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    domain: string;
    feed_url: string;
    sitemap_url: string;
    label: string;
    active: boolean;
  }>({
    domain: "",
    feed_url: "",
    sitemap_url: "",
    label: "",
    active: true,
  });
  const [savingDraft, setSavingDraft] = useState(false);

  // Initial fetch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (cancelled) return;
      setUserId(u.user.id);

      const { data: settings } = await supabase
        .from("user_settings")
        .select("niche")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (!cancelled) {
        setNiche(((settings as { niche?: string } | null)?.niche ?? "").toString());
      }

      const { data: comps } = await supabase
        .from("competitors")
        .select("*")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: true });
      if (!cancelled && comps) setCompetitors(comps as Competitor[]);

      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Articles query (re-runs when tab/page/userId change).
  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    (async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error: qerr } = await supabase
        .from("competitor_articles")
        .select("*")
        .eq("user_id", userId)
        .eq("status", tab)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (cancelled) return;
      if (qerr) {
        setError(qerr.message);
        return;
      }
      setArticles((data ?? []) as CompetitorArticle[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId, tab, page]);

  // Realtime: competitor_articles for this user.
  useEffect(() => {
    if (!userId) return;
    const chan = supabase
      .channel(`competitor-articles-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "competitor_articles",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newRow = payload.new as CompetitorArticle | undefined;
          const oldRow = payload.old as CompetitorArticle | undefined;
          if (payload.eventType === "INSERT" && newRow) {
            if (newRow.status !== tab) return;
            setArticles((prev) => {
              if (prev.some((a) => a.id === newRow.id)) return prev;
              return [newRow, ...prev].slice(0, PAGE_SIZE);
            });
          } else if (payload.eventType === "UPDATE" && newRow) {
            setArticles((prev) => {
              if (newRow.status !== tab) {
                return prev.filter((a) => a.id !== newRow.id);
              }
              const exists = prev.some((a) => a.id === newRow.id);
              if (exists) return prev.map((a) => (a.id === newRow.id ? newRow : a));
              return [newRow, ...prev].slice(0, PAGE_SIZE);
            });
          } else if (payload.eventType === "DELETE" && oldRow) {
            setArticles((prev) => prev.filter((a) => a.id !== oldRow.id));
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(chan);
    };
  }, [supabase, userId, tab]);

  // Realtime: competitors for this user.
  useEffect(() => {
    if (!userId) return;
    const chan = supabase
      .channel(`competitors-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "competitors",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newRow = payload.new as Competitor | undefined;
          const oldRow = payload.old as Competitor | undefined;
          if (payload.eventType === "INSERT" && newRow) {
            setCompetitors((prev) =>
              prev.some((c) => c.id === newRow.id) ? prev : [...prev, newRow],
            );
          } else if (payload.eventType === "UPDATE" && newRow) {
            setCompetitors((prev) => prev.map((c) => (c.id === newRow.id ? newRow : c)));
          } else if (payload.eventType === "DELETE" && oldRow) {
            setCompetitors((prev) => prev.filter((c) => c.id !== oldRow.id));
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(chan);
    };
  }, [supabase, userId]);

  function resetDraft(): void {
    setDraft({ domain: "", feed_url: "", sitemap_url: "", label: "", active: true });
    setEditingId(null);
  }

  function startEdit(c: Competitor): void {
    setEditingId(c.id);
    setDraft({
      domain: c.domain,
      feed_url: c.feed_url ?? "",
      sitemap_url: c.sitemap_url ?? "",
      label: c.label ?? "",
      active: c.active,
    });
  }

  async function saveDraft(): Promise<void> {
    if (!userId) return;
    const domain = draft.domain.trim();
    if (!domain) {
      setError("Domain is required.");
      return;
    }
    setSavingDraft(true);
    setError(null);
    try {
      const payload = {
        user_id: userId,
        domain,
        feed_url: draft.feed_url.trim() || null,
        sitemap_url: draft.sitemap_url.trim() || null,
        label: draft.label.trim() || null,
        active: draft.active,
      };
      if (editingId) {
        const { error: upErr } = await supabase
          .from("competitors")
          .update(payload)
          .eq("id", editingId);
        if (upErr) throw new Error(upErr.message);
      } else {
        const { error: insErr } = await supabase.from("competitors").insert(payload);
        if (insErr) throw new Error(insErr.message);
      }
      resetDraft();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingDraft(false);
    }
  }

  async function deleteCompetitor(id: string): Promise<void> {
    if (!confirm("Delete this competitor and stop monitoring it?")) return;
    setBusyId(id);
    const { error: delErr } = await supabase.from("competitors").delete().eq("id", id);
    setBusyId(null);
    if (delErr) setError(delErr.message);
  }

  async function toggleActive(c: Competitor): Promise<void> {
    setBusyId(c.id);
    const { error: upErr } = await supabase
      .from("competitors")
      .update({ active: !c.active })
      .eq("id", c.id);
    setBusyId(null);
    if (upErr) setError(upErr.message);
  }

  async function runScan(c: Competitor): Promise<void> {
    if (!niche.trim()) {
      setError("Set a niche in your settings first to run a scan.");
      return;
    }
    setScanningId(c.id);
    setError(null);
    try {
      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "competitor_monitor",
          topic: niche,
          competitorIds: [c.id],
          quality: "standard",
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Failed to dispatch scan: ${t}`);
      }
      const { runId } = (await resp.json()) as { runId: string };
      router.push(`/app/agent-runs/${runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanningId(null);
    }
  }

  async function dismissArticle(a: CompetitorArticle): Promise<void> {
    setBusyId(a.id);
    const { error: upErr } = await supabase
      .from("competitor_articles")
      .update({ status: "dismissed" })
      .eq("id", a.id);
    setBusyId(null);
    if (upErr) setError(upErr.message);
  }

  async function generateRebuttal(a: CompetitorArticle): Promise<void> {
    if (!a.rebuttal_topic || !a.rebuttal_focus_keyword) {
      setError("This article has no proposed rebuttal — dismiss instead.");
      return;
    }
    setBusyId(a.id);
    setError(null);
    try {
      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "article",
          topic: a.rebuttal_topic,
          focusKeyword: a.rebuttal_focus_keyword,
          quality: "standard",
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Failed to dispatch: ${t}`);
      }
      const { runId } = (await resp.json()) as { runId: string };
      // Mark queued so it leaves the discovered tab. The webhook can later
      // populate written_article_id on completion via a follow-up join.
      await supabase
        .from("competitor_articles")
        .update({ status: "queued" })
        .eq("id", a.id);
      router.push(`/app/agent-runs/${runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Competitors</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Monitor competitor sites for new posts and queue rebuttal articles.
          </p>
        </div>
        {niche && (
          <span className="self-start rounded-full bg-[var(--accent-light)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
            Niche: {niche}
          </span>
        )}
      </header>

      {error && (
        <div className="rounded-lg border border-[var(--error)] bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      {/* ── Top section: Competitors ─────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Competitor sites</h2>
          <span className="text-xs text-[var(--text-tertiary)]">
            {competitors.length} configured
          </span>
        </div>

        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-4">
          <h3 className="mb-3 text-sm font-medium text-[var(--text-primary)]">
            {editingId ? "Edit competitor" : "Add competitor"}
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
              Domain (required)
              <input
                type="text"
                value={draft.domain}
                onChange={(e) => setDraft((d) => ({ ...d, domain: e.target.value }))}
                placeholder="example.com"
                className="rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
              Label (optional)
              <input
                type="text"
                value={draft.label}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                placeholder="e.g. Main rival"
                className="rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
              RSS / Atom feed URL
              <input
                type="url"
                value={draft.feed_url}
                onChange={(e) => setDraft((d) => ({ ...d, feed_url: e.target.value }))}
                placeholder="https://example.com/rss.xml"
                className="rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
              Sitemap URL
              <input
                type="url"
                value={draft.sitemap_url}
                onChange={(e) => setDraft((d) => ({ ...d, sitemap_url: e.target.value }))}
                placeholder="https://example.com/sitemap.xml"
                className="rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
              />
              Active (include in scans)
            </label>
            <div className="flex gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetDraft}
                  className="rounded border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                disabled={savingDraft || !draft.domain.trim()}
                onClick={() => void saveDraft()}
                className={cn(
                  "rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white",
                  "hover:opacity-90 disabled:opacity-40",
                )}
              >
                {savingDraft
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Add competitor"}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-12 text-center text-sm text-[var(--text-tertiary)]">
            Loading competitors...
          </div>
        ) : competitors.length === 0 ? (
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-12 text-center text-sm text-[var(--text-tertiary)]">
            No competitors yet — add the first one above to start monitoring.
          </div>
        ) : (
          <ul className="space-y-2">
            {competitors.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-3"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[var(--text-primary)]">{c.domain}</span>
                      {c.label && (
                        <span className="rounded-full bg-[var(--accent-light)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                          {c.label}
                        </span>
                      )}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                          c.active
                            ? "bg-[var(--success-light)] text-[var(--success)]"
                            : "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]",
                        )}
                      >
                        {c.active ? "Active" : "Paused"}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-[var(--text-tertiary)]">
                      {c.feed_url && <span>Feed: {c.feed_url}</span>}
                      {c.sitemap_url && <span>Sitemap: {c.sitemap_url}</span>}
                      {!c.feed_url && !c.sitemap_url && <span>No feed or sitemap set</span>}
                      <span>Last checked: {fmtDate(c.last_checked_at)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={scanningId === c.id || !c.active}
                      onClick={() => void runScan(c)}
                      className={cn(
                        "rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white",
                        "hover:opacity-90 disabled:opacity-40",
                      )}
                    >
                      {scanningId === c.id ? "Dispatching..." : "Run scan now"}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="rounded border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => void toggleActive(c)}
                      className="rounded border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                    >
                      {c.active ? "Pause" : "Activate"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => void deleteCompetitor(c.id)}
                      className="rounded border border-[var(--error)] px-3 py-1.5 text-xs text-[var(--error)] hover:bg-[var(--error-light)]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Bottom section: Discovered articles ──────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Discovered articles</h2>
          <span className="text-xs text-[var(--text-tertiary)]">Live updates enabled</span>
        </div>

        <div className="flex items-center gap-2">
          {STATUS_TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  setPage(0);
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]"
                    : "border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {articles.length === 0 ? (
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-12 text-center text-sm text-[var(--text-tertiary)]">
            {tab === "discovered"
              ? competitors.length === 0
                ? "No competitors yet — add one above to start monitoring."
                : "No new competitor articles yet. Run a scan or wait for the next cron tick."
              : `No articles in the ${tab} state.`}
          </div>
        ) : (
          <ul className="space-y-3">
            {articles.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-semibold text-[var(--accent)] hover:underline"
                      >
                        {a.title || a.url}
                      </a>
                      {a.classification && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                            classificationPillClass(a.classification),
                          )}
                        >
                          {a.classification}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                      Published: {fmtDate(a.published_at)} · Discovered: {fmtDate(a.created_at)}
                    </div>

                    {(a.rebuttal_topic ||
                      a.rebuttal_focus_keyword ||
                      a.rebuttal_angle) && (
                      <div className="mt-3 rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                          Proposed rebuttal
                        </div>
                        {a.rebuttal_topic && (
                          <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                            {a.rebuttal_topic}
                          </p>
                        )}
                        {a.rebuttal_focus_keyword && (
                          <p className="mt-1 font-mono text-[11px] text-[var(--text-secondary)]">
                            Focus keyword: {a.rebuttal_focus_keyword}
                          </p>
                        )}
                        {a.rebuttal_angle && (
                          <p className="mt-1 text-xs text-[var(--text-secondary)]">
                            {a.rebuttal_angle}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-stretch gap-2 md:w-auto md:items-end">
                    <button
                      type="button"
                      disabled={
                        busyId === a.id ||
                        a.status !== "discovered" ||
                        !a.rebuttal_topic ||
                        !a.rebuttal_focus_keyword
                      }
                      onClick={() => void generateRebuttal(a)}
                      className={cn(
                        "rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white",
                        "hover:opacity-90 disabled:opacity-40",
                      )}
                    >
                      {busyId === a.id ? "Working..." : "Generate"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === a.id || a.status === "dismissed"}
                      onClick={() => void dismissArticle(a)}
                      className="rounded border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] disabled:opacity-40"
                    >
                      Dismiss
                    </button>
                    {a.written_article_id && (
                      <Link
                        href={`/app/articles/${a.written_article_id}`}
                        className="rounded border border-[var(--border-default)] px-3 py-1.5 text-center text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                      >
                        Open article
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded border border-[var(--border-default)] px-3 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-[var(--text-tertiary)]">Page {page + 1}</span>
          <button
            type="button"
            disabled={articles.length < PAGE_SIZE}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-[var(--border-default)] px-3 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
