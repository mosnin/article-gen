"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

type AlertStatus = "pending" | "queued" | "applied" | "dismissed";
type Severity = "low" | "medium" | "high" | "critical";
type MetricName = "clicks" | "impressions" | "position" | "ctr";
type RecommendedKind =
  | "refresh"
  | "rewrite"
  | "archive"
  | "add_internal_links"
  | "add_schema"
  | "no_action";

type PerformanceAlertRow = {
  id: string;
  user_id: string;
  run_id: string | null;
  article_id: string;
  metric_name: MetricName;
  period_days: number;
  baseline_value: number;
  current_value: number;
  change_pct: number;
  severity: Severity;
  diagnosed_cause: string | null;
  recommended_kind: RecommendedKind | null;
  rationale: string;
  status: AlertStatus;
  triggered_run_id: string | null;
  decided_at: string | null;
  created_at: string;
};

type ArticleStub = {
  id: string;
  title: string | null;
  slug: string | null;
};

type StatusFilter = AlertStatus | "all";
type SeverityFilter = Severity | "all";

const STATUS_FILTERS: ReadonlyArray<{ key: StatusFilter; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "queued", label: "Queued" },
  { key: "applied", label: "Applied" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];

const SEVERITY_FILTERS: ReadonlyArray<{ key: SeverityFilter; label: string }> = [
  { key: "all", label: "Any severity" },
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

const APPLY_DISPATCH_KINDS: ReadonlySet<RecommendedKind> = new Set([
  "refresh",
  "rewrite",
  "add_schema",
  "add_internal_links",
]);

function severityClass(s: Severity): string {
  switch (s) {
    case "critical":
      return "bg-[var(--error-light)] text-[var(--error)]";
    case "high":
      return "bg-[var(--warning-light)] text-[var(--warning)]";
    case "medium":
      return "bg-[var(--accent-light)] text-[var(--accent)]";
    case "low":
    default:
      return "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]";
  }
}

function statusPillClass(s: AlertStatus): string {
  switch (s) {
    case "applied":
      return "bg-[var(--success-light)] text-[var(--success)]";
    case "queued":
      return "bg-[var(--accent-light)] text-[var(--accent)]";
    case "dismissed":
      return "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]";
    case "pending":
    default:
      return "bg-[var(--warning-light)] text-[var(--warning)]";
  }
}

function recommendedPillClass(kind: RecommendedKind | null): string {
  if (!kind) return "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]";
  if (kind === "no_action") return "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]";
  if (kind === "archive") return "bg-[var(--error-light)] text-[var(--error)]";
  return "bg-[var(--accent-light)] text-[var(--accent)]";
}

function metricLabel(metric: MetricName): string {
  switch (metric) {
    case "clicks":
      return "Clicks";
    case "impressions":
      return "Impressions";
    case "position":
      return "Avg position";
    case "ctr":
      return "CTR";
  }
}

function metricFormatter(metric: MetricName, value: number): string {
  if (metric === "position") return value.toFixed(1);
  if (metric === "ctr") return `${value.toFixed(1)}%`;
  return Math.round(value).toLocaleString();
}

/**
 * For position, lower is better — a positive `change_pct` actually means
 * the article RANKS WORSE. Normalize the arrow & tone so the UI reads
 * intuitively: down = bad, up = good.
 */
function changeIsBad(metric: MetricName, changePct: number): boolean {
  if (metric === "position") return changePct > 0;
  return changePct < 0;
}

function changeArrow(metric: MetricName, changePct: number): string {
  if (changePct === 0) return "→";
  if (metric === "position") {
    return changePct > 0 ? "↓" : "↑";
  }
  return changePct > 0 ? "↑" : "↓";
}

function formatChangePct(changePct: number): string {
  const sign = changePct > 0 ? "+" : "";
  return `${sign}${changePct.toFixed(1)}%`;
}

function diagnosedCauseLabel(cause: string | null): string {
  if (!cause) return "Unknown cause";
  switch (cause) {
    case "stale_data":
      return "Stale data";
    case "algorithm_shift":
      return "Algorithm shift";
    case "weak_meta":
      return "Weak title or meta";
    case "lost_backlinks_or_competitor_pressure":
      return "Lost backlinks or competitor pressure";
    default:
      return cause.replace(/_/g, " ");
  }
}

function recommendedKindLabel(kind: RecommendedKind | null): string {
  if (!kind) return "No recommendation";
  switch (kind) {
    case "refresh":
      return "Refresh";
    case "rewrite":
      return "Rewrite";
    case "archive":
      return "Archive";
    case "add_internal_links":
      return "Add internal links";
    case "add_schema":
      return "Add schema";
    case "no_action":
      return "No action";
  }
}

export default function PerformanceCoachPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlertRow[]>([]);
  const [articles, setArticles] = useState<Record<string, ArticleStub>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [gscConnected, setGscConnected] = useState<boolean>(true);

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

      const { data, error: alertsErr } = await supabase
        .from("performance_alerts")
        .select("*")
        .eq("user_id", user.user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (!cancelled) {
        if (alertsErr) {
          setError(alertsErr.message);
        } else if (data) {
          const rows = data as PerformanceAlertRow[];
          setAlerts(rows);
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
      .channel(`performance-alerts-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "performance_alerts",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const next = payload.new as PerformanceAlertRow;
            setAlerts((prev) => {
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
            const next = payload.new as PerformanceAlertRow;
            setAlerts((prev) => prev.map((p) => (p.id === next.id ? next : p)));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as PerformanceAlertRow;
            setAlerts((prev) => prev.filter((p) => p.id !== old.id));
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(chan);
    };
  }, [supabase, userId, articles]);

  const visible = alerts.filter((a) => {
    if (filter !== "all" && a.status !== filter) return false;
    if (severityFilter !== "all" && a.severity !== severityFilter) return false;
    return true;
  });

  const counts: Record<StatusFilter, number> = {
    pending: alerts.filter((a) => a.status === "pending").length,
    queued: alerts.filter((a) => a.status === "queued").length,
    applied: alerts.filter((a) => a.status === "applied").length,
    dismissed: alerts.filter((a) => a.status === "dismissed").length,
    all: alerts.length,
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
          kind: "performance_coach",
          topic: "performance coach scan",
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

  const dismiss = useCallback(
    async (a: PerformanceAlertRow) => {
      setBusyId(a.id);
      setError(null);
      const decidedAt = new Date().toISOString();
      const snapshot = alerts;
      setAlerts((prev) =>
        prev.map((p) =>
          p.id === a.id ? { ...p, status: "dismissed", decided_at: decidedAt } : p,
        ),
      );
      const { error: updateErr } = await supabase
        .from("performance_alerts")
        .update({ status: "dismissed", decided_at: decidedAt })
        .eq("id", a.id);
      if (updateErr) {
        setAlerts(snapshot);
        setError(updateErr.message);
      }
      setBusyId(null);
    },
    [alerts, supabase],
  );

  const applyArchive = useCallback(
    async (a: PerformanceAlertRow) => {
      const ok = window.confirm(
        "Archive this article? It will be hidden from the active list but can be restored later.",
      );
      if (!ok) return;
      setBusyId(a.id);
      setError(null);
      const decidedAt = new Date().toISOString();
      const { error: archiveErr } = await supabase
        .from("articles")
        .update({ lifecycle: "archived" })
        .eq("id", a.article_id);
      if (archiveErr) {
        setError(archiveErr.message);
        setBusyId(null);
        return;
      }
      const snapshot = alerts;
      setAlerts((prev) =>
        prev.map((p) =>
          p.id === a.id ? { ...p, status: "applied", decided_at: decidedAt } : p,
        ),
      );
      const { error: updateErr } = await supabase
        .from("performance_alerts")
        .update({ status: "applied", decided_at: decidedAt })
        .eq("id", a.id);
      if (updateErr) {
        setAlerts(snapshot);
        setError(updateErr.message);
      } else {
        setToast("Article archived.");
      }
      setBusyId(null);
    },
    [alerts, supabase],
  );

  const applyDispatch = useCallback(
    async (a: PerformanceAlertRow) => {
      if (!a.recommended_kind || !APPLY_DISPATCH_KINDS.has(a.recommended_kind)) {
        return;
      }
      setBusyId(a.id);
      setError(null);
      setToast(null);
      try {
        const article = articles[a.article_id];
        const topic =
          (article?.title ?? "").trim() === ""
            ? "performance remediation"
            : (article?.title ?? "").trim();
        const resp = await fetch("/api/agent/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: a.recommended_kind,
            topic,
            articleId: a.article_id,
            options: { source: "performance_coach", alertId: a.id },
          }),
        });
        if (!resp.ok) {
          const payload = (await resp.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? `Dispatch failed (${resp.status})`);
        }
        const out = (await resp.json()) as { runId?: string };
        const decidedAt = new Date().toISOString();
        const triggeredRunId = out.runId ?? null;
        const snapshot = alerts;
        setAlerts((prev) =>
          prev.map((p) =>
            p.id === a.id
              ? {
                  ...p,
                  status: "queued",
                  decided_at: decidedAt,
                  triggered_run_id: triggeredRunId,
                }
              : p,
          ),
        );
        const { error: updateErr } = await supabase
          .from("performance_alerts")
          .update({
            status: "queued",
            decided_at: decidedAt,
            triggered_run_id: triggeredRunId,
          })
          .eq("id", a.id);
        if (updateErr) {
          setAlerts(snapshot);
          setError(updateErr.message);
        } else {
          setToast(
            triggeredRunId
              ? `Dispatched (run ${triggeredRunId.slice(0, 8)}...)`
              : "Dispatched",
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    },
    [alerts, articles, supabase],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Performance coach
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Articles trending down on Google Search Console with a diagnosed cause and a
            recommended remediation. Apply the action to dispatch the right agent, or
            dismiss to skip.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void dispatchAnalysis()}
            disabled={dispatching || !gscConnected}
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
            Performance coach needs Search Console data to detect declining articles.
            Connect your account to start surfacing alerts.
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

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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

        <div className="flex flex-wrap items-center gap-2">
          {SEVERITY_FILTERS.map((s) => {
            const active = s.key === severityFilter;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSeverityFilter(s.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]"
                    : "border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {loading ? (
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-12 text-center text-sm text-[var(--text-tertiary)]">
            Loading...
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-12 text-center text-sm text-[var(--text-tertiary)]">
            {filter === "pending"
              ? "No declining articles surfaced — run the analysis to scan your published content."
              : "No alerts match the current filters."}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((a) => {
              const article = articles[a.article_id];
              const articleTitle = article?.title ?? "Unknown article";
              const canApply = a.status === "pending";
              const canDispatch =
                canApply &&
                a.recommended_kind !== null &&
                APPLY_DISPATCH_KINDS.has(a.recommended_kind);
              const canArchive = canApply && a.recommended_kind === "archive";
              const isBad = changeIsBad(a.metric_name, a.change_pct);
              return (
                <li
                  key={a.id}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Link
                          href={`/app/articles/${a.article_id}`}
                          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
                          title={articleTitle}
                        >
                          {articleTitle}
                        </Link>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            severityClass(a.severity),
                          )}
                        >
                          {a.severity}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                            statusPillClass(a.status),
                          )}
                        >
                          {a.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-2 py-0.5 font-medium text-[var(--text-secondary)]">
                          {metricLabel(a.metric_name)}
                        </span>
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 font-mono",
                            isBad
                              ? "bg-[var(--error-light)] text-[var(--error)]"
                              : "bg-[var(--success-light)] text-[var(--success)]",
                          )}
                        >
                          {changeArrow(a.metric_name, a.change_pct)}{" "}
                          {formatChangePct(a.change_pct)}
                        </span>
                        <span className="font-mono text-[var(--text-tertiary)]">
                          {metricFormatter(a.metric_name, a.baseline_value)}
                          <span className="mx-1">&rarr;</span>
                          <span className="text-[var(--text-secondary)]">
                            {metricFormatter(a.metric_name, a.current_value)}
                          </span>
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                          ({a.period_days}d window)
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                          Cause: {diagnosedCauseLabel(a.diagnosed_cause)}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            recommendedPillClass(a.recommended_kind),
                          )}
                        >
                          {recommendedKindLabel(a.recommended_kind)}
                        </span>
                        {a.triggered_run_id && (
                          <Link
                            href={`/app/agent-runs/${a.triggered_run_id}`}
                            className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)] hover:bg-[var(--surface-sunken)]"
                          >
                            run {a.triggered_run_id.slice(0, 8)}...
                          </Link>
                        )}
                      </div>

                      {a.rationale && (
                        <p className="rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-xs text-[var(--text-secondary)] italic">
                          &ldquo;{a.rationale}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch gap-2 md:w-auto md:items-end">
                      {canDispatch && (
                        <button
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => void applyDispatch(a)}
                          className={cn(
                            "rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white",
                            "hover:opacity-90 disabled:opacity-40",
                          )}
                        >
                          {busyId === a.id
                            ? "Working..."
                            : `Apply ${recommendedKindLabel(a.recommended_kind)}`}
                        </button>
                      )}
                      {canArchive && (
                        <button
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => void applyArchive(a)}
                          className={cn(
                            "rounded bg-[var(--error)] px-3 py-1.5 text-xs font-medium text-white",
                            "hover:opacity-90 disabled:opacity-40",
                          )}
                        >
                          {busyId === a.id ? "Working..." : "Apply archive"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === a.id || !canApply}
                        onClick={() => void dismiss(a)}
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
