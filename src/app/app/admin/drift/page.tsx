"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Scope = "global" | "user";
type Severity = "low" | "medium" | "high" | "critical";
type Status = "pending" | "acknowledged" | "resolved" | "dismissed";
type DiagnosedCause =
  | "model_snapshot_change"
  | "prompt_edit"
  | "data_drift"
  | "unknown";

type DriftAlert = {
  id: string;
  user_id: string | null;
  run_id: string | null;
  scope: Scope;
  agent_kind: string;
  baseline_score: number | string;
  current_score: number | string;
  delta_pct: number | string;
  sample_size: number;
  diagnosed_cause: DiagnosedCause | null;
  severity: Severity;
  evidence: Array<{ runId?: string; currentScore?: number | string }> | unknown;
  status: Status;
  decided_at: string | null;
  created_at: string;
};

type AdminUser = {
  user_id: string;
  role: string;
  subscription_plan: string;
};

type StatusFilter = Status | "all";
type SeverityFilter = Severity | "all";

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];

const SEVERITY_FILTERS: Array<{ key: SeverityFilter; label: string }> = [
  { key: "all", label: "All severity" },
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

const SEVERITY_PILL: Record<Severity, string> = {
  critical: "bg-[var(--error-light)] text-[var(--error)]",
  high: "bg-[var(--warning-light)] text-[var(--warning)]",
  medium: "bg-[var(--accent-light)] text-[var(--accent)]",
  low: "bg-[var(--surface-sunken)] text-[var(--text-secondary)]",
};

const STATUS_PILL: Record<Status, string> = {
  pending: "bg-[var(--warning-light)] text-[var(--warning)]",
  acknowledged: "bg-[var(--accent-light)] text-[var(--accent)]",
  resolved: "bg-[var(--success-light)] text-[var(--success)]",
  dismissed: "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]",
};

function num(v: number | string): number {
  return typeof v === "number" ? v : Number(v);
}

function fmtScore(v: number | string): string {
  const n = num(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(3);
}

function fmtPct(v: number | string): string {
  const n = num(v);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export default function AdminDriftPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [authState, setAuthState] = useState<"checking" | "ok" | "forbidden">("checking");
  const [alerts, setAlerts] = useState<DriftAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersFetched, setUsersFetched] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [freeTextUserId, setFreeTextUserId] = useState<string>("");

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [runningGlobal, setRunningGlobal] = useState(false);
  const [runningUser, setRunningUser] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  // Admin gate via existing /api/admin/agent-health proxy
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/agent-health?window=24h");
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          setAuthState("forbidden");
          return;
        }
        if (!res.ok) {
          setAuthState("forbidden");
          return;
        }
        setAuthState("ok");
      } catch {
        if (!cancelled) setAuthState("forbidden");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch initial alerts (RLS will filter to admin-visible rows: global rows + own user rows).
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("prompt_drift_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (err) {
      setError(err.message);
      setAlerts([]);
    } else if (data) {
      setAlerts(data as DriftAlert[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (authState !== "ok") return;
    void fetchAlerts();
  }, [authState, fetchAlerts]);

  // Fetch user list (best-effort — falls back to free-text input on failure)
  useEffect(() => {
    if (authState !== "ok") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/users");
        if (cancelled) return;
        if (!res.ok) {
          setUsersFetched(true);
          return;
        }
        const data = (await res.json()) as { users?: AdminUser[] };
        if (!cancelled) {
          setUsers(data.users ?? []);
          setUsersFetched(true);
        }
      } catch {
        if (!cancelled) setUsersFetched(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authState]);

  // Realtime subscription on prompt_drift_alerts
  useEffect(() => {
    if (authState !== "ok") return;
    let cancelled = false;
    let channelRef: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      if (cancelled) return;
      const chan = supabase
        .channel("admin-prompt-drift-alerts")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "prompt_drift_alerts" },
          (payload) => {
            if (payload.eventType === "INSERT") {
              setAlerts((prev) => {
                const next = payload.new as DriftAlert;
                if (prev.some((a) => a.id === next.id)) return prev;
                return [next, ...prev];
              });
            } else if (payload.eventType === "UPDATE") {
              setAlerts((prev) =>
                prev.map((a) =>
                  a.id === (payload.new as DriftAlert).id
                    ? (payload.new as DriftAlert)
                    : a,
                ),
              );
            } else if (payload.eventType === "DELETE") {
              setAlerts((prev) => prev.filter((a) => a.id !== (payload.old as DriftAlert).id));
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
  }, [authState, supabase]);

  const visible = alerts.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (severityFilter !== "all" && a.severity !== severityFilter) return false;
    return true;
  });

  async function runGlobal() {
    setRunningGlobal(true);
    setRunMessage(null);
    try {
      const res = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "prompt_drift_detect",
          topic: "Global prompt drift detection",
          driftScope: "global",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRunMessage(`Failed: ${data.error ?? res.statusText}`);
      } else {
        setRunMessage("Global drift check started.");
      }
    } catch (e) {
      setRunMessage(e instanceof Error ? e.message : "Failed to start run");
    } finally {
      setRunningGlobal(false);
    }
  }

  async function runUserScoped() {
    const targetUserId = selectedUserId.trim() || freeTextUserId.trim();
    if (!targetUserId) {
      setRunMessage("Pick or paste a user ID first.");
      return;
    }
    setRunningUser(true);
    setRunMessage(null);
    try {
      const res = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "prompt_drift_detect",
          topic: `User-scoped prompt drift (${targetUserId.slice(0, 8)})`,
          driftScope: "user",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRunMessage(`Failed: ${data.error ?? res.statusText}`);
      } else {
        setRunMessage(`User-scoped drift check started for ${targetUserId.slice(0, 8)}…`);
      }
    } catch (e) {
      setRunMessage(e instanceof Error ? e.message : "Failed to start run");
    } finally {
      setRunningUser(false);
    }
  }

  async function decide(id: string, status: Status) {
    setBusyAction(id);
    const snapshot = alerts;
    const decidedAt = new Date().toISOString();
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status, decided_at: decidedAt } : a)),
    );
    const { error: err } = await supabase
      .from("prompt_drift_alerts")
      .update({ status, decided_at: decidedAt })
      .eq("id", id);
    if (err) {
      setAlerts(snapshot);
      setError(err.message);
    }
    setBusyAction(null);
  }

  if (authState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)]">
        <svg
          className="progress-spinner"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-label="Loading"
        >
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      </div>
    );
  }

  if (authState === "forbidden") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)]">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] px-6 py-5 text-center">
          <p className="text-sm font-semibold text-[var(--error,#ef4444)]">
            Admin access required
          </p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            You don&apos;t have permission to view prompt drift alerts.
          </p>
          <button
            type="button"
            onClick={() => router.push("/app")}
            className="mt-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)]"
          >
            Back to app
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-base)]">
      <header className="sticky top-0 z-50 border-b border-[var(--border-default)] bg-[var(--surface-base)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/app/admin")}
              className="text-sm font-semibold text-[var(--text-primary)] hover:opacity-80"
            >
              Admin
            </button>
            <span className="text-[var(--text-tertiary)]">/</span>
            <span className="text-sm font-semibold text-[var(--error,#ef4444)]">
              Prompt Drift
            </span>
          </div>
          <button
            onClick={() => router.push("/app/admin")}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] px-3.5 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] transition-colors"
          >
            Back to Admin
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Prompt Drift</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Quality regressions detected by the PromptDriftDetectorAgent. Compares
            mean QAAgent overall scores per agent_kind for the last 30d vs the
            prior 30d.
          </p>
        </div>

        {/* Run controls */}
        <div className="mb-6 rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] p-5">
          <h2 className="mb-3 text-sm font-bold text-[var(--text-primary)]">
            Run a drift check
          </h2>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
            <div>
              <button
                type="button"
                disabled={runningGlobal}
                onClick={runGlobal}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {runningGlobal ? "Starting…" : "Run global drift check"}
              </button>
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                User-scoped check
              </label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                {usersFetched && users.length > 0 ? (
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    <option value="">— pick a user —</option>
                    {users.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.user_id.slice(0, 8)}…{u.user_id.slice(-4)} ({u.subscription_plan})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="user-id (uuid)"
                    value={freeTextUserId}
                    onChange={(e) => setFreeTextUserId(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                )}
                <button
                  type="button"
                  disabled={runningUser}
                  onClick={runUserScoped}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] disabled:opacity-60"
                >
                  {runningUser ? "Starting…" : "Run user-scoped check"}
                </button>
              </div>
            </div>
          </div>
          {runMessage && (
            <p className="mt-3 text-xs text-[var(--text-secondary)]">{runMessage}</p>
          )}
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {SEVERITY_FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-[var(--text-tertiary)]">
            {visible.length} alert{visible.length === 1 ? "" : "s"}
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-[var(--error,#ef4444)] bg-[var(--error-light)] px-4 py-2.5 text-xs text-[var(--error,#ef4444)]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-[var(--text-tertiary)]">
            <svg
              className="progress-spinner"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            <p className="text-sm">Loading drift alerts…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] py-16 text-center text-sm text-[var(--text-tertiary)]">
            No drift alerts match the current filters.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((a) => {
              const evidenceArr = Array.isArray(a.evidence)
                ? (a.evidence as Array<{ runId?: string; currentScore?: number | string }>)
                : [];
              const expanded = expandedEvidence[a.id] ?? false;
              return (
                <div
                  key={a.id}
                  className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        a.scope === "global"
                          ? "bg-[var(--accent-light)] text-[var(--accent)]"
                          : "bg-[var(--surface-sunken)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {a.scope}
                    </span>
                    <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-sunken)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-primary)]">
                      {a.agent_kind}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${SEVERITY_PILL[a.severity]}`}>
                      {a.severity}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_PILL[a.status]}`}>
                      {a.status}
                    </span>
                    <span className="ml-auto text-[11px] text-[var(--text-tertiary)]">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg bg-[var(--surface-sunken)] px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                        Current → Baseline
                      </p>
                      <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">
                        {fmtScore(a.current_score)} → {fmtScore(a.baseline_score)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[var(--surface-sunken)] px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                        Delta
                      </p>
                      <p className={`mt-1 text-sm font-bold ${num(a.delta_pct) < 0 ? "text-[var(--error)]" : "text-[var(--text-primary)]"}`}>
                        {fmtPct(a.delta_pct)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[var(--surface-sunken)] px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                        Sample size
                      </p>
                      <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">
                        {a.sample_size}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[var(--surface-sunken)] px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                        Diagnosed cause
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                        {a.diagnosed_cause ?? "unknown"}
                      </p>
                    </div>
                  </div>

                  {evidenceArr.length > 0 && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedEvidence((prev) => ({ ...prev, [a.id]: !expanded }))
                        }
                        className="text-xs font-semibold text-[var(--accent)] hover:opacity-80"
                      >
                        {expanded ? "Hide" : "Show"} evidence ({evidenceArr.length})
                      </button>
                      {expanded && (
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {evidenceArr.map((ev, idx) => {
                            const rid = typeof ev?.runId === "string" ? ev.runId : null;
                            const sc = ev?.currentScore;
                            return (
                              <li
                                key={`${a.id}-ev-${idx}`}
                                className="flex items-center justify-between rounded-md bg-[var(--surface-sunken)] px-3 py-1.5 text-xs"
                              >
                                {rid ? (
                                  <Link
                                    href={`/app/agent-runs/${rid}`}
                                    className="font-mono text-[var(--accent)] hover:opacity-80"
                                  >
                                    {rid.slice(0, 8)}…{rid.slice(-4)}
                                  </Link>
                                ) : (
                                  <span className="font-mono text-[var(--text-tertiary)]">
                                    (no run id)
                                  </span>
                                )}
                                {sc !== undefined && (
                                  <span className="text-[var(--text-secondary)]">
                                    score {fmtScore(sc as number | string)}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyAction === a.id || a.status === "acknowledged"}
                      onClick={() => decide(a.id, "acknowledged")}
                      className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] disabled:opacity-50"
                    >
                      Acknowledge
                    </button>
                    <button
                      type="button"
                      disabled={busyAction === a.id || a.status === "resolved"}
                      onClick={() => decide(a.id, "resolved")}
                      className="rounded-lg bg-[var(--success,#16a34a)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      disabled={busyAction === a.id || a.status === "dismissed"}
                      onClick={() => decide(a.id, "dismissed")}
                      className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
