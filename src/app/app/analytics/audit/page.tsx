"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { toast } from "sonner";
import type { ArticleAuditItem } from "@/app/api/audit/route";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase-browser";

type AuditRecommendationRow = {
  kind: string;
  reason: string;
  priority?: "low" | "medium" | "high";
  details?: Record<string, unknown>;
};

type RecentAuditRow = {
  id: string;
  article_id: string;
  overall_score: number | null;
  recommendations: AuditRecommendationRow[];
  decided_action: string | null;
  created_at: string;
};

type SchemaRecommendationRow = {
  kind: string;
  reason: string;
  priority?: "low" | "medium" | "high";
};

type SchemaValidationStatus = "valid" | "warnings" | "invalid" | "pending";

type SchemaDiagnosisRow = {
  id: string;
  article_id: string;
  current_schema: Record<string, unknown> | null;
  recommended_schema: Record<string, unknown> | null;
  recommendations: SchemaRecommendationRow[];
  validation_status: SchemaValidationStatus;
  validation_errors: string[];
  status: string | null;
  created_at: string;
  articles?: { title: string | null } | null;
};

type DecidedAction = "refresh" | "rewrite" | "archive" | "ignore" | "pending" | "applied";

type ArticleLite = {
  id: string;
  title: string | null;
  topic: string | null;
  focus_keyword: string | null;
};

const AUTO_ACTION_LABEL: Record<string, string> = {
  refresh: "Apply refresh",
  rewrite: "Apply rewrite",
  archive: "Archive article",
};

function applyButtonLabel(kind: string): string {
  return AUTO_ACTION_LABEL[kind] ?? "Mark applied";
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : score >= 40
        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
        : "bg-red-50 text-red-600 border-red-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${color}`}>
      {score}/100
    </span>
  );
}

function HealthDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
  );
}

function AgentScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-xs text-[var(--text-tertiary)]">—</span>;
  }
  const pct = Math.round(score * 100);
  const color =
    pct >= 70
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : pct >= 40
        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
        : "bg-red-50 text-red-600 border-red-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${color}`}>
      {pct}/100
    </span>
  );
}

function PriorityPill({ priority }: { priority?: "low" | "medium" | "high" }) {
  const color =
    priority === "high"
      ? "bg-red-50 text-red-700 border-red-200"
      : priority === "medium"
        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
        : "bg-[var(--surface-sunken)] text-[var(--text-secondary)] border-[var(--border-default)]";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${color}`}>
      {priority ?? "low"}
    </span>
  );
}

function ValidationPill({ status }: { status: SchemaValidationStatus }) {
  const color =
    status === "valid"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "warnings"
        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
        : status === "invalid"
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-[var(--surface-sunken)] text-[var(--text-secondary)] border-[var(--border-default)]";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${color}`}
    >
      {status}
    </span>
  );
}

export default function ContentAuditPage() {
  const router = useRouter();
  const [items, setItems] = useState<ArticleAuditItem[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    published: number;
    needsRefresh: number;
    thin: number;
    noImages: number;
    avgScore: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "refresh" | "thin" | "no-images">("all");
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatchOk, setDispatchOk] = useState<string | null>(null);

  const [recentAudits, setRecentAudits] = useState<RecentAuditRow[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [applyingKey, setApplyingKey] = useState<string | null>(null);

  const [schemaDiagnoses, setSchemaDiagnoses] = useState<SchemaDiagnosisRow[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [expandedSchemaId, setExpandedSchemaId] = useState<string | null>(null);
  const [applyingSchemaId, setApplyingSchemaId] = useState<string | null>(null);
  const [schemaCheckingId, setSchemaCheckingId] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const loadRecentAudits = useCallback(async () => {
    setRecentLoading(true);
    const { data, error } = await supabase
      .from("article_audits")
      .select("id, article_id, overall_score, recommendations, decided_action, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && data) {
      setRecentAudits(data as unknown as RecentAuditRow[]);
    }
    setRecentLoading(false);
  }, [supabase]);

  const loadSchemaDiagnoses = useCallback(async () => {
    setSchemaLoading(true);
    const { data, error } = await supabase
      .from("schema_diagnoses")
      .select(
        "id, article_id, current_schema, recommended_schema, recommendations, validation_status, validation_errors, status, created_at, articles(title)"
      )
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && data) {
      setSchemaDiagnoses(data as unknown as SchemaDiagnosisRow[]);
    }
    setSchemaLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetch("/api/audit")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setSummary(d.summary ?? null);
      })
      .finally(() => setLoading(false));
    void loadRecentAudits();
    void loadSchemaDiagnoses();
  }, [loadRecentAudits, loadSchemaDiagnoses]);

  const filtered = items.filter((i) => {
    if (filter === "refresh") return i.needsRefresh;
    if (filter === "thin") return i.wordCountHealth === "thin";
    if (filter === "no-images") return !i.hasImages;
    return true;
  });

  const updateDecidedAction = useCallback(
    async (auditId: string, decided: DecidedAction): Promise<boolean> => {
      const { error } = await supabase
        .from("article_audits")
        .update({ decided_action: decided })
        .eq("id", auditId);
      if (error) {
        toast.error(`Failed to update audit: ${error.message}`);
        return false;
      }
      setRecentAudits((prev) =>
        prev.map((row) => (row.id === auditId ? { ...row, decided_action: decided } : row))
      );
      return true;
    },
    [supabase]
  );

  const fetchArticleLite = useCallback(
    async (articleId: string): Promise<ArticleLite | null> => {
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, topic, focus_keyword")
        .eq("id", articleId)
        .maybeSingle();
      if (error || !data) return null;
      return data as ArticleLite;
    },
    [supabase]
  );

  const applyRecommendation = useCallback(
    async (audit: RecentAuditRow, rec: AuditRecommendationRow, idx: number) => {
      const key = `${audit.id}-${idx}`;
      setApplyingKey(key);
      try {
        if (rec.kind === "refresh") {
          const resp = await fetch("/api/articles/refresh", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              articleId: audit.article_id,
              auditId: audit.id,
              recommendationKind: "refresh",
            }),
          });
          if (!resp.ok) {
            const payload = (await resp.json().catch(() => ({}))) as { error?: string };
            throw new Error(payload.error ?? `Refresh failed (${resp.status})`);
          }
          toast.success("Refresh dispatched");
          await updateDecidedAction(audit.id, "refresh");
          return;
        }

        if (rec.kind === "rewrite") {
          const article = await fetchArticleLite(audit.article_id);
          if (!article) {
            throw new Error("Article not found");
          }
          const topic = article.title?.trim() || article.topic?.trim() || "";
          if (!topic) {
            throw new Error("Article has no title or topic to use");
          }
          const resp = await fetch("/api/agent/generate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              kind: "article",
              topic,
              focusKeyword: article.focus_keyword ?? undefined,
              options: { auditId: audit.id, source: "audit_rewrite" },
            }),
          });
          if (!resp.ok) {
            const payload = (await resp.json().catch(() => ({}))) as { error?: string };
            throw new Error(payload.error ?? `Rewrite failed (${resp.status})`);
          }
          const out = (await resp.json()) as { runId?: string };
          await updateDecidedAction(audit.id, "rewrite");
          toast.success("Rewrite dispatched");
          if (out.runId) {
            router.push(`/app/agent-runs/${out.runId}`);
          }
          return;
        }

        if (rec.kind === "archive") {
          const ok = window.confirm(
            "Archive this article? It will be hidden from the active list but can be restored later."
          );
          if (!ok) return;
          const { error: archiveErr } = await supabase
            .from("articles")
            .update({ lifecycle: "archived" })
            .eq("id", audit.article_id);
          if (archiveErr) {
            throw new Error(archiveErr.message);
          }
          await updateDecidedAction(audit.id, "archive");
          toast.success("Article archived");
          return;
        }

        // add_schema, fix_internal_links, improve_alt_text, merge_cannibal, etc.
        const ok = await updateDecidedAction(audit.id, "applied");
        if (ok) toast.success("Marked as applied");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to apply";
        toast.error(message);
      } finally {
        setApplyingKey(null);
      }
    },
    [fetchArticleLite, router, supabase, updateDecidedAction]
  );

  const dispatchAudit = useCallback(
    async (item: ArticleAuditItem) => {
      setDispatchError(null);
      setDispatchOk(null);
      setDispatchingId(item.id);
      try {
        const resp = await fetch("/api/agent/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "audit",
            topic: item.title,
            focusKeyword: item.focusKeyword || undefined,
            articleIds: [item.id],
            quality: "standard",
          }),
        });
        if (!resp.ok) {
          const payload = (await resp.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? `Request failed (${resp.status})`);
        }
        const out = (await resp.json()) as { runId?: string };
        setDispatchOk(out.runId ? `Audit queued (run ${out.runId.slice(0, 8)}…)` : "Audit queued");
      } catch (err) {
        setDispatchError(err instanceof Error ? err.message : "Failed to dispatch audit");
      } finally {
        setDispatchingId(null);
      }
    },
    []
  );

  const dispatchSchemaCheck = useCallback(
    async (item: ArticleAuditItem) => {
      setDispatchError(null);
      setDispatchOk(null);
      setSchemaCheckingId(item.id);
      try {
        const topic = item.title || item.focusKeyword || "";
        const resp = await fetch("/api/agent/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "schema_doctor",
            articleId: item.id,
            topic,
            focusKeyword: item.focusKeyword || undefined,
          }),
        });
        if (!resp.ok) {
          const payload = (await resp.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? `Request failed (${resp.status})`);
        }
        const out = (await resp.json()) as { runId?: string };
        if (out.runId) {
          router.push(`/app/agent-runs/${out.runId}`);
        } else {
          setDispatchOk("Schema check queued");
        }
      } catch (err) {
        setDispatchError(
          err instanceof Error ? err.message : "Failed to dispatch schema check"
        );
      } finally {
        setSchemaCheckingId(null);
      }
    },
    [router]
  );

  const applySchemaDiagnosis = useCallback(
    async (row: SchemaDiagnosisRow) => {
      if (!row.recommended_schema) {
        toast.error("No recommended schema to apply");
        return;
      }
      setApplyingSchemaId(row.id);
      try {
        const stringified = JSON.stringify(row.recommended_schema, null, 2);
        const { error: patchErr } = await supabase
          .from("articles")
          .update({ schema_json: stringified })
          .eq("id", row.article_id);
        if (patchErr) {
          throw new Error(patchErr.message);
        }
        const { error: statusErr } = await supabase
          .from("schema_diagnoses")
          .update({ status: "applied", decided_at: new Date().toISOString() })
          .eq("id", row.id);
        if (statusErr) {
          throw new Error(statusErr.message);
        }
        setSchemaDiagnoses((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, status: "applied" } : r))
        );
        toast.success("Schema applied to article");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to apply schema";
        toast.error(message);
      } finally {
        setApplyingSchemaId(null);
      }
    },
    [supabase]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Content Audit" description="Health check across all your articles" />

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Articles", value: summary.total, colorClass: "text-[var(--text-primary)]" },
            { label: "Published", value: summary.published, colorClass: "text-emerald-600" },
            {
              label: "Avg Score",
              value: `${summary.avgScore}/100`,
              colorClass: summary.avgScore >= 70 ? "text-emerald-600" : "text-yellow-600",
            },
            {
              label: "Needs Refresh",
              value: summary.needsRefresh,
              colorClass: summary.needsRefresh > 0 ? "text-orange-600" : "text-[var(--text-secondary)]",
            },
            {
              label: "Thin Content",
              value: summary.thin,
              colorClass: summary.thin > 0 ? "text-red-600" : "text-[var(--text-secondary)]",
            },
            {
              label: "No Images",
              value: summary.noImages,
              colorClass: summary.noImages > 0 ? "text-red-600" : "text-[var(--text-secondary)]",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-5"
            >
              <p className={`text-xl font-bold ${stat.colorClass}`}>{stat.value}</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(
          [
            ["all", "All"],
            ["refresh", "Needs Refresh"],
            ["thin", "Thin Content"],
            ["no-images", "No Images"],
          ] as const
        ).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filter === val
                ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                : "bg-[var(--surface-base)] text-[var(--text-secondary)] border-[var(--border-default)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {(dispatchError || dispatchOk) && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            dispatchError
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"
          }`}
        >
          {dispatchError ?? dispatchOk}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-[var(--text-secondary)]">Auditing your content…</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No articles to audit"
          description="Generate articles first and they'll appear here for SEO health analysis."
          action={{ label: "Write First Article", href: "/app/generate" }}
        />
      ) : (
        <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--surface-raised)]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                  Article
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                  Score
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                  Words
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide hidden sm:table-cell">
                  Images
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide hidden sm:table-cell">
                  FAQ
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide hidden md:table-cell">
                  Age
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                  Status
                </th>
                <th className="text-right px-3 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                  Action
                </th>
                <th className="text-right px-3 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                  Schema check
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-[var(--text-secondary)]">
                    No articles match this filter
                  </td>
                </tr>
              )}
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-[var(--surface-sunken)] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--text-primary)] truncate max-w-[260px]">{item.title}</p>
                    {item.focusKeyword && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{item.focusKeyword}</p>
                    )}
                    {item.needsRefresh && (
                      <span className="inline-block mt-1 text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                        ↻ Needs refresh
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <ScoreBadge score={item.score} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`text-xs font-medium ${item.wordCountHealth === "good" ? "text-emerald-600" : "text-red-500"}`}
                    >
                      {item.wordCount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center hidden sm:table-cell">
                    <HealthDot ok={item.hasImages} />
                  </td>
                  <td className="px-3 py-3 text-center hidden sm:table-cell">
                    <HealthDot ok={item.hasFaq} />
                  </td>
                  <td className="px-3 py-3 text-center hidden md:table-cell">
                    <span className="text-xs text-[var(--text-tertiary)]">{item.ageInDays}d ago</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.isPublished
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]"
                      }`}
                    >
                      {item.isPublished ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void dispatchAudit(item)}
                      disabled={dispatchingId === item.id}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {dispatchingId === item.id ? "Queuing…" : "Run audit (Agent)"}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void dispatchSchemaCheck(item)}
                      disabled={schemaCheckingId === item.id}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {schemaCheckingId === item.id ? "Queuing…" : "Schema check"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent audits */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recent audits</h2>
          <button
            type="button"
            onClick={() => void loadRecentAudits()}
            className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Refresh
          </button>
        </div>
        {recentLoading ? (
          <div className="text-center py-8 text-[var(--text-secondary)] text-sm">Loading audits…</div>
        ) : recentAudits.length === 0 ? (
          <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-6 text-sm text-[var(--text-secondary)]">
            No agent audits yet. Click “Run audit (Agent)” next to an article above to generate one.
          </div>
        ) : (
          <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--surface-raised)]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                    Article
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                    Score
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                    Recs
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                    Action
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {recentAudits.map((audit) => {
                  const expanded = expandedAuditId === audit.id;
                  const recs = Array.isArray(audit.recommendations) ? audit.recommendations : [];
                  return (
                    <React.Fragment key={audit.id}>
                      <tr
                        className="hover:bg-[var(--surface-sunken)] transition-colors cursor-pointer"
                        onClick={() => setExpandedAuditId(expanded ? null : audit.id)}
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/app/articles/${audit.article_id}`}
                            onClick={(e: MouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
                            className="font-mono text-xs text-[var(--accent)] hover:underline"
                          >
                            {audit.article_id.slice(0, 8)}…
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <AgentScoreBadge score={audit.overall_score} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-xs font-medium text-[var(--text-primary)]">{recs.length}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[var(--text-secondary)]">
                            {audit.decided_action ?? "pending"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-xs text-[var(--text-tertiary)]">
                          {new Date(audit.created_at).toLocaleString()}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-[var(--surface-sunken)]">
                          <td colSpan={5} className="px-4 py-3">
                            {recs.length === 0 ? (
                              <p className="text-sm text-[var(--text-secondary)]">
                                No recommendations — article looks healthy.
                              </p>
                            ) : (
                              <ul className="space-y-2">
                                {recs.map((rec, idx) => {
                                  const key = `${audit.id}-${idx}`;
                                  const busy = applyingKey === key;
                                  const alreadyApplied =
                                    audit.decided_action !== null &&
                                    audit.decided_action !== "pending";
                                  return (
                                    <li
                                      key={`${audit.id}-rec-${idx}`}
                                      className="flex items-start gap-2 text-sm"
                                    >
                                      <PriorityPill priority={rec.priority} />
                                      <div className="flex-1">
                                        <p className="font-semibold text-[var(--text-primary)]">{rec.kind}</p>
                                        <p className="text-[var(--text-secondary)]">{rec.reason}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={(e: MouseEvent<HTMLButtonElement>) => {
                                          e.stopPropagation();
                                          void applyRecommendation(audit, rec, idx);
                                        }}
                                        disabled={busy || alreadyApplied}
                                        className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {busy ? "Applying…" : applyButtonLabel(rec.kind)}
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Schema diagnoses */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Schema diagnoses</h2>
          <button
            type="button"
            onClick={() => void loadSchemaDiagnoses()}
            className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Refresh
          </button>
        </div>
        {schemaLoading ? (
          <div className="text-center py-8 text-[var(--text-secondary)] text-sm">
            Loading schema diagnoses…
          </div>
        ) : schemaDiagnoses.length === 0 ? (
          <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-6 text-sm text-[var(--text-secondary)]">
            No schema diagnoses yet. Click &ldquo;Schema check&rdquo; next to an article above
            to generate one.
          </div>
        ) : (
          <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--surface-raised)]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                    Article
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                    Validation
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                    Recs
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                    Action
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {schemaDiagnoses.map((row) => {
                  const expanded = expandedSchemaId === row.id;
                  const recs = Array.isArray(row.recommendations) ? row.recommendations : [];
                  const articleTitle =
                    row.articles?.title?.trim() || `${row.article_id.slice(0, 8)}…`;
                  const status = row.status ?? "pending";
                  const alreadyApplied = status !== "pending";
                  const busy = applyingSchemaId === row.id;
                  const currentStr = JSON.stringify(row.current_schema ?? {}, null, 2);
                  const recommendedStr = JSON.stringify(row.recommended_schema ?? {}, null, 2);
                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        className="hover:bg-[var(--surface-sunken)] transition-colors cursor-pointer"
                        onClick={() => setExpandedSchemaId(expanded ? null : row.id)}
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/app/articles/${row.article_id}`}
                            onClick={(e: MouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
                            className="text-[var(--accent)] hover:underline font-medium"
                          >
                            {articleTitle}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <ValidationPill status={row.validation_status} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-xs font-medium text-[var(--text-primary)]">
                            {recs.length}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[var(--text-secondary)]">
                            {status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-xs text-[var(--text-tertiary)]">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-[var(--surface-sunken)]">
                          <td colSpan={5} className="px-4 py-3 space-y-3">
                            {row.validation_errors && row.validation_errors.length > 0 && (
                              <div className="text-xs text-red-700">
                                <p className="font-semibold mb-1">Validation errors</p>
                                <ul className="list-disc pl-5 space-y-0.5">
                                  {row.validation_errors.map((err, i) => (
                                    <li key={`${row.id}-err-${i}`}>{err}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {recs.length > 0 ? (
                              <ul className="space-y-2">
                                {recs.map((rec, idx) => (
                                  <li
                                    key={`${row.id}-srec-${idx}`}
                                    className="flex items-start gap-2 text-sm"
                                  >
                                    <PriorityPill priority={rec.priority} />
                                    <div className="flex-1">
                                      <p className="font-semibold text-[var(--text-primary)]">
                                        {rec.kind}
                                      </p>
                                      <p className="text-[var(--text-secondary)]">{rec.reason}</p>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-[var(--text-secondary)]">
                                No recommendations.
                              </p>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase mb-1">
                                  Current
                                </p>
                                <pre className="text-[11px] bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md p-2 overflow-auto max-h-64 whitespace-pre-wrap break-all">
{currentStr}
                                </pre>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase mb-1">
                                  Recommended
                                </p>
                                <pre className="text-[11px] bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md p-2 overflow-auto max-h-64 whitespace-pre-wrap break-all">
{recommendedStr}
                                </pre>
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={(e: MouseEvent<HTMLButtonElement>) => {
                                  e.stopPropagation();
                                  void applySchemaDiagnosis(row);
                                }}
                                disabled={busy || alreadyApplied}
                                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {busy ? "Applying…" : alreadyApplied ? "Applied" : "Apply"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
