"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type HealthSummary = {
  window: "24h" | "7d";
  runs: { pending: number; running: number; succeeded: number; failed: number; cancelled: number };
  totals: {
    totalRuns: number;
    succeededRuns: number;
    failedRuns: number;
    avgDurationMs: number | null;
    p95DurationMs: number | null;
    totalTokensIn: number;
    totalTokensOut: number;
    totalCostUsd: number;
  };
  stuckRunsCount: number;
  topFailingTools: Array<{ toolName: string; errorCount: number }>;
  topFailingAgents: Array<{ agentName: string; errorCount: number }>;
  recentFailures: Array<{ id: string; topic: string; error: string | null; created_at: string }>;
};

type StatusKey = keyof HealthSummary["runs"];

const STATUS_STYLES: Record<StatusKey, { label: string; bg: string; fg: string }> = {
  pending: {
    label: "Pending",
    bg: "var(--surface-sunken)",
    fg: "var(--text-secondary)",
  },
  running: {
    label: "Running",
    bg: "var(--warning-light)",
    fg: "var(--warning)",
  },
  succeeded: {
    label: "Succeeded",
    bg: "var(--success-light)",
    fg: "var(--success)",
  },
  failed: {
    label: "Failed",
    bg: "var(--error-light)",
    fg: "var(--error)",
  },
  cancelled: {
    label: "Cancelled",
    bg: "var(--surface-sunken)",
    fg: "var(--text-tertiary)",
  },
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = s / 60;
  if (m < 60) return `${m.toFixed(1)}m`;
  const h = m / 60;
  return `${h.toFixed(1)}h`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatCost(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 truncate text-xs font-medium text-[var(--text-primary)]" title={label}>
        {label}
      </div>
      <div className="relative h-5 flex-1 overflow-hidden rounded-md" style={{ background: "var(--surface-sunken)" }}>
        <div
          className="h-full rounded-md transition-all"
          style={{ width: `${pct}%`, background: "var(--error)" }}
        />
      </div>
      <div className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
        {value}
      </div>
    </div>
  );
}

export function AgentHealthWidget({ className }: { className?: string }) {
  const [data, setData] = useState<HealthSummary | null>(null);
  const [windowParam, setWindowParam] = useState<"24h" | "7d">("24h");
  const [isLoading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/agent-health?window=${windowParam}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<HealthSummary>;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [windowParam]);

  const successRate =
    data && data.totals.totalRuns > 0
      ? Math.round((data.totals.succeededRuns / data.totals.totalRuns) * 1000) / 10
      : null;

  const maxToolFailures = data?.topFailingTools[0]?.errorCount ?? 0;
  const maxAgentFailures = data?.topFailingAgents[0]?.errorCount ?? 0;

  return (
    <div
      className={cn(
        "rounded-xl border p-5",
        className,
      )}
      style={{
        background: "var(--surface-raised)",
        borderColor: "var(--border-default)",
      }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[var(--text-primary)]">Agent Health</h2>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
            Live overview of agent run status, costs, and failures
          </p>
        </div>
        <div
          className="inline-flex overflow-hidden rounded-lg border"
          style={{ borderColor: "var(--border-default)" }}
        >
          {(["24h", "7d"] as const).map((w) => {
            const active = windowParam === w;
            return (
              <button
                key={w}
                type="button"
                onClick={() => setWindowParam(w)}
                className="px-3 py-1 text-xs font-semibold transition-colors"
                style={{
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "#fff" : "var(--text-secondary)",
                }}
              >
                {w}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-sm text-[var(--text-tertiary)]">
          Loading agent health…
        </div>
      ) : error ? (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--error)",
            background: "var(--error-light)",
            color: "var(--error)",
          }}
        >
          Failed to load agent health: {error}
        </div>
      ) : !data ? (
        <div className="py-10 text-center text-sm text-[var(--text-tertiary)]">No data.</div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Status pills */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATUS_STYLES) as StatusKey[]).map((key) => {
              const cfg = STATUS_STYLES[key];
              const count = data.runs[key];
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-full px-3 py-1"
                  style={{ background: cfg.bg }}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: cfg.fg }}
                  />
                  <span
                    className="text-xs font-semibold"
                    style={{ color: cfg.fg }}
                  >
                    {cfg.label}
                  </span>
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{ color: cfg.fg }}
                  >
                    {count}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Total Runs", value: formatNumber(data.totals.totalRuns) },
              {
                label: "Success Rate",
                value: successRate === null ? "—" : `${successRate}%`,
              },
              { label: "Avg Duration", value: formatDuration(data.totals.avgDurationMs) },
              { label: "p95 Duration", value: formatDuration(data.totals.p95DurationMs) },
              { label: "Total Cost", value: formatCost(data.totals.totalCostUsd) },
              {
                label: "Tokens (in/out)",
                value: `${formatNumber(data.totals.totalTokensIn)} / ${formatNumber(data.totals.totalTokensOut)}`,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border px-3 py-2"
                style={{
                  borderColor: "var(--border-default)",
                  background: "var(--surface-sunken)",
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                  {stat.label}
                </p>
                <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Stuck runs */}
          <div
            className="flex items-center justify-between rounded-lg border px-4 py-2.5"
            style={{
              borderColor:
                data.stuckRunsCount > 0 ? "var(--error)" : "var(--border-default)",
              background:
                data.stuckRunsCount > 0 ? "var(--error-light)" : "var(--surface-sunken)",
            }}
          >
            <div>
              <p
                className="text-xs font-semibold"
                style={{
                  color:
                    data.stuckRunsCount > 0 ? "var(--error)" : "var(--text-secondary)",
                }}
              >
                Stuck Runs
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                Status=running, no update in &gt;10 min (all time)
              </p>
            </div>
            <span
              className="text-2xl font-bold tabular-nums"
              style={{
                color: data.stuckRunsCount > 0 ? "var(--error)" : "var(--text-primary)",
              }}
            >
              {data.stuckRunsCount}
            </span>
          </div>

          {/* Failing tools + agents */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div
              className="rounded-lg border p-4"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--surface-sunken)",
              }}
            >
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Top Failing Tools
              </h3>
              {data.topFailingTools.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)]">No tool failures in window.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.topFailingTools.map((t) => (
                    <BarRow
                      key={t.toolName}
                      label={t.toolName}
                      value={t.errorCount}
                      max={maxToolFailures}
                    />
                  ))}
                </div>
              )}
            </div>

            <div
              className="rounded-lg border p-4"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--surface-sunken)",
              }}
            >
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Top Failing Agents
              </h3>
              {data.topFailingAgents.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)]">No agent failures in window.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.topFailingAgents.map((a) => (
                    <BarRow
                      key={a.agentName}
                      label={a.agentName}
                      value={a.errorCount}
                      max={maxAgentFailures}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent failures */}
          <div
            className="rounded-lg border p-4"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--surface-sunken)",
            }}
          >
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
              Recent Failures
            </h3>
            {data.recentFailures.length === 0 ? (
              <p className="text-xs text-[var(--text-tertiary)]">No failed runs in window.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {data.recentFailures.map((f) => (
                  <Link
                    key={f.id}
                    href={`/app/agent-runs/${f.id}`}
                    className="flex items-start justify-between gap-3 rounded-md px-3 py-2 transition-colors hover:opacity-80"
                    style={{ background: "var(--error-light)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-xs font-semibold"
                        style={{ color: "var(--text-primary)" }}
                        title={f.topic}
                      >
                        {f.topic || "(no topic)"}
                      </p>
                      {f.error && (
                        <p
                          className="mt-0.5 truncate text-[11px]"
                          style={{ color: "var(--error)" }}
                          title={f.error}
                        >
                          {f.error}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-[var(--text-tertiary)]">
                      {new Date(f.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
