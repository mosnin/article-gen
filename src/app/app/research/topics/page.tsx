"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

type FreshnessSignal =
  | "news_30d"
  | "trending_search"
  | "competitor_recent"
  | "seasonal"
  | "evergreen_gap";

type ProposalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "written_in_progress"
  | "written"
  | "expired";

type Proposal = {
  id: string;
  niche: string;
  title: string;
  focus_keyword: string;
  angle: string;
  rationale: string;
  relevance_score: number;
  evidence_urls: string[];
  freshness_signal: FreshnessSignal;
  competitor_gap: boolean;
  status: ProposalStatus;
  written_article_id: string | null;
  decided_at: string | null;
  created_at: string;
};

type FilterKey = "pending" | "approved" | "rejected" | "all";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const FRESHNESS_LABEL: Record<FreshnessSignal, string> = {
  news_30d: "News (30d)",
  trending_search: "Trending search",
  competitor_recent: "Competitor recent",
  seasonal: "Seasonal",
  evergreen_gap: "Evergreen gap",
};

function statusPillClass(status: ProposalStatus): string {
  switch (status) {
    case "approved":
      return "bg-[var(--success-light)] text-[var(--success)]";
    case "rejected":
      return "bg-[var(--error-light)] text-[var(--error)]";
    case "written_in_progress":
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

export default function TopicProposalsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedRationale, setExpandedRationale] = useState<Record<string, boolean>>({});
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [niche, setNiche] = useState<string>("");
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
      const settingsNiche = ((settings as { niche?: string } | null)?.niche ?? "").toString();
      if (!cancelled) {
        setUserNiche(settingsNiche);
        setNiche(settingsNiche);
      }

      const q = supabase
        .from("topic_proposals")
        .select("*")
        .eq("user_id", user.user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      const { data } = await q;
      if (!cancelled && data) setProposals(data as Proposal[]);
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
        .channel(`topic-proposals-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "topic_proposals",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              setProposals((prev) => {
                const next = payload.new as Proposal;
                if (prev.some((p) => p.id === next.id)) return prev;
                return [next, ...prev];
              });
            } else if (payload.eventType === "UPDATE") {
              setProposals((prev) =>
                prev.map((p) =>
                  p.id === (payload.new as Proposal).id ? (payload.new as Proposal) : p,
                ),
              );
            } else if (payload.eventType === "DELETE") {
              setProposals((prev) => prev.filter((p) => p.id !== (payload.old as Proposal).id));
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

  const visible = proposals.filter((p) => (filter === "all" ? true : p.status === filter));

  async function decide(id: string, action: "approved" | "rejected") {
    setBusyId(id);
    const snapshot = proposals;
    const decidedAt = new Date().toISOString();
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: action, decided_at: decidedAt } : p)),
    );
    const { error: updateError } = await supabase
      .from("topic_proposals")
      .update({ status: action, decided_at: decidedAt })
      .eq("id", id);
    if (updateError) {
      setProposals(snapshot);
      setError(updateError.message);
    }
    setBusyId(null);
  }

  async function generate(p: Proposal) {
    setBusyId(p.id);
    setError(null);
    try {
      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "article",
          topic: p.title,
          focusKeyword: p.focus_keyword,
          quality: "standard",
          options: { topicProposalId: p.id },
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        setError(`Failed to dispatch: ${errText}`);
        setBusyId(null);
        return;
      }
      const { runId } = (await resp.json()) as { runId: string };
      // Mark proposal as written_in_progress so it leaves the pending tab
      await supabase
        .from("topic_proposals")
        .update({ status: "written_in_progress", decided_at: new Date().toISOString() })
        .eq("id", p.id);
      router.push(`/app/agent-runs/${runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusyId(null);
    }
  }

  async function discoverTopics() {
    const seed = niche.trim();
    if (!seed) {
      setError("Enter a niche first to discover topics.");
      return;
    }
    setDiscovering(true);
    setError(null);
    try {
      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "topic_research",
          topic: seed,
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
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Topic proposals</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Inbox of topic ideas surfaced by the TopicResearcher agent. Approve, reject, or send
            straight to a write.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={niche}
            placeholder={userNiche ? userNiche : "Niche or seed topic"}
            onChange={(e) => setNiche(e.target.value)}
            className="rounded-md border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
          />
          <button
            type="button"
            onClick={() => void discoverTopics()}
            disabled={discovering}
            className={cn(
              "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white",
              "hover:opacity-90 disabled:opacity-50",
            )}
          >
            {discovering ? "Dispatching..." : "Discover topics"}
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

      <div className="flex items-center gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          const count =
            f.key === "all"
              ? proposals.length
              : proposals.filter((p) => p.status === f.key).length;
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
              <span className="ml-1.5 text-[10px] text-[var(--text-tertiary)]">{count}</span>
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
              ? "No pending proposals. Click \"Discover topics\" to surface fresh ideas."
              : "No proposals match this filter."}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((p) => {
              const score = Math.max(0, Math.min(100, Math.round((p.relevance_score ?? 0) * 100)));
              const rationaleOpen = !!expandedRationale[p.id];
              const evidenceOpen = !!expandedEvidence[p.id];
              const evidenceCount = Array.isArray(p.evidence_urls) ? p.evidence_urls.length : 0;
              const canGenerate = p.status === "approved" || p.status === "pending";
              return (
                <li
                  key={p.id}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-[var(--text-primary)]">
                          {p.title}
                        </h2>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                            statusPillClass(p.status),
                          )}
                        >
                          {p.status.replace(/_/g, " ")}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {p.focus_keyword && (
                          <span className="rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                            {p.focus_keyword}
                          </span>
                        )}
                        {p.niche && (
                          <span className="rounded-full bg-[var(--accent-light)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                            {p.niche}
                          </span>
                        )}
                        {p.freshness_signal && (
                          <span className="rounded-full bg-[var(--warning-light)] px-2 py-0.5 text-[10px] font-medium text-[var(--warning)]">
                            {FRESHNESS_LABEL[p.freshness_signal] ?? p.freshness_signal}
                          </span>
                        )}
                        {p.competitor_gap && (
                          <span className="rounded-full bg-[var(--success-light)] px-2 py-0.5 text-[10px] font-medium text-[var(--success)]">
                            Competitor gap
                          </span>
                        )}
                        <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                          {evidenceCount} evidence URL{evidenceCount === 1 ? "" : "s"}
                        </span>
                      </div>

                      {p.angle && (
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">
                          <span className="font-medium text-[var(--text-primary)]">Angle: </span>
                          {p.angle}
                        </p>
                      )}

                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                          Relevance
                        </span>
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                          <div
                            className="h-full rounded-full bg-[var(--accent)] transition-all"
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-[var(--text-secondary)]">{score}%</span>
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

                      {evidenceCount > 0 && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedEvidence((prev) => ({
                                ...prev,
                                [p.id]: !prev[p.id],
                              }))
                            }
                            className="text-xs font-medium text-[var(--accent)] hover:underline"
                          >
                            {evidenceOpen
                              ? "Hide evidence"
                              : `Show ${evidenceCount} evidence URL${evidenceCount === 1 ? "" : "s"}`}
                          </button>
                          {evidenceOpen && (
                            <ul className="mt-1 space-y-1 rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2">
                              {p.evidence_urls.map((url, i) => (
                                <li key={i}>
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="break-all text-xs text-[var(--accent)] hover:underline"
                                  >
                                    {url}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch gap-2 md:w-auto md:items-end">
                      <button
                        type="button"
                        disabled={busyId === p.id || p.status !== "pending"}
                        onClick={() => void decide(p.id, "approved")}
                        className={cn(
                          "rounded bg-[var(--success)] px-3 py-1.5 text-xs font-medium text-white",
                          "hover:opacity-90 disabled:opacity-40",
                        )}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id || p.status !== "pending"}
                        onClick={() => void decide(p.id, "rejected")}
                        className={cn(
                          "rounded border border-[var(--error)] px-3 py-1.5 text-xs font-medium text-[var(--error)]",
                          "hover:bg-[var(--error-light)] disabled:opacity-40",
                        )}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id || !canGenerate}
                        onClick={() => void generate(p)}
                        className={cn(
                          "rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white",
                          "hover:opacity-90 disabled:opacity-40",
                        )}
                      >
                        {busyId === p.id ? "Working..." : "Generate"}
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
