"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { format, parseISO, formatDistanceToNow } from "date-fns";

interface StrategyPlanSubtopic {
  title?: string;
  keyword?: string;
  intent?: string;
  relationToPillar?: string;
  estimatedWordCount?: number;
}

interface StrategyPlan {
  subtopics?: StrategyPlanSubtopic[];
  [key: string]: unknown;
}

interface Cluster {
  id: string;
  pillar_topic: string;
  pillar_keyword: string | null;
  quality: string;
  pillar_article_id: string | null;
  existing_pillar_url: string | null;
  created_at: string;
  last_planned_at: string | null;
  strategy_plan: StrategyPlan | null;
  article_count: number;
}

const QUALITY_CONFIG: Record<string, { label: string; className: string }> = {
  premium: {
    label: "Premium",
    className:
      "bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent)]/20",
  },
  standard: {
    label: "Standard",
    className:
      "bg-[var(--surface-sunken)] text-[var(--text-secondary)] border border-[var(--border-default)]",
  },
  basic: {
    label: "Basic",
    className:
      "bg-[var(--surface-sunken)] text-[var(--text-tertiary)] border border-[var(--border-default)]",
  },
};

function SkeletonCard() {
  return (
    <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-5 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-[var(--surface-sunken)]" />
          <div className="h-3 w-1/3 rounded bg-[var(--surface-sunken)]" />
        </div>
        <div className="h-6 w-16 rounded-full bg-[var(--surface-sunken)]" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-20 rounded-full bg-[var(--surface-sunken)]" />
        <div className="h-5 w-14 rounded-full bg-[var(--surface-sunken)]" />
      </div>
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-sunken)]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 text-[var(--text-tertiary)]"
        >
          <path d="M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          <path d="M8 6V4M16 6V4M2 10h20" />
        </svg>
      </div>
      <p className="text-sm font-medium text-[var(--text-primary)]">
        {filtered ? "No matching clusters" : "No topic clusters yet"}
      </p>
      <p className="mt-1 text-sm text-[var(--text-tertiary)]">
        {filtered
          ? "Try a different search term."
          : "Build content clusters to dominate your niche."}
      </p>
      {!filtered && (
        <Link
          href="/app/generate"
          className="mt-5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          Create Cluster
        </Link>
      )}
    </div>
  );
}

export default function ClustersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // "Plan with Agent" inline form state
  const [planOpen, setPlanOpen] = useState(false);
  const [planTopic, setPlanTopic] = useState("");
  const [planKeyword, setPlanKeyword] = useState("");
  const [planTone, setPlanTone] = useState("");
  const [planSubmitting, setPlanSubmitting] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  async function submitPlan(e: React.FormEvent) {
    e.preventDefault();
    const pillarTopic = planTopic.trim();
    const pillarKeyword = planKeyword.trim();
    if (!pillarTopic || !pillarKeyword) {
      setPlanError("Pillar topic and pillar keyword are required.");
      return;
    }
    setPlanSubmitting(true);
    setPlanError(null);
    try {
      const body: {
        kind: "cluster_plan";
        topic: string;
        focusKeyword: string;
        clusterPillarTopic: string;
        tone?: string;
        quality: "standard";
      } = {
        kind: "cluster_plan",
        topic: pillarTopic,
        focusKeyword: pillarKeyword,
        clusterPillarTopic: pillarTopic,
        quality: "standard",
      };
      const tone = planTone.trim();
      if (tone) body.tone = tone;

      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: { runId?: string; error?: string } = await resp.json();
      if (!resp.ok || !data.runId) {
        setPlanError(data.error || `request failed (${resp.status})`);
        return;
      }
      router.push(`/app/agent-runs/${data.runId}`);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : String(err));
    } finally {
      setPlanSubmitting(false);
    }
  }

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }

      // Fetch clusters
      const { data: clusterRows } = await supabase
        .from("clusters")
        .select(
          "id, pillar_topic, pillar_keyword, quality, pillar_article_id, existing_pillar_url, created_at, last_planned_at, strategy_plan"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!clusterRows) {
        setLoading(false);
        return;
      }

      // Fetch article counts per cluster in one query
      const clusterIds = clusterRows.map((c) => c.id);
      const countMap: Record<string, number> = {};

      if (clusterIds.length > 0) {
        const { data: articleRows } = await supabase
          .from("articles")
          .select("cluster_id")
          .eq("user_id", user.id)
          .in("cluster_id", clusterIds);

        if (articleRows) {
          for (const row of articleRows) {
            if (row.cluster_id) {
              countMap[row.cluster_id] = (countMap[row.cluster_id] ?? 0) + 1;
            }
          }
        }
      }

      setClusters(
        clusterRows.map((c) => ({
          ...c,
          last_planned_at: (c as { last_planned_at?: string | null })
            .last_planned_at ?? null,
          strategy_plan:
            ((c as { strategy_plan?: StrategyPlan | null }).strategy_plan) ??
            null,
          article_count: countMap[c.id] ?? 0,
        }))
      );
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = clusters.filter(
    (c) =>
      !search ||
      c.pillar_topic.toLowerCase().includes(search.toLowerCase()) ||
      (c.pillar_keyword ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Topic Clusters
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {clusters.length} cluster{clusters.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlanOpen((v) => !v)}
            aria-expanded={planOpen}
            className="rounded-lg border border-[var(--accent)]/40 bg-[var(--surface-base)] px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors"
          >
            Plan with Agent
          </button>
          <Link
            href="/app/generate"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            + New Cluster
          </Link>
        </div>
      </div>

      {/* Plan with Agent inline form */}
      {planOpen && (
        <form
          onSubmit={submitPlan}
          className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Plan a new cluster with the strategist agent
            </p>
            <button
              type="button"
              onClick={() => setPlanOpen(false)}
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              aria-label="Close planner"
            >
              Close
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)]">
                Pillar topic
              </label>
              <input
                value={planTopic}
                onChange={(e) => setPlanTopic(e.target.value)}
                required
                placeholder="e.g. Headless commerce"
                className="mt-1 w-full rounded border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)]">
                Pillar keyword
              </label>
              <input
                value={planKeyword}
                onChange={(e) => setPlanKeyword(e.target.value)}
                required
                placeholder="e.g. headless ecommerce platform"
                className="mt-1 w-full rounded border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)]">
              Tone (optional)
            </label>
            <input
              value={planTone}
              onChange={(e) => setPlanTone(e.target.value)}
              placeholder="e.g. authoritative"
              className="mt-1 w-full rounded border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            />
          </div>
          {planError && (
            <p className="text-xs text-[var(--error)]">{planError}</p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={
                planSubmitting || !planTopic.trim() || !planKeyword.trim()
              }
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {planSubmitting ? "Dispatching..." : "Plan cluster"}
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      <div className="relative">
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]"
        >
          <path
            fillRule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
            clipRule="evenodd"
          />
        </svg>
        <input
          type="text"
          placeholder="Search clusters…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filtered={search.length > 0} />
      ) : (
        <div className="space-y-3">
          {filtered.map((cluster) => {
            const quality =
              QUALITY_CONFIG[cluster.quality] ?? QUALITY_CONFIG.standard;
            return (
              <div
                key={cluster.id}
                className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-5 hover:border-[var(--accent)]/40 transition-colors"
              >
                {/* Card top row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[var(--text-primary)] truncate">
                      {cluster.pillar_topic}
                    </p>
                    {cluster.existing_pillar_url && (
                      <a
                        href={cluster.existing_pillar_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--accent)] truncate block transition-colors"
                      >
                        {cluster.existing_pillar_url}
                      </a>
                    )}
                  </div>
                  {/* Quality pill */}
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${quality.className}`}
                  >
                    {quality.label}
                  </span>
                </div>

                {/* Card meta row */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {/* Keyword pill */}
                  {cluster.pillar_keyword && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-sunken)] border border-[var(--border-default)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]">
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-3 w-3 text-[var(--text-tertiary)]"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9.243 3.03a1 1 0 01.727 1.213L9.53 6h2.94l.56-2.243a1 1 0 111.94.486L14.53 6H17a1 1 0 110 2h-2.97l-.8 3.2H15a1 1 0 110 2h-2.2l-.56 2.243a1 1 0 11-1.94-.486L10.73 13H7.79l-.56 2.243a1 1 0 11-1.94-.486L5.73 13H3a1 1 0 110-2h3.2l.8-3.2H5a1 1 0 010-2h2.4l.56-2.243a1 1 0 011.283-.727zM9.03 8l-.8 3.2h2.94l.8-3.2H9.03z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {cluster.pillar_keyword}
                    </span>
                  )}

                  {/* Article count pill */}
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-sunken)] border border-[var(--border-default)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]">
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3 w-3 text-[var(--text-tertiary)]"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {cluster.article_count}{" "}
                    {cluster.article_count === 1 ? "article" : "articles"}
                  </span>

                  {/* Subtopic count badge */}
                  {cluster.strategy_plan?.subtopics &&
                    cluster.strategy_plan.subtopics.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-light)] border border-[var(--accent)]/20 px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
                        {cluster.strategy_plan.subtopics.length} subtopic
                        {cluster.strategy_plan.subtopics.length === 1
                          ? ""
                          : "s"}
                      </span>
                    )}

                  {/* Date pill */}
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-sunken)] border border-[var(--border-default)] px-2.5 py-0.5 text-xs text-[var(--text-tertiary)]">
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3 w-3"
                    >
                      <path
                        fillRule="evenodd"
                        d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {format(parseISO(cluster.created_at), "MMM d, yyyy")}
                  </span>

                  {/* Last planned pill */}
                  {cluster.last_planned_at && (
                    <span
                      title={format(
                        parseISO(cluster.last_planned_at),
                        "PPpp"
                      )}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-sunken)] border border-[var(--border-default)] px-2.5 py-0.5 text-xs text-[var(--text-tertiary)]"
                    >
                      Last planned{" "}
                      {formatDistanceToNow(parseISO(cluster.last_planned_at), {
                        addSuffix: true,
                      })}
                    </span>
                  )}

                  {/* Action link — pushed to right */}
                  <Link
                    href={`/app/articles?cluster=${cluster.id}`}
                    className="ml-auto rounded-lg border border-[var(--border-default)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    View Articles →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
