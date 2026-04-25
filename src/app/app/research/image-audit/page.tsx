"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

type RecStatus = "pending" | "applied" | "dismissed";

type Issue =
  | "missing_alt"
  | "generic_alt"
  | "oversized"
  | "no_webp"
  | "low_resolution"
  | "broken"
  | "other";

type Action =
  | "generate_alt"
  | "regenerate"
  | "compress"
  | "convert_webp"
  | "remove";

type Recommendation = {
  id: string;
  user_id: string;
  run_id: string | null;
  article_id: string;
  image_index: number;
  image_storage_path: string | null;
  issue: Issue;
  recommended_action: Action;
  current_value: string | null;
  recommended_value: string | null;
  status: RecStatus;
  decided_at: string | null;
  created_at: string;
};

type GeneratedImage = {
  type?: string;
  altText?: string | null;
  storagePath?: string;
  publicUrl?: string;
  success?: boolean;
};

type ArticleStub = {
  id: string;
  title: string | null;
  slug: string | null;
  generated_images: GeneratedImage[] | null;
};

type FilterKey = "pending" | "applied" | "dismissed" | "all";

const FILTERS: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "applied", label: "Applied" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];

const ISSUE_LABEL: Record<Issue, string> = {
  missing_alt: "Missing alt text",
  generic_alt: "Generic alt text",
  oversized: "Oversized file",
  no_webp: "Not WebP",
  low_resolution: "Low resolution",
  broken: "Broken / failed",
  other: "Other",
};

const ACTION_LABEL: Record<Action, string> = {
  generate_alt: "Generate alt",
  regenerate: "Regenerate",
  compress: "Compress",
  convert_webp: "Convert to WebP",
  remove: "Remove",
};

function issuePillClass(issue: Issue): string {
  switch (issue) {
    case "broken":
      return "bg-[var(--error-light)] text-[var(--error)]";
    case "missing_alt":
      return "bg-[var(--warning-light)] text-[var(--warning)]";
    case "generic_alt":
      return "bg-[var(--warning-light)] text-[var(--warning)]";
    case "no_webp":
      return "bg-[var(--accent-light)] text-[var(--accent)]";
    default:
      return "bg-[var(--surface-sunken)] text-[var(--text-secondary)]";
  }
}

function actionPillClass(action: Action): string {
  switch (action) {
    case "generate_alt":
      return "bg-[var(--accent-light)] text-[var(--accent)]";
    case "convert_webp":
      return "bg-[var(--accent-light)] text-[var(--accent)]";
    case "regenerate":
      return "bg-[var(--error-light)] text-[var(--error)]";
    default:
      return "bg-[var(--surface-sunken)] text-[var(--text-secondary)]";
  }
}

function statusPillClass(status: RecStatus): string {
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

function isGeneratedImageArray(v: unknown): v is GeneratedImage[] {
  return Array.isArray(v);
}

export default function ImageAuditPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [articles, setArticles] = useState<Record<string, ArticleStub>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);

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

      const { data } = await supabase
        .from("image_optimization_recommendations")
        .select("*")
        .eq("user_id", user.user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (!cancelled && data) {
        const rows = data as Recommendation[];
        setRecommendations(rows);

        const ids = Array.from(new Set(rows.map((r) => r.article_id)));
        if (ids.length > 0) {
          const { data: arts } = await supabase
            .from("articles")
            .select("id, title, slug, generated_images")
            .in("id", ids);
          if (!cancelled && arts) {
            const map: Record<string, ArticleStub> = {};
            for (const a of arts as Array<{
              id: string;
              title: string | null;
              slug: string | null;
              generated_images: unknown;
            }>) {
              map[a.id] = {
                id: a.id,
                title: a.title,
                slug: a.slug,
                generated_images: isGeneratedImageArray(a.generated_images)
                  ? a.generated_images
                  : null,
              };
            }
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
      .channel(`image-opt-recs-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "image_optimization_recommendations",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const next = payload.new as Recommendation;
            setRecommendations((prev) => {
              if (prev.some((p) => p.id === next.id)) return prev;
              return [next, ...prev];
            });
            if (!articles[next.article_id]) {
              void (async () => {
                const { data: arts } = await supabase
                  .from("articles")
                  .select("id, title, slug, generated_images")
                  .eq("id", next.article_id);
                if (arts && arts.length > 0) {
                  const a = arts[0] as {
                    id: string;
                    title: string | null;
                    slug: string | null;
                    generated_images: unknown;
                  };
                  setArticles((prev) => ({
                    ...prev,
                    [a.id]: {
                      id: a.id,
                      title: a.title,
                      slug: a.slug,
                      generated_images: isGeneratedImageArray(a.generated_images)
                        ? a.generated_images
                        : null,
                    },
                  }));
                }
              })();
            }
          } else if (payload.eventType === "UPDATE") {
            const next = payload.new as Recommendation;
            setRecommendations((prev) =>
              prev.map((p) => (p.id === next.id ? next : p)),
            );
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as Recommendation;
            setRecommendations((prev) => prev.filter((p) => p.id !== old.id));
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(chan);
    };
  }, [supabase, userId, articles]);

  const visible = recommendations.filter((r) =>
    filter === "all" ? true : r.status === filter,
  );
  const counts: Record<FilterKey, number> = {
    pending: recommendations.filter((r) => r.status === "pending").length,
    applied: recommendations.filter((r) => r.status === "applied").length,
    dismissed: recommendations.filter((r) => r.status === "dismissed").length,
    all: recommendations.length,
  };

  // Group by article
  const grouped = visible.reduce<Record<string, Recommendation[]>>(
    (acc, rec) => {
      const k = rec.article_id;
      if (!acc[k]) acc[k] = [];
      acc[k].push(rec);
      return acc;
    },
    {},
  );

  function thumbForRec(rec: Recommendation): string | null {
    const art = articles[rec.article_id];
    if (!art || !art.generated_images) return null;
    const img = art.generated_images[rec.image_index];
    if (!img || typeof img.publicUrl !== "string" || img.publicUrl === "") {
      return null;
    }
    return img.publicUrl;
  }

  async function dispatchAudit() {
    setDispatching(true);
    setError(null);
    try {
      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "image_optimize",
          topic: "image audit",
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

  async function markStatus(rec: Recommendation, status: RecStatus) {
    const decidedAt = new Date().toISOString();
    const snapshot = recommendations;
    setRecommendations((prev) =>
      prev.map((p) =>
        p.id === rec.id ? { ...p, status, decided_at: decidedAt } : p,
      ),
    );
    const { error: updateError } = await supabase
      .from("image_optimization_recommendations")
      .update({ status, decided_at: decidedAt })
      .eq("id", rec.id);
    if (updateError) {
      setRecommendations(snapshot);
      setError(updateError.message);
      return false;
    }
    return true;
  }

  async function dismiss(rec: Recommendation) {
    setBusyId(rec.id);
    setError(null);
    await markStatus(rec, "dismissed");
    setBusyId(null);
  }

  async function applyGenerateAlt(rec: Recommendation, newAlt: string) {
    setBusyId(rec.id);
    setError(null);
    setToast(null);

    const trimmed = newAlt.trim();
    if (trimmed === "") {
      setError("Alt text cannot be empty.");
      setBusyId(null);
      return;
    }

    const { data: src, error: fetchErr } = await supabase
      .from("articles")
      .select("id, generated_images")
      .eq("id", rec.article_id)
      .maybeSingle();
    if (fetchErr || !src) {
      setError(fetchErr?.message ?? "Could not load article.");
      setBusyId(null);
      return;
    }
    const row = src as { id: string; generated_images: unknown };
    const imgs = isGeneratedImageArray(row.generated_images)
      ? [...row.generated_images]
      : [];
    if (rec.image_index < 0 || rec.image_index >= imgs.length) {
      setError("Image index out of range — article may have changed.");
      setBusyId(null);
      return;
    }
    const original = imgs[rec.image_index] ?? {};
    imgs[rec.image_index] = { ...original, altText: trimmed };

    const { error: updateArtErr } = await supabase
      .from("articles")
      .update({ generated_images: imgs })
      .eq("id", rec.article_id);
    if (updateArtErr) {
      setError(updateArtErr.message);
      setBusyId(null);
      return;
    }

    // Mirror the new alt back into our local stub so subsequent thumbnails
    // and edits reflect the change without a refetch.
    setArticles((prev) => {
      const cur = prev[rec.article_id];
      if (!cur || !cur.generated_images) return prev;
      const copy = [...cur.generated_images];
      copy[rec.image_index] = { ...(copy[rec.image_index] ?? {}), altText: trimmed };
      return { ...prev, [rec.article_id]: { ...cur, generated_images: copy } };
    });

    const ok = await markStatus(rec, "applied");
    if (ok) {
      setToast("Alt text updated on article.");
      setEditing((prev) => {
        const copy = { ...prev };
        delete copy[rec.id];
        return copy;
      });
    }
    setBusyId(null);
  }

  async function applyConvertWebp(rec: Recommendation) {
    setBusyId(rec.id);
    setError(null);
    setToast(null);
    const ok = await markStatus(rec, "applied");
    if (ok) {
      setToast(
        "WebP conversion requires re-running image generation. Marked as applied — trigger a refresh from the article editor when ready.",
      );
    }
    setBusyId(null);
  }

  async function applyRegenerate(rec: Recommendation) {
    setBusyId(rec.id);
    setError(null);
    setToast(null);
    const ok = await markStatus(rec, "applied");
    if (ok) {
      setToast(
        "Click the article link to regenerate the broken image via the article editor. Marked as applied.",
      );
    }
    setBusyId(null);
  }

  function handleApply(rec: Recommendation) {
    if (rec.recommended_action === "generate_alt") {
      const inputVal = editing[rec.id];
      const candidate =
        typeof inputVal === "string" && inputVal.trim() !== ""
          ? inputVal
          : rec.recommended_value ?? "";
      if (candidate.trim() === "") {
        // Open the inline input so the user can supply a value.
        setEditing((prev) => ({ ...prev, [rec.id]: "" }));
        setToast("Provide a new alt text below, then click Apply.");
        return;
      }
      void applyGenerateAlt(rec, candidate);
      return;
    }
    if (rec.recommended_action === "convert_webp") {
      void applyConvertWebp(rec);
      return;
    }
    if (rec.recommended_action === "regenerate") {
      void applyRegenerate(rec);
      return;
    }
    // Other actions (compress / remove) aren't wired yet — just mark applied.
    void markStatus(rec, "applied");
  }

  function toggleCollapsed(articleId: string) {
    setCollapsed((prev) => ({ ...prev, [articleId]: !prev[articleId] }));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Image audit
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            SEO and accessibility issues surfaced by the ImageOptimizer agent.
            Apply to fix in place, or dismiss to skip.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void dispatchAudit()}
            disabled={dispatching}
            className={cn(
              "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white",
              "hover:opacity-90 disabled:opacity-50",
            )}
          >
            {dispatching ? "Dispatching..." : "Run audit"}
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
        ) : Object.keys(grouped).length === 0 ? (
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-12 text-center text-sm text-[var(--text-tertiary)]">
            {filter === "pending"
              ? "No image issues yet — run an audit to surface recommendations."
              : "No recommendations match this filter."}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([articleId, recs]) => {
              const art = articles[articleId];
              const title = art?.title ?? "Unknown article";
              const isCollapsed = !!collapsed[articleId];
              return (
                <section
                  key={articleId}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)]"
                >
                  <header className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCollapsed(articleId)}
                        aria-label={isCollapsed ? "Expand" : "Collapse"}
                        className="rounded border border-[var(--border-default)] px-2 py-0.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                      >
                        {isCollapsed ? "+" : "−"}
                      </button>
                      <Link
                        href={`/app/articles/${articleId}`}
                        className="truncate text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
                        title={title}
                      >
                        {title}
                      </Link>
                      <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                        {recs.length} issue{recs.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </header>

                  {!isCollapsed && (
                    <ul className="divide-y divide-[var(--border-default)]">
                      {recs.map((rec) => {
                        const thumb = thumbForRec(rec);
                        const canAct = rec.status === "pending";
                        const showAltInput =
                          rec.recommended_action === "generate_alt" &&
                          (editing[rec.id] !== undefined ||
                            !rec.recommended_value ||
                            rec.recommended_value.trim() === "");
                        const inputValue =
                          editing[rec.id] ??
                          (rec.recommended_value ?? "");
                        return (
                          <li key={rec.id} className="px-4 py-3">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="flex min-w-0 flex-1 items-start gap-3">
                                {thumb ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={thumb}
                                    alt={rec.current_value ?? ""}
                                    width={80}
                                    height={80}
                                    className="h-20 w-20 shrink-0 rounded border border-[var(--border-default)] bg-[var(--surface-sunken)] object-cover"
                                  />
                                ) : (
                                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded border border-[var(--border-default)] bg-[var(--surface-sunken)] text-[10px] text-[var(--text-tertiary)]">
                                    no preview
                                  </div>
                                )}

                                <div className="min-w-0 flex-1 space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={cn(
                                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                        issuePillClass(rec.issue),
                                      )}
                                    >
                                      {ISSUE_LABEL[rec.issue]}
                                    </span>
                                    <span
                                      className={cn(
                                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                        actionPillClass(rec.recommended_action),
                                      )}
                                    >
                                      {ACTION_LABEL[rec.recommended_action]}
                                    </span>
                                    <span
                                      className={cn(
                                        "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                                        statusPillClass(rec.status),
                                      )}
                                    >
                                      {rec.status}
                                    </span>
                                    <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                                      image #{rec.image_index}
                                    </span>
                                  </div>

                                  <div className="grid gap-1 text-xs sm:grid-cols-2">
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                                        Current
                                      </p>
                                      <p className="break-all text-[var(--text-secondary)]">
                                        {rec.current_value && rec.current_value !== ""
                                          ? rec.current_value
                                          : "—"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                                        Recommended
                                      </p>
                                      <p className="break-all text-[var(--text-secondary)]">
                                        {rec.recommended_value && rec.recommended_value !== ""
                                          ? rec.recommended_value
                                          : "—"}
                                      </p>
                                    </div>
                                  </div>

                                  {showAltInput && canAct && (
                                    <div className="pt-1">
                                      <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                                        New alt text
                                      </label>
                                      <input
                                        type="text"
                                        value={inputValue}
                                        maxLength={140}
                                        onChange={(e) =>
                                          setEditing((prev) => ({
                                            ...prev,
                                            [rec.id]: e.target.value,
                                          }))
                                        }
                                        placeholder="Describe what's in the image"
                                        className="mt-1 w-full rounded border border-[var(--border-default)] bg-[var(--surface-base)] px-2 py-1 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-col items-stretch gap-2 md:w-auto md:items-end">
                                <button
                                  type="button"
                                  disabled={busyId === rec.id || !canAct}
                                  onClick={() => handleApply(rec)}
                                  className={cn(
                                    "rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white",
                                    "hover:opacity-90 disabled:opacity-40",
                                  )}
                                >
                                  {busyId === rec.id ? "Working..." : "Apply"}
                                </button>
                                <button
                                  type="button"
                                  disabled={busyId === rec.id || !canAct}
                                  onClick={() => void dismiss(rec)}
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
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
