"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ScheduleModal } from "./ScheduleModal";
import { cn } from "@/lib/utils";

type Schedule = {
  id: string;
  name: string;
  cadence: "daily" | "weekly" | "monthly";
  niche: string;
  tone?: string;
  targetAudience?: string;
  platforms?: Array<{ kind: string; id: string }>;
  status: "active" | "paused";
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
  // v2 fields (optional for back-compat)
  timezone?: string;                // IANA tz id, e.g. "America/New_York"
  timeOfDayLocal?: string;          // "HH:MM" 24-hour, in the user's timezone
  weekdayMask?: number[];           // 0=Sun..6=Sat; only meaningful when cadence='weekly'
  requiresApproval?: boolean;
  topicSource?: "static_niche" | "topic_proposals" | "keyword_candidates";
};

export default function AutonomousPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/agent/autonomous", { cache: "no-store" });
      const data = await resp.json();
      setSchedules(data.schedules ?? []);
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
      try {
        const resp = await fetch("/api/agent/autonomous/approvals", { cache: "no-store" });
        if (!resp.ok) return;
        const data = (await resp.json()) as { approvals?: unknown[] };
        if (!cancelled) setPendingCount(Array.isArray(data.approvals) ? data.approvals.length : 0);
      } catch {
        // non-fatal
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onSave = useCallback(async (s: Partial<Schedule>) => {
    const resp = await fetch("/api/agent/autonomous", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(s),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data?.error || `save failed (${resp.status})`);
    }
    await refresh();
  }, [refresh]);

  const onDelete = useCallback(async (id: string) => {
    await fetch("/api/agent/autonomous", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ delete: id }),
    });
    await refresh();
  }, [refresh]);

  const onToggleStatus = useCallback(async (s: Schedule) => {
    await onSave({ ...s, status: s.status === "active" ? "paused" : "active" });
  }, [onSave]);

  const onRunNow = useCallback(async (id: string) => {
    await fetch("/api/agent/autonomous/schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scheduleId: id }),
    });
  }, []);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Autonomous schedules</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Agent runs that dispatch themselves on a cadence.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/autonomous/approvals"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]"
          >
            Pending approvals
            {pendingCount > 0 && (
              <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                {pendingCount}
              </span>
            )}
          </Link>
          <button
            onClick={() => { setEditing(null); setModalOpen(true); }}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            New schedule
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error)] bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-[var(--border-default)]">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-[var(--text-tertiary)]">Loading...</div>
        ) : schedules.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--text-tertiary)]">
            No schedules yet. Create one to start autonomous agent runs.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-default)]">
            {schedules.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--text-primary)]">{s.name}</span>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                      s.status === "active"
                        ? "bg-[var(--success-light)] text-[var(--success)]"
                        : "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]",
                    )}>
                      {s.status}
                    </span>
                    <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                      {s.cadence}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                    <span>Niche: {s.niche}</span>
                    {s.nextRunAt && (
                      <span>Next run: {new Date(s.nextRunAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void onRunNow(s.id)}
                    className="rounded border border-[var(--border-default)] px-3 py-1 text-xs hover:bg-[var(--surface-sunken)]"
                  >
                    Run now
                  </button>
                  <button
                    onClick={() => void onToggleStatus(s)}
                    className="rounded border border-[var(--border-default)] px-3 py-1 text-xs hover:bg-[var(--surface-sunken)]"
                  >
                    {s.status === "active" ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => { setEditing(s); setModalOpen(true); }}
                    className="rounded border border-[var(--border-default)] px-3 py-1 text-xs hover:bg-[var(--surface-sunken)]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void onDelete(s.id)}
                    className="rounded border border-[var(--error)] px-3 py-1 text-xs text-[var(--error)] hover:bg-[var(--error-light)]"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalOpen && (
        <ScheduleModal
          initial={editing}
          onSave={async (s) => { await onSave(s); setModalOpen(false); }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
