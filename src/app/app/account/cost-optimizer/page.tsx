"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

type ReportStatus = "pending" | "reviewed" | "applied" | "dismissed";
type FilterKey = ReportStatus | "all";
type PeriodKey = 7 | 30 | 90;

type Recommendation = {
  kind: string;
  change: string;
  estimated_savings_usd: number;
  reason: string;
};

type Report = {
  id: string;
  user_id: string;
  run_id: string | null;
  period_start: string;
  period_end: string;
  total_cost_usd: number;
  total_runs: number;
  cost_by_kind: Record<string, number>;
  recommendations: Recommendation[];
  status: ReportStatus;
  decided_at: string | null;
  created_at: string;
};

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "reviewed", label: "Reviewed" },
  { key: "applied", label: "Applied" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: 7, label: "Last 7 days" },
  { key: 30, label: "Last 30 days" },
  { key: 90, label: "Last 90 days" },
];

function statusPillClass(status: ReportStatus): string {
  switch (status) {
    case "applied":
      return "bg-[var(--success-light)] text-[var(--success)]";
    case "dismissed":
      return "bg-[var(--error-light)] text-[var(--error)]";
    case "reviewed":
      return "bg-[var(--accent-light)] text-[var(--accent)]";
    case "pending":
    default:
      return "bg-[var(--warning-light)] text-[var(--warning)]";
  }
}

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function asCostByKind(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = asNumber(val);
  }
  return out;
}

function asRecommendations(v: unknown): Recommendation[] {
  if (!Array.isArray(v)) return [];
  const out: Recommendation[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    out.push({
      kind: String(r.kind ?? "other"),
      change: String(r.change ?? ""),
      estimated_savings_usd: asNumber(r.estimated_savings_usd),
      reason: String(r.reason ?? ""),
    });
  }
  return out;
}

function normalizeReport(raw: unknown): Report {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    user_id: String(r.user_id ?? ""),
    run_id: (r.run_id as string | null) ?? null,
    period_start: String(r.period_start ?? new Date().toISOString()),
    period_end: String(r.period_end ?? new Date().toISOString()),
    total_cost_usd: asNumber(r.total_cost_usd),
    total_runs: Math.round(asNumber(r.total_runs)),
    cost_by_kind: asCostByKind(r.cost_by_kind),
    recommendations: asRecommendations(r.recommendations),
    status: ((r.status as ReportStatus) ?? "pending") as ReportStatus,
    decided_at: (r.decided_at as string | null) ?? null,
    created_at: String(r.created_at ?? new Date().toISOString()),
  };
}

function formatUsd(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: n < 1 ? 4 : 2,
    maximumFractionDigits: n < 1 ? 4 : 2,
  });
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function CostByKindChart({ costByKind }: { costByKind: Record<string, number> }) {
  const entries = Object.entries(costByKind)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return (
      <p className="text-xs text-[var(--text-tertiary)]">No per-kind cost recorded.</p>
    );
  }
  const max = Math.max(...entries.map(([, v]) => v));
  return (
    <div className="space-y-1.5">
      {entries.map(([kind, usd]) => {
        const pct = max > 0 ? Math.max(2, Math.round((usd / max) * 100)) : 0;
        return (
          <div key={kind} className="grid grid-cols-[140px_1fr_80px] items-center gap-2">
            <span className="truncate font-mono text-[11px] text-[var(--text-secondary)]">
              {kind}
            </span>
            <div className="h-3 rounded-full bg-[var(--surface-sunken)]">
              <div
                className="h-3 rounded-full bg-[var(--accent)]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-right font-mono text-[11px] text-[var(--text-primary)]">
              {formatUsd(usd)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function CostOptimizerPage() {
  const supabase = useMemo(() => createClient(), []);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [period, setPeriod] = useState<PeriodKey>(30);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("cost_optimization_reports")
        .select("*")
        .eq("user_id", user.user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!cancelled && data) {
        setReports((data as unknown[]).map(normalizeReport));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Realtime subscription
  useEffect(() => {
    let cancelled = false;
    let channelRef: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;
      if (!userId || cancelled) return;
      const chan = supabase
        .channel(`cost-optimizer-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "cost_optimization_reports",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const next = normalizeReport(payload.new);
              setReports((prev) =>
                prev.some((r) => r.id === next.id) ? prev : [next, ...prev],
              );
            } else if (payload.eventType === "UPDATE") {
              const next = normalizeReport(payload.new);
              setReports((prev) => prev.map((r) => (r.id === next.id ? next : r)));
            } else if (payload.eventType === "DELETE") {
              const old = payload.old as { id?: string };
              setReports((prev) => prev.filter((r) => r.id !== old.id));
            }
          },
        )
        .subscribe();
      channelRef = chan;
    })();
    return () => {
      cancelled = true;
      if (channelRef) void supabase.removeChannel(channelRef);
    };
  }, [supabase]);

  const visible = reports.filter((r) =>
    filter === "all" ? true : r.status === filter,
  );

  async function runAnalysis() {
    setDispatching(true);
    setError(null);
    try {
      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "cost_optimize",
          topic: `Cost analysis (last ${period} days)`,
          costPeriodDays: period,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        setError(`Failed to dispatch: ${text}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDispatching(false);
    }
  }

  async function decide(id: string, status: ReportStatus) {
    setBusyId(id);
    const snapshot = reports;
    const decidedAt = status === "pending" ? null : new Date().toISOString();
    setReports((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status, decided_at: decidedAt } : r,
      ),
    );
    const { error: updateError } = await supabase
      .from("cost_optimization_reports")
      .update({ status, decided_at: decidedAt })
      .eq("id", id);
    if (updateError) {
      setReports(snapshot);
      setError(updateError.message);
    }
    setBusyId(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Cost optimizer
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Run a cost analysis to see which agent kinds are eating your spend
            and get concrete config tweaks for cutting it back without losing
            value you actually use.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-1">
            {PERIODS.map((p) => {
              const active = p.key === period;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium",
                    active
                      ? "bg-[var(--accent-light)] text-[var(--accent)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => void runAnalysis()}
            disabled={dispatching}
            className={cn(
              "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white",
              "hover:opacity-90 disabled:opacity-50",
            )}
          >
            {dispatching
              ? "Dispatching..."
              : `Run cost analysis (last ${period} days)`}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-[var(--error)] bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          const count =
            f.key === "all"
              ? reports.length
              : reports.filter((r) => r.status === f.key).length;
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
                {count}
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
              ? "No pending cost reports. Click “Run cost analysis” to generate one."
              : "No reports match this filter."}
          </div>
        ) : (
          <ul className="space-y-4">
            {visible.map((r) => (
              <li
                key={r.id}
                className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-[var(--text-primary)]">
                        {formatDate(r.period_start)} – {formatDate(r.period_end)}
                      </h2>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                          statusPillClass(r.status),
                        )}
                      >
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                      Generated {formatDate(r.created_at)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-baseline gap-4">
                    <div className="text-right">
                      <div className="text-3xl font-semibold text-[var(--text-primary)]">
                        {formatUsd(r.total_cost_usd)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                        Total cost
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-semibold text-[var(--text-primary)]">
                        {r.total_runs.toLocaleString()}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                        Total runs
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-[11px] uppercase tracking-wider text-[var(--text-tertiary)]">
                    Cost by kind
                  </h3>
                  <CostByKindChart costByKind={r.cost_by_kind} />
                </div>

                <div>
                  <h3 className="mb-2 text-[11px] uppercase tracking-wider text-[var(--text-tertiary)]">
                    Recommendations ({r.recommendations.length})
                  </h3>
                  {r.recommendations.length === 0 ? (
                    <p className="text-xs text-[var(--text-tertiary)]">
                      No recommendations — spend looks healthy.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {r.recommendations.map((rec, i) => (
                        <li
                          key={`${r.id}-${i}`}
                          className="rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[var(--accent-light)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]">
                              {rec.kind}
                            </span>
                            <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                              Save ~ {formatUsd(rec.estimated_savings_usd)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-[var(--text-primary)]">
                            {rec.change}
                          </p>
                          {rec.reason && (
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">
                              {rec.reason}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border-default)] pt-3">
                  {r.run_id && (
                    <Link
                      href={`/app/agent-runs/${r.run_id}`}
                      className="rounded border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                    >
                      View run
                    </Link>
                  )}
                  <button
                    type="button"
                    disabled={busyId === r.id || r.status === "reviewed"}
                    onClick={() => void decide(r.id, "reviewed")}
                    className={cn(
                      "rounded border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]",
                      "hover:bg-[var(--surface-sunken)] disabled:opacity-40",
                    )}
                  >
                    Mark reviewed
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id || r.status === "dismissed"}
                    onClick={() => void decide(r.id, "dismissed")}
                    className={cn(
                      "rounded border border-[var(--error)] px-3 py-1.5 text-xs font-medium text-[var(--error)]",
                      "hover:bg-[var(--error-light)] disabled:opacity-40",
                    )}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id || r.status === "applied"}
                    onClick={() => void decide(r.id, "applied")}
                    className={cn(
                      "rounded bg-[var(--success)] px-3 py-1.5 text-xs font-medium text-white",
                      "hover:opacity-90 disabled:opacity-40",
                    )}
                  >
                    Mark applied
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
