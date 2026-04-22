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
        throw new Error(data?.error ?? `action failed (${resp.status})`);
      }
    } catch (e) {
      setApprovals(snapshot);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }, [approvals]);

  return (
    <div className="mx-auto max-w-4xl p-6">
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
          <ul className="divide-y divide-[var(--border-default)]">
            {approvals.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-4 px-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[var(--text-primary)]">
                    {a.topic_suggestion}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
                    {a.niche && <span>Niche: {a.niche}</span>}
                    {a.focus_keyword && <span>Keyword: {a.focus_keyword}</span>}
                    {a.tone && <span>Tone: {a.tone}</span>}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                    {relativeTime(a.proposed_run_at)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={busyId === a.id}
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
                    disabled={busyId === a.id}
                    onClick={() => void decide(a.id, "reject")}
                    className="rounded border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] disabled:opacity-50"
                  >
                    Reject
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
