"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

type ResolutionStatus = "pending" | "applied" | "dismissed" | "partially_applied";

type RecommendedAction =
  | "merge"
  | "canonical"
  | "archive_secondary"
  | "retarget_secondary"
  | "no_action";

type CannibalizationResolution = {
  id: string;
  user_id: string;
  run_id: string | null;
  primary_article_id: string;
  secondary_article_id: string;
  similarity_score: number;
  shared_keywords: string[] | null;
  recommended_action: RecommendedAction;
  rationale: string;
  status: ResolutionStatus;
  applied_at: string | null;
  decided_at: string | null;
  created_at: string;
};

type ArticleStub = {
  id: string;
  title: string | null;
  slug: string | null;
  lifecycle: string | null;
};

type FilterKey = "pending" | "applied" | "dismissed" | "all";

const FILTERS: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "applied", label: "Applied" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];

const ACTION_LABELS: Record<RecommendedAction, string> = {
  merge: "Merge",
  canonical: "Canonical",
  archive_secondary: "Archive secondary",
  retarget_secondary: "Retarget secondary",
  no_action: "No action",
};

function actionPillClass(a: RecommendedAction): string {
  switch (a) {
    case "merge":
      return "bg-[var(--accent-light)] text-[var(--accent)]";
    case "canonical":
      return "bg-[var(--success-light)] text-[var(--success)]";
    case "archive_secondary":
      return "bg-[var(--warning-light)] text-[var(--warning)]";
    case "retarget_secondary":
      return "bg-[var(--surface-sunken)] text-[var(--text-secondary)]";
    case "no_action":
    default:
      return "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]";
  }
}

function statusPillClass(status: ResolutionStatus): string {
  switch (status) {
    case "applied":
      return "bg-[var(--success-light)] text-[var(--success)]";
    case "dismissed":
      return "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]";
    case "partially_applied":
      return "bg-[var(--accent-light)] text-[var(--accent)]";
    case "pending":
    default:
      return "bg-[var(--warning-light)] text-[var(--warning)]";
  }
}

function similarityBarColor(s: number): string {
  if (s >= 0.95) return "bg-[var(--error)]";
  if (s >= 0.9) return "bg-[var(--warning)]";
  return "bg-[var(--accent)]";
}

function buildCanonicalHint(primary: ArticleStub | undefined): string {
  const slug = primary?.slug?.replace(/^\/+/, "") ?? "";
  const title = primary?.title ?? "the canonical article";
  const url = slug ? `/blog/${slug}` : "(canonical article URL)";
  return [
    "",
    "",
    "---",
    "",
    `> Note: this article has been superseded. See the canonical version: [${title}](${url}).`,
    "",
  ].join("\n");
}

export default function CannibalizationPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<CannibalizationResolution[]>([]);
  const [articles, setArticles] = useState<Record<string, ArticleStub>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [niche, setNiche] = useState<string>("");
  const [siteDomain, setSiteDomain] = useState<string>("");

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (!cancelled) setUserId(user.user.id);

      const { data: settings } = await supabase
        .from("user_settings")
        .select("niche, domain")
        .eq("user_id", user.user.id)
        .maybeSingle();
      const settingsRow = settings as { niche?: string; domain?: string } | null;
      if (!cancelled) {
        setNiche((settingsRow?.niche ?? "").toString());
        const rawDomain = (settingsRow?.domain ?? "").toString().trim().replace(/\/$/, "");
        setSiteDomain(rawDomain && !/^https?:\/\//i.test(rawDomain) ? `https://${rawDomain}` : rawDomain);
      }

      const { data } = await supabase
        .from("cannibalization_resolutions")
        .select("*")
        .eq("user_id", user.user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (!cancelled && data) {
        const rows = data as CannibalizationResolution[];
        setResolutions(rows);

        const ids = new Set<string>();
        for (const r of rows) {
          ids.add(r.primary_article_id);
          ids.add(r.secondary_article_id);
        }
        if (ids.size > 0) {
          const { data: arts } = await supabase
            .from("articles")
            .select("id, title, slug, lifecycle")
            .in("id", Array.from(ids));
          if (!cancelled && arts) {
            const map: Record<string, ArticleStub> = {};
            for (const a of arts as ArticleStub[]) map[a.id] = a;
            setArticles(map);
          }
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Realtime
  useEffect(() => {
    if (!userId) return;
    const chan = supabase
      .channel(`cannibalization-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cannibalization_resolutions",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const next = payload.new as CannibalizationResolution;
            setResolutions((prev) => {
              if (prev.some((p) => p.id === next.id)) return prev;
              return [next, ...prev];
            });
            const missing = [next.primary_article_id, next.secondary_article_id].filter(
              (id) => !articles[id],
            );
            if (missing.length > 0) {
              void (async () => {
                const { data: arts } = await supabase
                  .from("articles")
                  .select("id, title, slug, lifecycle")
                  .in("id", missing);
                if (arts) {
                  setArticles((prev) => {
                    const copy = { ...prev };
                    for (const a of arts as ArticleStub[]) copy[a.id] = a;
                    return copy;
                  });
                }
              })();
            }
          } else if (payload.eventType === "UPDATE") {
            const next = payload.new as CannibalizationResolution;
            setResolutions((prev) => prev.map((p) => (p.id === next.id ? next : p)));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as CannibalizationResolution;
            setResolutions((prev) => prev.filter((p) => p.id !== old.id));
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(chan);
    };
  }, [supabase, userId, articles]);

  const visible = resolutions.filter((s) => (filter === "all" ? true : s.status === filter));
  const counts: Record<FilterKey, number> = {
    pending: resolutions.filter((s) => s.status === "pending").length,
    applied: resolutions.filter((s) => ["applied", "partially_applied"].includes(s.status)).length,
    dismissed: resolutions.filter((s) => s.status === "dismissed").length,
    all: resolutions.length,
  };

  async function dispatchScan() {
    setDispatching(true);
    setError(null);
    try {
      const topic = niche.trim() === "" ? "all" : niche.trim();
      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "cannibalization_resolve",
          topic,
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        setError(`Failed to dispatch: ${errText}`);
        return;
      }
      const { runId } = (await resp.json()) as { runId: string };
      router.push(`/app/agent-runs/${runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDispatching(false);
    }
  }

  async function markStatus(
    s: CannibalizationResolution,
    nextStatus: ResolutionStatus,
    appliedAt: string | null = null,
  ): Promise<boolean> {
    const decidedAt = new Date().toISOString();
    const snapshot = resolutions;
    setResolutions((prev) =>
      prev.map((p) =>
        p.id === s.id
          ? {
              ...p,
              status: nextStatus,
              decided_at: decidedAt,
              applied_at: appliedAt ?? p.applied_at,
            }
          : p,
      ),
    );
    const update: Record<string, unknown> = {
      status: nextStatus,
      decided_at: decidedAt,
    };
    if (appliedAt !== null) update.applied_at = appliedAt;
    const { error: updateError } = await supabase
      .from("cannibalization_resolutions")
      .update(update)
      .eq("id", s.id);
    if (updateError) {
      setResolutions(snapshot);
      setError(updateError.message);
      return false;
    }
    return true;
  }

  async function dismiss(s: CannibalizationResolution) {
    setBusyId(s.id);
    setError(null);
    setToast(null);
    await markStatus(s, "dismissed");
    setBusyId(null);
  }

  async function applyMerge(s: CannibalizationResolution) {
    // Cross-article merge is non-trivial; surface guidance and link to the
    // primary's publish view so the user can stitch sections manually.
    setBusyId(s.id);
    setError(null);
    setToast(null);
    const ok = await markStatus(s, "applied", new Date().toISOString());
    setBusyId(null);
    if (ok) {
      setToast("Marked applied. Manual merge required — opening the primary article.");
      router.push(`/app/publish/${s.primary_article_id}?merge=${s.secondary_article_id}`);
    }
  }

  async function applyCanonical(s: CannibalizationResolution) {
    setBusyId(s.id);
    setError(null);
    setToast(null);
    const primary = articles[s.primary_article_id];

    // Fetch secondary's current markdown via RLS-scoped client.
    const { data: src, error: fetchErr } = await supabase
      .from("articles")
      .select("id, article_markdown")
      .eq("id", s.secondary_article_id)
      .maybeSingle();
    if (fetchErr || !src) {
      setError(fetchErr?.message ?? "Could not load secondary article.");
      setBusyId(null);
      return;
    }
    const row = src as { id: string; article_markdown: string | null };
    const nextMarkdown = (row.article_markdown ?? "") + buildCanonicalHint(primary);

    const { error: updateArticleErr } = await supabase
      .from("articles")
      .update({ article_markdown: nextMarkdown, lifecycle: "archived" })
      .eq("id", s.secondary_article_id);
    if (updateArticleErr) {
      setError(updateArticleErr.message);
      setBusyId(null);
      return;
    }

    const ok = await markStatus(s, "applied", new Date().toISOString());
    setBusyId(null);
    if (ok) setToast("Secondary archived with canonical hint appended.");
  }

  async function applyArchive(s: CannibalizationResolution) {
    setBusyId(s.id);
    setError(null);
    setToast(null);
    const { error: updateArticleErr } = await supabase
      .from("articles")
      .update({ lifecycle: "archived" })
      .eq("id", s.secondary_article_id);
    if (updateArticleErr) {
      setError(updateArticleErr.message);
      setBusyId(null);
      return;
    }
    const ok = await markStatus(s, "applied", new Date().toISOString());
    setBusyId(null);
    if (ok) setToast("Secondary article archived.");
  }

  async function applyRetarget(s: CannibalizationResolution) {
    setBusyId(s.id);
    setError(null);
    setToast(null);
    const ok = await markStatus(s, "applied", new Date().toISOString());
    setBusyId(null);
    if (ok) {
      setToast("Marked applied. Edit the secondary article to pivot its keyword.");
      router.push(`/app/articles/${s.secondary_article_id}`);
    }
  }

  function renderActionButton(s: CannibalizationResolution) {
    const disabled = busyId === s.id || s.status !== "pending";
    const baseCls = cn(
      "rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white",
      "hover:opacity-90 disabled:opacity-40",
    );
    const label = busyId === s.id ? "Working..." : `Apply ${ACTION_LABELS[s.recommended_action]}`;
    let onClick: () => void;
    switch (s.recommended_action) {
      case "merge":
        onClick = () => void applyMerge(s);
        break;
      case "canonical":
        onClick = () => void applyCanonical(s);
        break;
      case "archive_secondary":
        onClick = () => void applyArchive(s);
        break;
      case "retarget_secondary":
        onClick = () => void applyRetarget(s);
        break;
      case "no_action":
      default:
        // Treat "no_action" apply as a quick acknowledgement — flips to applied
        // without touching either article.
        onClick = () => void markStatus(s, "applied", new Date().toISOString()).then(() => {
          setBusyId(null);
        });
        break;
    }
    return (
      <button type="button" disabled={disabled} onClick={onClick} className={baseCls}>
        {label}
      </button>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Cannibalization resolutions
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Article pairs in your corpus that compete for the same query, with a
            recommended resolution per pair. Apply to act on the recommendation,
            or dismiss to skip.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void dispatchScan()}
            disabled={dispatching}
            className={cn(
              "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white",
              "hover:opacity-90 disabled:opacity-50",
            )}
          >
            {dispatching ? "Dispatching..." : "Run scan"}
          </button>
          <Link
            href="/app/research"
            className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]"
          >
            Back to research
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-[var(--error)] bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      {toast && (
        <div className="rounded-lg border border-[var(--accent)] bg-[var(--accent-light)] px-4 py-3 text-sm text-[var(--accent)]">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                active
                  ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]"
                  : "border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]",
              )}
            >
              {f.label}
              <span className="ml-1.5 text-[10px] text-[var(--text-tertiary)]">
                {counts[f.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div>
        {loading ? (
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-12 text-center text-sm text-[var(--text-tertiary)]">
            Loading...
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-12 text-center text-sm text-[var(--text-tertiary)]">
            {filter === "pending"
              ? "No cannibalization pairs yet — run a scan to surface competing articles."
              : "No resolutions match this filter."}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((s) => {
              const primary = articles[s.primary_article_id];
              const secondary = articles[s.secondary_article_id];
              const primaryTitle = primary?.title ?? "Unknown primary";
              const secondaryTitle = secondary?.title ?? "Unknown secondary";
              const primarySlug = primary?.slug?.replace(/^\/+/, "") ?? "";
              const secondarySlug = secondary?.slug?.replace(/^\/+/, "") ?? "";
              const simPct = Math.round(s.similarity_score * 100);
              const shared = s.shared_keywords ?? [];
              return (
                <li
                  key={s.id}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-full bg-[var(--success-light)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--success)]">
                          Primary
                        </span>
                        <Link
                          href={`/app/articles/${s.primary_article_id}`}
                          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
                          title={primaryTitle}
                        >
                          {primaryTitle}
                        </Link>
                        {primarySlug && (siteDomain ? (
                          <a
                            href={`${siteDomain}/blog/${primarySlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)] hover:bg-[var(--surface-sunken)]"
                          >
                            /blog/{primarySlug}
                          </a>
                        ) : (
                          <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                            /blog/{primarySlug}
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-full bg-[var(--warning-light)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--warning)]">
                          Secondary
                        </span>
                        <Link
                          href={`/app/articles/${s.secondary_article_id}`}
                          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
                          title={secondaryTitle}
                        >
                          {secondaryTitle}
                        </Link>
                        {secondarySlug && (siteDomain ? (
                          <a
                            href={`${siteDomain}/blog/${secondarySlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)] hover:bg-[var(--surface-sunken)]"
                          >
                            /blog/{secondarySlug}
                          </a>
                        ) : (
                          <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                            /blog/{secondarySlug}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex h-2 w-40 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                          <div
                            className={cn("h-full transition-all", similarityBarColor(s.similarity_score))}
                            style={{ width: `${Math.max(2, Math.min(100, simPct))}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                          {simPct}% similarity
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                            actionPillClass(s.recommended_action),
                          )}
                        >
                          {ACTION_LABELS[s.recommended_action]}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                            statusPillClass(s.status),
                          )}
                        >
                          {s.status}
                        </span>
                      </div>

                      {shared.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                            Shared:
                          </span>
                          {shared.map((k) => (
                            <span
                              key={k}
                              className="rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]"
                            >
                              {k}
                            </span>
                          ))}
                        </div>
                      )}

                      {s.rationale && (
                        <p className="rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-xs text-[var(--text-secondary)] italic">
                          {s.rationale}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch gap-2 md:w-auto md:items-end">
                      {renderActionButton(s)}
                      <button
                        type="button"
                        disabled={busyId === s.id || s.status !== "pending"}
                        onClick={() => void dismiss(s)}
                        className={cn(
                          "rounded border border-[var(--error)] px-3 py-1.5 text-xs font-medium text-[var(--error)]",
                          "hover:bg-[var(--error-light)] disabled:opacity-40",
                        )}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
