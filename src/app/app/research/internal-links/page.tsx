"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

type SuggestionStatus = "pending" | "applied" | "dismissed";

type LinkSuggestion = {
  id: string;
  user_id: string;
  run_id: string | null;
  source_article_id: string;
  target_article_id: string;
  anchor_text: string;
  context_snippet: string | null;
  confidence: number;
  status: SuggestionStatus;
  decided_at: string | null;
  created_at: string;
};

type ArticleStub = {
  id: string;
  title: string | null;
  slug: string | null;
};

type FilterKey = "pending" | "applied" | "dismissed" | "all";

const FILTERS: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "applied", label: "Applied" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];

function confidenceClass(c: number): string {
  if (c >= 0.85) return "bg-[var(--success-light)] text-[var(--success)]";
  if (c >= 0.7) return "bg-[var(--accent-light)] text-[var(--accent)]";
  return "bg-[var(--warning-light)] text-[var(--warning)]";
}

function statusPillClass(status: SuggestionStatus): string {
  switch (status) {
    case "applied":
      return "bg-[var(--success-light)] text-[var(--success)]";
    case "dismissed":
      return "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]";
    case "pending":
    default:
      return "bg-[var(--warning-light)] text-[var(--warning)]";
  }
}

// Find the first occurrence of `anchor` in `markdown` that is NOT already
// inside a markdown link span `[...](...)` and not part of a markdown image
// `![...](...)`. Returns the match index, or -1 if not found.
function findUnlinkedAnchorIndex(markdown: string, anchor: string): number {
  if (!anchor || !markdown) return -1;

  // Collect all existing link/image spans so we can skip occurrences inside them.
  const linkSpans: Array<[number, number]> = [];
  const linkRe = /!?\[[^\]]*\]\([^)]*\)/g;
  let lm: RegExpExecArray | null;
  while ((lm = linkRe.exec(markdown)) !== null) {
    linkSpans.push([lm.index, lm.index + lm[0].length]);
  }
  const insideLink = (i: number): boolean =>
    linkSpans.some(([s, e]) => i >= s && i < e);

  // First: case-sensitive scan.
  let from = 0;
  while (from <= markdown.length) {
    const idx = markdown.indexOf(anchor, from);
    if (idx === -1) break;
    if (!insideLink(idx)) return idx;
    from = idx + 1;
  }
  // Fallback: case-insensitive scan.
  const lower = markdown.toLowerCase();
  const target = anchor.toLowerCase();
  from = 0;
  while (from <= lower.length) {
    const idx = lower.indexOf(target, from);
    if (idx === -1) break;
    if (!insideLink(idx)) return idx;
    from = idx + 1;
  }
  return -1;
}

function applyLinkToMarkdown(
  markdown: string,
  anchor: string,
  targetSlug: string,
): { ok: boolean; next: string } {
  const idx = findUnlinkedAnchorIndex(markdown, anchor);
  if (idx === -1) return { ok: false, next: markdown };
  // Use the actual matched substring (preserves original casing).
  const matched = markdown.slice(idx, idx + anchor.length);
  const cleanSlug = targetSlug.replace(/^\/+/, "");
  const replacement = `[${matched}](/blog/${cleanSlug})`;
  const next = markdown.slice(0, idx) + replacement + markdown.slice(idx + anchor.length);
  return { ok: true, next };
}

export default function InternalLinkSuggestionsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);
  const [articles, setArticles] = useState<Record<string, ArticleStub>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [niche, setNiche] = useState<string>("");

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (!cancelled) setUserId(user.user.id);

      const { data: settings } = await supabase
        .from("user_settings")
        .select("niche")
        .eq("user_id", user.user.id)
        .maybeSingle();
      const settingsNiche = ((settings as { niche?: string } | null)?.niche ?? "").toString();
      if (!cancelled) setNiche(settingsNiche);

      const { data } = await supabase
        .from("link_suggestions")
        .select("*")
        .eq("user_id", user.user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (!cancelled && data) {
        const rows = data as LinkSuggestion[];
        setSuggestions(rows);

        const ids = new Set<string>();
        for (const r of rows) {
          ids.add(r.source_article_id);
          ids.add(r.target_article_id);
        }
        if (ids.size > 0) {
          const { data: arts } = await supabase
            .from("articles")
            .select("id, title, slug")
            .in("id", Array.from(ids));
          if (!cancelled && arts) {
            const map: Record<string, ArticleStub> = {};
            for (const a of arts as ArticleStub[]) map[a.id] = a;
            setArticles(map);
          }
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Realtime
  useEffect(() => {
    if (!userId) return;
    const chan = supabase
      .channel(`link-suggestions-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "link_suggestions",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const next = payload.new as LinkSuggestion;
            setSuggestions((prev) => {
              if (prev.some((p) => p.id === next.id)) return prev;
              return [next, ...prev];
            });
            // Lazily hydrate any missing article stubs for this row.
            const missing = [next.source_article_id, next.target_article_id].filter(
              (id) => !articles[id],
            );
            if (missing.length > 0) {
              void (async () => {
                const { data: arts } = await supabase
                  .from("articles")
                  .select("id, title, slug")
                  .in("id", missing);
                if (arts) {
                  setArticles((prev) => {
                    const copy = { ...prev };
                    for (const a of arts as ArticleStub[]) copy[a.id] = a;
                    return copy;
                  });
                }
              })();
            }
          } else if (payload.eventType === "UPDATE") {
            const next = payload.new as LinkSuggestion;
            setSuggestions((prev) => prev.map((p) => (p.id === next.id ? next : p)));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as LinkSuggestion;
            setSuggestions((prev) => prev.filter((p) => p.id !== old.id));
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(chan);
    };
  }, [supabase, userId, articles]);

  const visible = suggestions.filter((s) => (filter === "all" ? true : s.status === filter));
  const counts: Record<FilterKey, number> = {
    pending: suggestions.filter((s) => s.status === "pending").length,
    applied: suggestions.filter((s) => s.status === "applied").length,
    dismissed: suggestions.filter((s) => s.status === "dismissed").length,
    all: suggestions.length,
  };

  async function dispatchScan() {
    setDispatching(true);
    setError(null);
    try {
      const topic = niche.trim() === "" ? "all" : niche.trim();
      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "internal_link_optimize",
          topic,
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
      setDispatching(false);
    }
  }

  async function dismiss(s: LinkSuggestion) {
    setBusyId(s.id);
    setError(null);
    const decidedAt = new Date().toISOString();
    const snapshot = suggestions;
    setSuggestions((prev) =>
      prev.map((p) => (p.id === s.id ? { ...p, status: "dismissed", decided_at: decidedAt } : p)),
    );
    const { error: updateError } = await supabase
      .from("link_suggestions")
      .update({ status: "dismissed", decided_at: decidedAt })
      .eq("id", s.id);
    if (updateError) {
      setSuggestions(snapshot);
      setError(updateError.message);
    }
    setBusyId(null);
  }

  async function apply(s: LinkSuggestion) {
    setBusyId(s.id);
    setError(null);
    setToast(null);

    const target = articles[s.target_article_id];
    if (!target || !target.slug) {
      setError("Target article slug missing — cannot build link URL.");
      setBusyId(null);
      return;
    }

    // Fetch the source article's current markdown via the user's RLS-scoped client.
    const { data: src, error: fetchErr } = await supabase
      .from("articles")
      .select("id, article_markdown")
      .eq("id", s.source_article_id)
      .maybeSingle();
    if (fetchErr || !src) {
      setError(fetchErr?.message ?? "Could not load source article.");
      setBusyId(null);
      return;
    }
    const row = src as { id: string; article_markdown: string | null };
    const markdown = row.article_markdown ?? "";
    const result = applyLinkToMarkdown(markdown, s.anchor_text, target.slug);
    if (!result.ok) {
      setToast("Anchor no longer present in article — dismiss this suggestion?");
      setBusyId(null);
      return;
    }

    const { error: updateArticleErr } = await supabase
      .from("articles")
      .update({ article_markdown: result.next })
      .eq("id", s.source_article_id);
    if (updateArticleErr) {
      setError(updateArticleErr.message);
      setBusyId(null);
      return;
    }

    const decidedAt = new Date().toISOString();
    const snapshot = suggestions;
    setSuggestions((prev) =>
      prev.map((p) => (p.id === s.id ? { ...p, status: "applied", decided_at: decidedAt } : p)),
    );
    const { error: updateSuggestionErr } = await supabase
      .from("link_suggestions")
      .update({ status: "applied", decided_at: decidedAt })
      .eq("id", s.id);
    if (updateSuggestionErr) {
      setSuggestions(snapshot);
      setError(updateSuggestionErr.message);
    } else {
      setToast("Link inserted into source article.");
    }
    setBusyId(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Internal link suggestions
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Inbox of anchor opportunities surfaced by the InternalLinkOptimizer agent.
            Apply to insert the link into the source article, or dismiss to skip.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void dispatchScan()}
            disabled={dispatching}
            className={cn(
              "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white",
              "hover:opacity-90 disabled:opacity-50",
            )}
          >
            {dispatching ? "Dispatching..." : "Run scan"}
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

      {toast && (
        <div className="rounded-lg border border-[var(--accent)] bg-[var(--accent-light)] px-4 py-3 text-sm text-[var(--accent)]">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
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
                {counts[f.key]}
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
              ? "No link suggestions yet — run a scan to surface opportunities."
              : "No suggestions match this filter."}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((s) => {
              const source = articles[s.source_article_id];
              const target = articles[s.target_article_id];
              const sourceTitle = source?.title ?? "Unknown source";
              const targetTitle = target?.title ?? "Unknown target";
              const confidencePct = Math.round((s.confidence ?? 0) * 100);
              const canAct = s.status === "pending";
              return (
                <li
                  key={s.id}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Link
                          href={`/app/articles/${s.source_article_id}`}
                          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
                          title={sourceTitle}
                        >
                          {sourceTitle}
                        </Link>
                        <span className="text-[var(--text-tertiary)]">→</span>
                        <Link
                          href={`/app/articles/${s.target_article_id}`}
                          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
                          title={targetTitle}
                        >
                          {targetTitle}
                        </Link>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                            statusPillClass(s.status),
                          )}
                        >
                          {s.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                          {s.anchor_text}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            confidenceClass(s.confidence ?? 0),
                          )}
                        >
                          {confidencePct}% confidence
                        </span>
                        {target?.slug && (
                          <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                            /blog/{target.slug.replace(/^\/+/, "")}
                          </span>
                        )}
                      </div>

                      {s.context_snippet && (
                        <p className="rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-xs text-[var(--text-secondary)] italic">
                          &ldquo;{s.context_snippet}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch gap-2 md:w-auto md:items-end">
                      <button
                        type="button"
                        disabled={busyId === s.id || !canAct}
                        onClick={() => void apply(s)}
                        className={cn(
                          "rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white",
                          "hover:opacity-90 disabled:opacity-40",
                        )}
                      >
                        {busyId === s.id ? "Working..." : "Apply"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === s.id || !canAct}
                        onClick={() => void dismiss(s)}
                        className={cn(
                          "rounded border border-[var(--error)] px-3 py-1.5 text-xs font-medium text-[var(--error)]",
                          "hover:bg-[var(--error-light)] disabled:opacity-40",
                        )}
                      >
                        Dismiss
                      </button>
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
