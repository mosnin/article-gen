"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

type SignalType =
  | "seasonal_event"
  | "recurring_topic"
  | "holiday"
  | "industry_cycle"
  | "evergreen_seasonal";

type RecStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "scheduled"
  | "written"
  | "expired";

type SeasonalRecommendation = {
  id: string;
  user_id: string;
  run_id: string | null;
  topic: string;
  focus_keyword: string;
  rationale: string;
  signal_type: SignalType;
  recommended_publish_at: string;
  status: RecStatus;
  written_article_id: string | null;
  decided_at: string | null;
  created_at: string;
};

type FilterKey =
  | "pending"
  | "approved"
  | "rejected"
  | "scheduled"
  | "written"
  | "all";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "scheduled", label: "Scheduled" },
  { key: "written", label: "Written" },
  { key: "all", label: "All" },
];

const SIGNAL_LABEL: Record<SignalType, string> = {
  seasonal_event: "Seasonal event",
  recurring_topic: "Recurring topic",
  holiday: "Holiday",
  industry_cycle: "Industry cycle",
  evergreen_seasonal: "Evergreen seasonal",
};

function statusPillClass(status: RecStatus): string {
  switch (status) {
    case "approved":
      return "bg-[var(--success-light)] text-[var(--success)]";
    case "rejected":
      return "bg-[var(--error-light)] text-[var(--error)]";
    case "scheduled":
      return "bg-[var(--accent-light)] text-[var(--accent)]";
    case "written":
      return "bg-[var(--success-light)] text-[var(--success)]";
    case "expired":
      return "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]";
    case "pending":
    default:
      return "bg-[var(--warning-light)] text-[var(--warning)]";
  }
}

function signalPillClass(signal: SignalType): string {
  switch (signal) {
    case "holiday":
      return "bg-[var(--error-light)] text-[var(--error)]";
    case "seasonal_event":
      return "bg-[var(--warning-light)] text-[var(--warning)]";
    case "recurring_topic":
      return "bg-[var(--accent-light)] text-[var(--accent)]";
    case "industry_cycle":
      return "bg-[var(--success-light)] text-[var(--success)]";
    case "evergreen_seasonal":
    default:
      return "bg-[var(--surface-sunken)] text-[var(--text-secondary)]";
  }
}

function formatPublishDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysUntil(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export default function SeasonalCalendarPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [recs, setRecs] = useState<SeasonalRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedRationale, setExpandedRationale] = useState<
    Record<string, boolean>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [userNiche, setUserNiche] = useState<string>("");

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data: settings } = await supabase
        .from("user_settings")
        .select("niche")
        .eq("user_id", user.user.id)
        .maybeSingle();
      const settingsNiche = (
        (settings as { niche?: string } | null)?.niche ?? ""
      ).toString();
      if (!cancelled) setUserNiche(settingsNiche);

      const { data } = await supabase
        .from("seasonal_recommendations")
        .select("*")
        .eq("user_id", user.user.id)
        .order("recommended_publish_at", { ascending: true })
        .limit(200);
      if (!cancelled && data) setRecs(data as SeasonalRecommendation[]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Realtime
  useEffect(() => {
    let cancelled = false;
    let channelRef: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;
      if (!userId || cancelled) return;
      const chan = supabase
        .channel(`seasonal-recs-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "seasonal_recommendations",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              setRecs((prev) => {
                const next = payload.new as SeasonalRecommendation;
                if (prev.some((p) => p.id === next.id)) return prev;
                return [next, ...prev].sort((a, b) =>
                  a.recommended_publish_at.localeCompare(b.recommended_publish_at),
                );
              });
            } else if (payload.eventType === "UPDATE") {
              setRecs((prev) =>
                prev.map((p) =>
                  p.id === (payload.new as SeasonalRecommendation).id
                    ? (payload.new as SeasonalRecommendation)
                    : p,
                ),
              );
            } else if (payload.eventType === "DELETE") {
              setRecs((prev) =>
                prev.filter(
                  (p) => p.id !== (payload.old as SeasonalRecommendation).id,
                ),
              );
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

  const visible = recs.filter((p) =>
    filter === "all" ? true : p.status === filter,
  );

  async function setStatus(id: string, status: RecStatus) {
    setBusyId(id);
    const snapshot = recs;
    const decidedAt = new Date().toISOString();
    setRecs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status, decided_at: decidedAt } : p)),
    );
    const { error: updateError } = await supabase
      .from("seasonal_recommendations")
      .update({ status, decided_at: decidedAt })
      .eq("id", id);
    if (updateError) {
      setRecs(snapshot);
      setError(updateError.message);
    }
    setBusyId(null);
  }

  async function generateNow(p: SeasonalRecommendation) {
    setBusyId(p.id);
    setError(null);
    try {
      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "article",
          topic: p.topic,
          focusKeyword: p.focus_keyword,
          quality: "standard",
          options: { seasonalRecommendationId: p.id },
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        setError(`Failed to dispatch: ${errText}`);
        setBusyId(null);
        return;
      }
      const { runId } = (await resp.json()) as { runId: string };
      await supabase
        .from("seasonal_recommendations")
        .update({ status: "written", decided_at: new Date().toISOString() })
        .eq("id", p.id);
      router.push(`/app/agent-runs/${runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusyId(null);
    }
  }

  async function discover() {
    if (!userNiche.trim()) {
      setError(
        "No niche on file. Set your niche in Settings before discovering seasonal opportunities.",
      );
      return;
    }
    setDiscovering(true);
    setError(null);
    try {
      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "seasonal_calendar",
          topic: userNiche.trim(),
          quality: "standard",
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
      setDiscovering(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Seasonal calendar
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Time-sensitive content opportunities discovered by the
            SeasonalCalendarAgent. Approve, schedule, or write each pick.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void discover()}
            disabled={discovering}
            className={cn(
              "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white",
              "hover:opacity-90 disabled:opacity-50",
            )}
          >
            {discovering ? "Dispatching..." : "Discover seasonal opportunities"}
          </button>
          <Link
            href="/app/calendar"
            className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]"
          >
            Back to calendar
          </Link>
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
              ? recs.length
              : recs.filter((p) => p.status === f.key).length;
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
              ? 'No pending seasonal recommendations. Click "Discover seasonal opportunities" to surface fresh picks.'
              : "No seasonal recommendations match this filter."}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((p) => {
              const rationaleOpen = !!expandedRationale[p.id];
              const days = daysUntil(p.recommended_publish_at);
              const canDecide = p.status === "pending";
              const canSchedule =
                p.status === "pending" || p.status === "approved";
              const canGenerate =
                p.status === "pending" ||
                p.status === "approved" ||
                p.status === "scheduled";
              return (
                <li
                  key={p.id}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-[var(--text-primary)]">
                          {p.topic}
                        </h2>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                            statusPillClass(p.status),
                          )}
                        >
                          {p.status}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {p.focus_keyword && (
                          <span className="rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                            {p.focus_keyword}
                          </span>
                        )}
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            signalPillClass(p.signal_type),
                          )}
                        >
                          {SIGNAL_LABEL[p.signal_type] ?? p.signal_type}
                        </span>
                        <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                          {formatPublishDate(p.recommended_publish_at)}
                        </span>
                        {days !== null && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              days < 0
                                ? "bg-[var(--error-light)] text-[var(--error)]"
                                : days <= 7
                                  ? "bg-[var(--warning-light)] text-[var(--warning)]"
                                  : "bg-[var(--surface-sunken)] text-[var(--text-secondary)]",
                            )}
                          >
                            {days < 0
                              ? `${Math.abs(days)}d ago`
                              : days === 0
                                ? "Today"
                                : `in ${days}d`}
                          </span>
                        )}
                      </div>

                      {p.rationale && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRationale((prev) => ({
                                ...prev,
                                [p.id]: !prev[p.id],
                              }))
                            }
                            className="text-xs font-medium text-[var(--accent)] hover:underline"
                          >
                            {rationaleOpen ? "Hide rationale" : "Show rationale"}
                          </button>
                          {rationaleOpen && (
                            <p className="mt-1 whitespace-pre-wrap rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                              {p.rationale}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch gap-2 md:w-auto md:items-end">
                      <button
                        type="button"
                        disabled={busyId === p.id || !canDecide}
                        onClick={() => void setStatus(p.id, "approved")}
                        className={cn(
                          "rounded bg-[var(--success)] px-3 py-1.5 text-xs font-medium text-white",
                          "hover:opacity-90 disabled:opacity-40",
                        )}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id || !canDecide}
                        onClick={() => void setStatus(p.id, "rejected")}
                        className={cn(
                          "rounded border border-[var(--error)] px-3 py-1.5 text-xs font-medium text-[var(--error)]",
                          "hover:bg-[var(--error-light)] disabled:opacity-40",
                        )}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id || !canSchedule}
                        onClick={() => void setStatus(p.id, "scheduled")}
                        className={cn(
                          "rounded border border-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent)]",
                          "hover:bg-[var(--accent-light)] disabled:opacity-40",
                        )}
                      >
                        Schedule
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id || !canGenerate}
                        onClick={() => void generateNow(p)}
                        className={cn(
                          "rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white",
                          "hover:opacity-90 disabled:opacity-40",
                        )}
                      >
                        {busyId === p.id ? "Working..." : "Generate now"}
                      </button>
                      {p.written_article_id && (
                        <Link
                          href={`/app/articles/${p.written_article_id}`}
                          className="rounded border border-[var(--border-default)] px-3 py-1.5 text-center text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                        >
                          Open article
                        </Link>
                      )}
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
