"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow, parseISO } from "date-fns";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase-browser";

type SubtopicIntent =
  | "informational"
  | "commercial"
  | "transactional"
  | "navigational";

interface PillarOutlineSection {
  level: number;
  heading: string;
  notes: string;
}

interface PillarOutline {
  title: string;
  sections: PillarOutlineSection[];
}

interface StrategyPlanSubtopic {
  title: string;
  keyword: string;
  intent: SubtopicIntent;
  relationToPillar: string;
  estimatedWordCount: number;
}

interface StrategyPlan {
  pillarTopic: string;
  pillarKeyword: string;
  pillarOutline?: PillarOutline | null;
  subtopics: StrategyPlanSubtopic[];
  rationale?: string;
}

interface ClusterRow {
  id: string;
  user_id: string;
  pillar_topic: string;
  pillar_keyword: string | null;
  pillar_article_id: string | null;
  existing_pillar_url: string | null;
  article_target_count: number | null;
  last_planned_at: string | null;
  strategy_plan: StrategyPlan | null;
}

interface ClusterArticle {
  id: string;
  topic: string | null;
  title: string | null;
  lifecycle: string | null;
}

const INTENT_STYLES: Record<SubtopicIntent, string> = {
  informational:
    "bg-[var(--accent-light)] text-[var(--accent)] border-[var(--accent)]/30",
  commercial:
    "bg-[var(--success-light)] text-[var(--success)] border-[var(--success)]/30",
  transactional:
    "bg-[var(--success-light)] text-[var(--success)] border-[var(--success)]/30",
  navigational:
    "bg-[var(--surface-sunken)] text-[var(--text-secondary)] border-[var(--border-default)]",
};

function isStrategyPlan(value: unknown): value is StrategyPlan {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.pillarTopic !== "string") return false;
  if (typeof v.pillarKeyword !== "string") return false;
  if (!Array.isArray(v.subtopics)) return false;
  return true;
}

function IntentPill({ intent }: { intent: SubtopicIntent }) {
  const cls = INTENT_STYLES[intent] ?? INTENT_STYLES.informational;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}
    >
      {intent}
    </span>
  );
}

export default function ClusterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [cluster, setCluster] = useState<ClusterRow | null>(null);
  const [articles, setArticles] = useState<ClusterArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPillar, setGeneratingPillar] = useState(false);
  const [generatingIdx, setGeneratingIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/");
      return;
    }
    const { data: clusterRow, error: clusterErr } = await supabase
      .from("clusters")
      .select(
        "id, user_id, pillar_topic, pillar_keyword, pillar_article_id, existing_pillar_url, article_target_count, last_planned_at, strategy_plan"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (clusterErr) {
      setError(clusterErr.message);
      setLoading(false);
      return;
    }
    if (!clusterRow) {
      setError("Cluster not found");
      setLoading(false);
      return;
    }
    const row = clusterRow as ClusterRow;
    setCluster(row);

    const { data: articleRows } = await supabase
      .from("articles")
      .select("id, topic, title, lifecycle")
      .eq("user_id", user.id)
      .eq("cluster_id", id);
    setArticles((articleRows ?? []) as ClusterArticle[]);
    setLoading(false);
  }, [id, router, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const generatePillar = useCallback(async () => {
    if (!cluster || !cluster.strategy_plan) return;
    setGeneratingPillar(true);
    try {
      const plan = cluster.strategy_plan;
      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "article",
          topic: plan.pillarTopic,
          focusKeyword: plan.pillarKeyword,
          options: { clusterId: cluster.id, isPillar: true },
        }),
      });
      if (!resp.ok) {
        const payload = (await resp.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? `Request failed (${resp.status})`);
      }
      const out = (await resp.json()) as { runId?: string };
      toast.success("Pillar generation dispatched");
      // Note: the article id is created later by the run. We only patch the
      // cluster row when we actually have an articleId — for now skip optimistic.
      if (out.runId) {
        router.push(`/app/agent-runs/${out.runId}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to dispatch";
      toast.error(message);
    } finally {
      setGeneratingPillar(false);
    }
  }, [cluster, router]);

  const generateSubtopic = useCallback(
    async (subtopic: StrategyPlanSubtopic, idx: number) => {
      if (!cluster) return;
      setGeneratingIdx(idx);
      try {
        const resp = await fetch("/api/agent/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "article",
            topic: subtopic.title,
            focusKeyword: subtopic.keyword,
            options: { clusterId: cluster.id, subtopicIdx: idx },
          }),
        });
        if (!resp.ok) {
          const payload = (await resp.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error ?? `Request failed (${resp.status})`);
        }
        const out = (await resp.json()) as { runId?: string };
        toast.success("Generation dispatched");
        if (out.runId) {
          router.push(`/app/agent-runs/${out.runId}`);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to dispatch";
        toast.error(message);
      } finally {
        setGeneratingIdx(null);
      }
    },
    [cluster, router]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Cluster" description="Loading cluster details…" />
        <div className="bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-xl p-6">
          <div className="h-4 w-1/3 rounded bg-[var(--surface-sunken)] animate-pulse" />
          <div className="mt-3 h-3 w-1/4 rounded bg-[var(--surface-sunken)] animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !cluster) {
    return (
      <div className="space-y-6">
        <PageHeader title="Cluster" />
        <div className="bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-xl p-6 text-sm text-[var(--text-secondary)]">
          {error ?? "Cluster not found."}
          <div className="mt-4">
            <Link
              href="/app/clusters"
              className="text-[var(--accent)] hover:underline"
            >
              ← Back to clusters
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const plan: StrategyPlan | null = isStrategyPlan(cluster.strategy_plan)
    ? cluster.strategy_plan
    : null;

  const subtopics: StrategyPlanSubtopic[] = plan?.subtopics ?? [];

  // Best-effort match: a generated article exists when topic matches subtopic title.
  const articlesByTopic = new Map<string, ClusterArticle>();
  for (const a of articles) {
    if (a.topic) articlesByTopic.set(a.topic.trim().toLowerCase(), a);
    if (a.title) articlesByTopic.set(a.title.trim().toLowerCase(), a);
  }

  const lastPlannedRel = cluster.last_planned_at
    ? formatDistanceToNow(parseISO(cluster.last_planned_at), { addSuffix: true })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={cluster.pillar_topic}
        description={
          cluster.pillar_keyword
            ? `Pillar keyword: ${cluster.pillar_keyword}`
            : "No pillar keyword set"
        }
        actions={
          <Link
            href={`/app/articles?cluster=${cluster.id}`}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] transition-colors"
          >
            View articles →
          </Link>
        }
      />

      {/* Header meta strip */}
      <div className="bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-xl p-4 flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
        {cluster.article_target_count !== null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-sunken)] border border-[var(--border-default)] px-2.5 py-0.5">
            Target: {cluster.article_target_count} articles
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-sunken)] border border-[var(--border-default)] px-2.5 py-0.5">
          {articles.length} generated
        </span>
        {lastPlannedRel && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-sunken)] border border-[var(--border-default)] px-2.5 py-0.5">
            Last planned {lastPlannedRel}
          </span>
        )}
        {cluster.existing_pillar_url && (
          <a
            href={cluster.existing_pillar_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-sunken)] border border-[var(--border-default)] px-2.5 py-0.5 hover:text-[var(--accent)] transition-colors"
          >
            Existing pillar URL
          </a>
        )}
      </div>

      {/* Pillar section */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          Pillar article
        </h2>
        <div className="bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[var(--text-primary)]">
                {plan?.pillarTopic ?? cluster.pillar_topic}
              </p>
              {plan?.pillarKeyword && (
                <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                  {plan.pillarKeyword}
                </p>
              )}
              {plan?.rationale && (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {plan.rationale}
                </p>
              )}
            </div>
            {cluster.pillar_article_id ? (
              <Link
                href={`/app/publish/${cluster.pillar_article_id}`}
                className="shrink-0 rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] transition-colors"
              >
                View pillar →
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => void generatePillar()}
                disabled={generatingPillar || !plan}
                className="shrink-0 inline-flex items-center rounded-md border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingPillar ? "Dispatching…" : "Generate pillar"}
              </button>
            )}
          </div>

          {/* Pillar outline preview */}
          {plan?.pillarOutline?.sections && plan.pillarOutline.sections.length > 0 && (
            <details className="mt-4 group">
              <summary className="cursor-pointer text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                Pillar outline ({plan.pillarOutline.sections.length} sections)
              </summary>
              <ul className="mt-3 space-y-1 pl-3 border-l border-[var(--border-default)]">
                {plan.pillarOutline.sections.map((section, sidx) => (
                  <li
                    key={`section-${sidx}`}
                    className="text-sm"
                    style={{ paddingLeft: `${Math.max(0, section.level - 1) * 12}px` }}
                  >
                    <p className="font-medium text-[var(--text-primary)]">
                      {section.heading}
                    </p>
                    {section.notes && (
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {section.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </section>

      {/* Subtopics */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          Subtopics ({subtopics.length})
        </h2>
        {subtopics.length === 0 ? (
          <div className="bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-xl p-6 text-sm text-[var(--text-secondary)]">
            No subtopics planned yet. Re-run the strategist agent to generate a plan.
          </div>
        ) : (
          <div className="bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--surface-sunken)]">
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                    Title
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)] hidden md:table-cell">
                    Keyword
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)] hidden sm:table-cell">
                    Intent
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)] hidden lg:table-cell">
                    Words
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {subtopics.map((subtopic, idx) => {
                  const matchTitle = subtopic.title.trim().toLowerCase();
                  const matchedArticle = articlesByTopic.get(matchTitle);
                  const busy = generatingIdx === idx;
                  return (
                    <tr
                      key={`subtopic-${idx}`}
                      className="hover:bg-[var(--surface-sunken)] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--text-primary)]">
                          {subtopic.title}
                        </p>
                        {subtopic.relationToPillar && (
                          <p className="mt-0.5 text-xs text-[var(--text-tertiary)] line-clamp-1">
                            {subtopic.relationToPillar}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <span className="text-xs text-[var(--text-secondary)]">
                          {subtopic.keyword}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell">
                        <IntentPill intent={subtopic.intent} />
                      </td>
                      <td className="px-3 py-3 text-center hidden lg:table-cell">
                        <span className="text-xs text-[var(--text-tertiary)]">
                          {subtopic.estimatedWordCount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {matchedArticle ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="rounded-full bg-[var(--success-light)] text-[var(--success)] border border-[var(--success)]/30 px-2 py-0.5 text-[10px] font-semibold">
                              Generated
                            </span>
                            <Link
                              href={`/app/publish/${matchedArticle.id}`}
                              className="rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] transition-colors"
                            >
                              View
                            </Link>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void generateSubtopic(subtopic, idx)}
                            disabled={busy}
                            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {busy ? "Dispatching…" : "Generate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
