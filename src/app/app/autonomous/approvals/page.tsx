"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createClient as createSupabaseBrowser } from "@/lib/supabase-browser";

type PendingApproval = {
  id: string;
  user_id: string;
  schedule_id: string | null;
  topic_suggestion: string;
  focus_keyword: string | null;
  niche: string | null;
  tone: string | null;
  target_audience: string | null;
  platforms: Array<{ kind: string; id: string }> | null;
  proposed_run_at: string;
  status: "pending" | "approved" | "rejected";
  decided_at: string | null;
  dispatched_run_id: string | null;
  created_at: string;
};

type Schedule = {
  id: string;
  name: string;
  cadence: "daily" | "weekly" | "monthly";
  niche?: string;
  tone?: string;
  targetAudience?: string;
};

type BulkResponse = {
  ok: boolean;
  succeeded?: string[];
  failed?: Array<{ id: string; error: string }>;
  error?: string;
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return sec <= 1 ? "just now" : `proposed ${sec} sec ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `proposed ${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `proposed ${hr} hr ago`;
  const day = Math.round(hr / 24);
  return `proposed ${day} day${day === 1 ? "" : "s"} ago`;
}

export default function AutonomousApprovalsPage() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scheduleMap, setScheduleMap] = useState<Map<string, Schedule>>(new Map());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/agent/autonomous/approvals", { cache: "no-store" });
      const data = (await resp.json()) as { approvals?: PendingApproval[]; error?: string };
      if (!resp.ok) throw new Error(data.error ?? `load failed (${resp.status})`);
      setApprovals(data.approvals ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) setUserId(data.user?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  // Load schedule map once we know the userId.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error: schedErr } = await supabase
          .from("user_settings")
          .select("autonomous_schedules")
          .eq("user_id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (schedErr) return;
        const row = data as { autonomous_schedules?: Schedule[] } | null;
        const list = Array.isArray(row?.autonomous_schedules) ? row?.autonomous_schedules ?? [] : [];
        const map = new Map<string, Schedule>();
        for (const s of list) {
          if (s && typeof s.id === "string") map.set(s.id, s);
        }
        setScheduleMap(map);
      } catch {
        /* silent */
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`autonomous_pending_approvals:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "autonomous_pending_approvals",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as PendingApproval;
          if (row.status !== "pending") return;
          setApprovals((prev) => {
            if (prev.some((p) => p.id === row.id)) return prev;
            return [row, ...prev];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "autonomous_pending_approvals",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as PendingApproval;
          setApprovals((prev) => {
            if (row.status !== "pending") {
              return prev.filter((p) => p.id !== row.id);
            }
            return prev.map((p) => (p.id === row.id ? row : p));
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  // Drop selections that are no longer in the visible list.
  useEffect(() => {
    setSelectedIds((prev) => {
      const visible = new Set(approvals.map((a) => a.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visible.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [approvals]);

  const decide = useCallback(async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    // optimistic remove
    const snapshot = approvals;
    setApprovals((prev) => prev.filter((p) => p.id !== id));
    try {
      const resp = await fetch("/api/agent/autonomous/approvals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error((data as { error?: string })?.error ?? `action failed (${resp.status})`);
      }
    } catch (e) {
      setApprovals(snapshot);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }, [approvals]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allVisibleSelected =
    approvals.length > 0 && approvals.every((a) => selectedIds.has(a.id));
  const someVisibleSelected = !allVisibleSelected && approvals.some((a) => selectedIds.has(a.id));

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      if (approvals.length > 0 && approvals.every((a) => prev.has(a.id))) {
        // unselect all visible
        const next = new Set(prev);
        for (const a of approvals) next.delete(a.id);
        return next;
      }
      const next = new Set(prev);
      for (const a of approvals) next.add(a.id);
      return next;
    });
  }, [approvals]);

  const bulkDecide = useCallback(async (action: "approve" | "reject") => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(true);
    const snapshot = approvals;
    // optimistic remove
    setApprovals((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    try {
      const resp = await fetch("/api/agent/autonomous/approvals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      const data = (await resp.json().catch(() => ({}))) as BulkResponse;
      if (!resp.ok) {
        throw new Error(data.error ?? `bulk action failed (${resp.status})`);
      }
      const failedIds = new Set((data.failed ?? []).map((f) => f.id));
      if (failedIds.size > 0) {
        // restore failed rows
        const restore = snapshot.filter((p) => failedIds.has(p.id));
        setApprovals((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const r of restore) if (!seen.has(r.id)) merged.push(r);
          return merged;
        });
        const firstError = data.failed?.[0]?.error ?? "bulk_partial_failure";
        setError(`${failedIds.size} item(s) failed: ${firstError}`);
      } else {
        setError(null);
      }
      // clear processed ids from selection regardless of outcome
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    } catch (e) {
      setApprovals(snapshot);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkBusy(false);
    }
  }, [approvals, selectedIds]);

  const selectedCount = selectedIds.size;

  return (
    <div className="mx-auto max-w-4xl p-6 pb-24">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Pending approvals</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Review each proposed autonomous article before it runs.
          </p>
        </div>
        <Link
          href="/app/autonomous"
          className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]"
        >
          Back to schedules
        </Link>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error)] bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)]">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-[var(--text-tertiary)]">Loading...</div>
        ) : approvals.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--text-tertiary)]">
            No pending approvals
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-[var(--border-default)] px-4 py-2.5">
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected;
                  }}
                  onChange={toggleAllVisible}
                  aria-label="Select all visible"
                  className="h-4 w-4 rounded border-[var(--border-default)] text-[var(--accent)] focus:ring-[var(--border-focus)]"
                />
                <span>Select all visible</span>
              </label>
              <span className="ml-auto text-xs text-[var(--text-tertiary)]">
                {selectedCount > 0 ? `${selectedCount} selected` : `${approvals.length} pending`}
              </span>
            </div>
            <ul className="divide-y divide-[var(--border-default)]">
              {approvals.map((a) => {
                const schedule = a.schedule_id ? scheduleMap.get(a.schedule_id) ?? null : null;
                const isSelected = selectedIds.has(a.id);
                return (
                  <li key={a.id} className="flex items-start gap-3 px-4 py-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(a.id)}
                      aria-label={`Select ${a.topic_suggestion}`}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--border-default)] text-[var(--accent)] focus:ring-[var(--border-focus)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[var(--text-primary)]">
                        {a.topic_suggestion}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
                        {a.niche && <span>Niche: {a.niche}</span>}
                        {a.focus_keyword && <span>Keyword: {a.focus_keyword}</span>}
                        {a.tone && <span>Tone: {a.tone}</span>}
                        {schedule && (
                          <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                            {schedule.name} &middot; {schedule.cadence}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                        {relativeTime(a.proposed_run_at)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        disabled={busyId === a.id || bulkBusy}
                        onClick={() => void decide(a.id, "approve")}
                        className={cn(
                          "rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white",
                          "hover:opacity-90 disabled:opacity-50",
                        )}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === a.id || bulkBusy}
                        onClick={() => void decide(a.id, "reject")}
                        className="rounded border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {selectedCount > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-default)] bg-[var(--surface-raised)] shadow-lg"
        >
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-6 py-3">
            <span className="text-sm text-[var(--text-secondary)]">
              {selectedCount} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => void bulkDecide("reject")}
                className="rounded border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] disabled:opacity-50"
              >
                Reject {selectedCount} selected
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => void bulkDecide("approve")}
                className={cn(
                  "rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white",
                  "hover:opacity-90 disabled:opacity-50",
                )}
              >
                Approve {selectedCount} selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
