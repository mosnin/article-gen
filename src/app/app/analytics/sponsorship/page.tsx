"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

type FitStatus = "pending" | "pursuing" | "sponsored" | "dismissed" | "expired";

type SponsorFitRow = {
  id: string;
  user_id: string;
  run_id: string | null;
  article_id: string;
  fit_score: number;
  monthly_traffic_estimate: number | null;
  niche_tightness: number | null;
  evergreen_score: number | null;
  suggested_sponsor_archetypes: string[];
  rationale: string;
  status: FitStatus;
  decided_at: string | null;
  created_at: string;
};

type ArticleStub = {
  id: string;
  title: string | null;
  slug: string | null;
};

type StatusFilter = "pending" | "pursuing" | "sponsored" | "dismissed" | "all";

const STATUS_FILTERS: ReadonlyArray<{ key: StatusFilter; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "pursuing", label: "Pursuing" },
  { key: "sponsored", label: "Sponsored" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];

function statusPillClass(s: FitStatus): string {
  switch (s) {
    case "sponsored":
      return "bg-[var(--success-light)] text-[var(--success)]";
    case "pursuing":
      return "bg-[var(--accent-light)] text-[var(--accent)]";
    case "dismissed":
      return "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]";
    case "expired":
      return "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]";
    case "pending":
    default:
      return "bg-[var(--warning-light)] text-[var(--warning)]";
  }
}

function rowAccentClass(s: FitStatus): string {
  switch (s) {
    case "sponsored":
      return "border-l-4 border-l-[var(--success)]";
    case "pursuing":
      return "border-l-4 border-l-[var(--accent)]";
    default:
      return "";
  }
}

/**
 * Color the fit-score bar by threshold:
 *   < 0.5  red
 *   < 0.7  yellow
 *   >= 0.7 green
 */
function fitBarColor(score: number): string {
  if (score >= 0.7) return "bg-[var(--success)]";
  if (score >= 0.5) return "bg-[var(--warning)]";
  return "bg-[var(--error)]";
}

function fitTextColor(score: number): string {
  if (score >= 0.7) return "text-[var(--success)]";
  if (score >= 0.5) return "text-[var(--warning)]";
  return "text-[var(--error)]";
}

function formatScore(score: number | null): string {
  if (score === null) return "—";
  return score.toFixed(2);
}

function formatTraffic(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString();
}

export default function SponsorshipFitPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [fits, setFits] = useState<SponsorFitRow[]>([]);
  const [articles, setArticles] = useState<Record<string, ArticleStub>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [gscConnected, setGscConnected] = useState<boolean>(true);
  const [expandedRationale, setExpandedRationale] = useState<Record<string, boolean>>({});

  // Initial fetch.
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
        .select("gsc_refresh_token, gsc_site_url")
        .eq("user_id", user.user.id)
        .maybeSingle();
      const connected = Boolean(
        settings &&
          typeof (settings as { gsc_refresh_token?: unknown }).gsc_refresh_token ===
            "string" &&
          typeof (settings as { gsc_site_url?: unknown }).gsc_site_url === "string" &&
          ((settings as { gsc_refresh_token: string }).gsc_refresh_token ?? "").length >
            0 &&
          ((settings as { gsc_site_url: string }).gsc_site_url ?? "").length > 0,
      );
      if (!cancelled) setGscConnected(connected);

      const { data, error: fitsErr } = await supabase
        .from("sponsor_fits")
        .select("*")
        .eq("user_id", user.user.id)
        .order("fit_score", { ascending: false })
        .limit(500);
      if (!cancelled) {
        if (fitsErr) {
          setError(fitsErr.message);
        } else if (data) {
          const rows = data as SponsorFitRow[];
          setFits(rows);
          const ids = Array.from(new Set(rows.map((r) => r.article_id)));
          if (ids.length > 0) {
            const { data: arts } = await supabase
              .from("articles")
              .select("id, title, slug")
              .in("id", ids);
            if (!cancelled && arts) {
              const map: Record<string, ArticleStub> = {};
              for (const a of arts as ArticleStub[]) map[a.id] = a;
              setArticles(map);
            }
          }
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Realtime subscription.
  useEffect(() => {
    if (!userId) return;
    const chan = supabase
      .channel(`sponsor-fits-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sponsor_fits",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const next = payload.new as SponsorFitRow;
            setFits((prev) => {
              if (prev.some((p) => p.id === next.id)) return prev;
              return [next, ...prev];
            });
            if (!articles[next.article_id]) {
              void (async () => {
                const { data: arts } = await supabase
                  .from("articles")
                  .select("id, title, slug")
                  .in("id", [next.article_id]);
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
            const next = payload.new as SponsorFitRow;
            setFits((prev) => prev.map((p) => (p.id === next.id ? next : p)));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as SponsorFitRow;
            setFits((prev) => prev.filter((p) => p.id !== old.id));
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(chan);
    };
  }, [supabase, userId, articles]);

  const visible = useMemo(() => {
    const filtered = fits.filter((f) => {
      if (filter !== "all" && f.status !== filter) return false;
      return true;
    });
    return [...filtered].sort((a, b) => b.fit_score - a.fit_score);
  }, [fits, filter]);

  const counts: Record<StatusFilter, number> = {
    pending: fits.filter((f) => f.status === "pending").length,
    pursuing: fits.filter((f) => f.status === "pursuing").length,
    sponsored: fits.filter((f) => f.status === "sponsored").length,
    dismissed: fits.filter((f) => f.status === "dismissed").length,
    all: fits.length,
  };

  const dispatchAnalysis = useCallback(async () => {
    setDispatching(true);
    setError(null);
    setToast(null);
    try {
      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "sponsorship_fit",
          topic: "sponsorship analysis",
        }),
      });
      if (!resp.ok) {
        const payload = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `Failed to dispatch (${resp.status})`);
      }
      const out = (await resp.json()) as { runId?: string };
      setToast(
        out.runId
          ? `Analysis queued (run ${out.runId.slice(0, 8)}...)`
          : "Analysis queued",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDispatching(false);
    }
  }, []);

  const updateStatus = useCallback(
    async (f: SponsorFitRow, next: FitStatus, successMsg: string) => {
      setBusyId(f.id);
      setError(null);
      const decidedAt = new Date().toISOString();
      const snapshot = fits;
      setFits((prev) =>
        prev.map((p) =>
          p.id === f.id ? { ...p, status: next, decided_at: decidedAt } : p,
        ),
      );
      const { error: updateErr } = await supabase
        .from("sponsor_fits")
        .update({ status: next, decided_at: decidedAt })
        .eq("id", f.id);
      if (updateErr) {
        setFits(snapshot);
        setError(updateErr.message);
      } else {
        setToast(successMsg);
      }
      setBusyId(null);
    },
    [fits, supabase],
  );

  const markPursuing = useCallback(
    (f: SponsorFitRow) => updateStatus(f, "pursuing", "Marked as pursuing."),
    [updateStatus],
  );
  const markSponsored = useCallback(
    (f: SponsorFitRow) => updateStatus(f, "sponsored", "Marked as sponsored."),
    [updateStatus],
  );
  const dismiss = useCallback(
    (f: SponsorFitRow) => updateStatus(f, "dismissed", "Dismissed."),
    [updateStatus],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Sponsorship fit
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Articles in your corpus most likely to attract sponsor placements,
            scored on traffic, niche tightness, and evergreen-ness — with
            suggested sponsor archetypes to reach out to.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void dispatchAnalysis()}
            disabled={dispatching}
            className={cn(
              "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white",
              "hover:opacity-90 disabled:opacity-50",
            )}
          >
            {dispatching ? "Dispatching..." : "Run analysis"}
          </button>
          <Link
            href="/app/analytics"
            className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]"
          >
            Back to analytics
          </Link>
        </div>
      </header>

      {!gscConnected && (
        <div className="rounded-lg border border-[var(--warning)] bg-[var(--warning-light)] p-4">
          <p className="text-sm font-semibold text-[var(--warning)]">
            Google Search Console isn&apos;t connected
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Sponsorship fit scores are far more accurate when we can read
            real traffic numbers from Search Console. Without it, fit scores
            will skew low because the traffic component is unknown.
          </p>
          <Link
            href="/app/integrations"
            className={cn(
              "mt-3 inline-flex items-center rounded-lg bg-[var(--accent)] px-3 py-1.5",
              "text-xs font-medium text-white hover:opacity-90",
            )}
          >
            Connect Google Search Console
          </Link>
        </div>
      )}

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

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => {
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
              ? "No sponsor-fit candidates yet — run the analysis to score your published articles."
              : "No fits match the current filter."}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((f) => {
              const article = articles[f.article_id];
              const articleTitle = article?.title ?? "Unknown article";
              const isPending = f.status === "pending";
              const expanded = !!expandedRationale[f.id];
              const fitPct = Math.max(0, Math.min(1, f.fit_score)) * 100;
              return (
                <li
                  key={f.id}
                  className={cn(
                    "rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-4",
                    rowAccentClass(f.status),
                  )}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Link
                          href={`/app/articles/${f.article_id}`}
                          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
                          title={articleTitle}
                        >
                          {articleTitle}
                        </Link>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                            statusPillClass(f.status),
                          )}
                        >
                          {f.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="h-2 w-40 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                          <div
                            className={cn("h-full rounded-full", fitBarColor(f.fit_score))}
                            style={{ width: `${fitPct}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            "font-mono text-sm font-semibold",
                            fitTextColor(f.fit_score),
                          )}
                        >
                          {f.fit_score.toFixed(2)}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                          fit
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-2 py-0.5 text-[var(--text-secondary)]">
                          Traffic ~ {formatTraffic(f.monthly_traffic_estimate)}/mo
                        </span>
                        <span className="rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-2 py-0.5 text-[var(--text-secondary)]">
                          Niche {formatScore(f.niche_tightness)}
                        </span>
                        <span className="rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-2 py-0.5 text-[var(--text-secondary)]">
                          Evergreen {formatScore(f.evergreen_score)}
                        </span>
                      </div>

                      {f.suggested_sponsor_archetypes.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                            Sponsor archetypes:
                          </span>
                          {f.suggested_sponsor_archetypes.map((a, idx) => (
                            <span
                              key={`${f.id}-${idx}`}
                              className="rounded-full border border-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      )}

                      {f.rationale && (
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRationale((prev) => ({
                                ...prev,
                                [f.id]: !prev[f.id],
                              }))
                            }
                            className="text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)]"
                          >
                            {expanded ? "Hide rationale" : "Show rationale"}
                          </button>
                          {expanded && (
                            <p className="mt-1.5 rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-xs text-[var(--text-secondary)] italic">
                              &ldquo;{f.rationale}&rdquo;
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch gap-2 md:w-auto md:items-end">
                      <button
                        type="button"
                        disabled={busyId === f.id || !isPending}
                        onClick={() => void markPursuing(f)}
                        className={cn(
                          "rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white",
                          "hover:opacity-90 disabled:opacity-40",
                        )}
                      >
                        {busyId === f.id ? "Working..." : "Mark pursuing"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === f.id || f.status === "sponsored"}
                        onClick={() => void markSponsored(f)}
                        className={cn(
                          "rounded bg-[var(--success)] px-3 py-1.5 text-xs font-medium text-white",
                          "hover:opacity-90 disabled:opacity-40",
                        )}
                      >
                        Mark sponsored
                      </button>
                      <button
                        type="button"
                        disabled={busyId === f.id || f.status === "dismissed"}
                        onClick={() => void dismiss(f)}
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
