"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createClient as createSupabaseBrowser } from "@/lib/supabase-browser";

type KeywordStatus = "pending" | "accepted" | "rejected" | "used";
type KeywordSource = "gsc_queries" | "serp_gap" | "competitor" | "manual";
type Intent = "informational" | "commercial" | "transactional" | "navigational";

type KeywordCandidateRow = {
  id: string;
  user_id: string;
  keyword: string;
  source: KeywordSource;
  intent: Intent | null;
  estimated_volume: number | null;
  cluster_hint: string | null;
  status: KeywordStatus;
  used_in_article_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  decided_at: string | null;
};

type StatusFilter = KeywordStatus | "all";
type SourceFilter = KeywordSource | "all";

type UserSettings = {
  niche: string | null;
  autopilot_niche: string | null;
  gsc_site_url: string | null;
};

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "used", label: "Used" },
  { value: "all", label: "All" },
];

const SOURCE_OPTIONS: Array<{ value: SourceFilter; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "gsc_queries", label: "GSC queries" },
  { value: "serp_gap", label: "SERP gap" },
  { value: "competitor", label: "Competitor" },
  { value: "manual", label: "Manual" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatVolume(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`;
  return String(n);
}

export default function KeywordHarvesterPage() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [rows, setRows] = useState<KeywordCandidateRow[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [harvesting, setHarvesting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) {
        setSettings(null);
        return;
      }
      const { data: s } = await supabase
        .from("user_settings")
        .select("niche, autopilot_niche, gsc_site_url")
        .eq("user_id", uid)
        .maybeSingle();
      if (!cancelled) {
        setSettings(
          (s as UserSettings | null) ?? {
            niche: null,
            autopilot_niche: null,
            gsc_site_url: null,
          },
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      let query = supabase
        .from("keyword_candidates")
        .select(
          "id,user_id,keyword,source,intent,estimated_volume,cluster_hint,status,used_in_article_id,metadata,created_at,decided_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (sourceFilter !== "all") {
        query = query.eq("source", sourceFilter);
      }

      const { data, error: qErr } = await query;
      if (qErr) throw new Error(qErr.message);
      setRows((data as KeywordCandidateRow[] | null) ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [supabase, userId, statusFilter, sourceFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`keyword_candidates:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "keyword_candidates",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, refresh]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const harvestNew = useCallback(async () => {
    if (harvesting) return;
    setHarvesting(true);
    try {
      const niche = settings?.niche ?? settings?.autopilot_niche ?? "";
      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "keyword_harvest",
          topic: niche,
          focusKeyword: "",
          gscSiteUrl: settings?.gsc_site_url ?? null,
          quality: "standard",
        }),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `harvest failed (${resp.status})`);
      }
      showToast("Harvest started — results will appear shortly.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setHarvesting(false);
    }
  }, [harvesting, settings, showToast]);

  const updateStatus = useCallback(
    async (id: string, next: KeywordStatus) => {
      if (!userId) return;
      setBusyId(id);
      const snapshot = rows;
      setRows((prev) =>
        prev
          .map((r) => (r.id === id ? { ...r, status: next } : r))
          .filter((r) =>
            statusFilter === "all" ? true : r.status === statusFilter,
          ),
      );
      try {
        const { error: upErr } = await supabase
          .from("keyword_candidates")
          .update({ status: next, decided_at: new Date().toISOString() })
          .eq("id", id)
          .eq("user_id", userId);
        if (upErr) throw new Error(upErr.message);
      } catch (e) {
        setRows(snapshot);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    },
    [supabase, userId, rows, statusFilter],
  );

  const createArticleFor = useCallback(
    async (row: KeywordCandidateRow) => {
      if (!userId) return;
      setBusyId(row.id);
      try {
        const resp = await fetch("/api/agent/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "article",
            topic: row.keyword,
            focusKeyword: row.keyword,
            quality: "standard",
          }),
        });
        if (!resp.ok) {
          const data = (await resp.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `dispatch failed (${resp.status})`);
        }
        await updateStatus(row.id, "used");
        showToast(`Article generation queued for "${row.keyword}".`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    },
    [userId, updateStatus, showToast],
  );

  const sourceBadge = (s: KeywordSource) => {
    const label: Record<KeywordSource, string> = {
      gsc_queries: "GSC",
      serp_gap: "SERP gap",
      competitor: "Competitor",
      manual: "Manual",
    };
    return label[s];
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Keyword harvester
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Review new keyword ideas sourced from GSC, SERP gaps, and competitor scans.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/research"
            className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]"
          >
            Back to research
          </Link>
          <button
            type="button"
            onClick={() => void harvestNew()}
            disabled={harvesting || !userId}
            className={cn(
              "rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white",
              "hover:opacity-90 disabled:opacity-50",
            )}
          >
            {harvesting ? "Starting..." : "Harvest new keywords"}
          </button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 py-1 text-sm text-[var(--text-primary)]"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span>Source</span>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            className="rounded border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 py-1 text-sm text-[var(--text-primary)]"
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto text-xs text-[var(--text-tertiary)]">
          {rows.length} {rows.length === 1 ? "candidate" : "candidates"}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error)] bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      {toast && (
        <div className="mb-4 rounded-lg border border-[var(--success)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--success)]">
          {toast}
        </div>
      )}

      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)]">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-[var(--text-tertiary)]">
            Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--text-tertiary)]">
            No keyword candidates yet. Click &apos;Harvest new keywords&apos; to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] text-left text-[11px] uppercase tracking-wider text-[var(--text-tertiary)]">
                  <th className="px-4 py-2 font-semibold">Keyword</th>
                  <th className="px-3 py-2 font-semibold">Source</th>
                  <th className="px-3 py-2 font-semibold">Intent</th>
                  <th className="px-3 py-2 font-semibold">Est. volume</th>
                  <th className="px-3 py-2 font-semibold">Created</th>
                  <th className="px-3 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {rows.map((r) => {
                  const isBusy = busyId === r.id;
                  return (
                    <tr key={r.id} className="hover:bg-[var(--surface-sunken)]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[var(--text-primary)]">
                          {r.keyword}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                          status: {r.status}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[var(--text-secondary)]">
                        <span className="inline-flex items-center rounded border border-[var(--border-default)] bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[11px]">
                          {sourceBadge(r.source)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[var(--text-secondary)]">
                        {r.intent ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-[var(--text-secondary)]">
                        {formatVolume(r.estimated_volume)}
                      </td>
                      <td className="px-3 py-3 text-[var(--text-tertiary)]">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex shrink-0 items-center justify-end gap-2">
                          {r.status !== "accepted" && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void updateStatus(r.id, "accepted")}
                              className={cn(
                                "rounded border border-[var(--border-default)] px-2 py-1 text-xs",
                                "text-[var(--success)] hover:bg-[var(--surface-sunken)] disabled:opacity-50",
                              )}
                            >
                              Accept
                            </button>
                          )}
                          {r.status !== "rejected" && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void updateStatus(r.id, "rejected")}
                              className={cn(
                                "rounded border border-[var(--border-default)] px-2 py-1 text-xs",
                                "text-[var(--error)] hover:bg-[var(--surface-sunken)] disabled:opacity-50",
                              )}
                            >
                              Reject
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isBusy || r.status === "used"}
                            onClick={() => void createArticleFor(r)}
                            className={cn(
                              "rounded bg-[var(--accent)] px-2 py-1 text-xs font-medium text-white",
                              "hover:opacity-90 disabled:opacity-50",
                            )}
                          >
                            Create article
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
