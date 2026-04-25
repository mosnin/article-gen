"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

type Intent = "informational" | "commercial" | "transactional" | "navigational";

type BriefStatus = "pending" | "approved" | "rejected" | "written";

type OutlineSection = {
  level: number;
  heading: string;
  notes?: string;
};

type Outline = {
  title: string;
  sections: OutlineSection[];
};

type Brief = {
  id: string;
  user_id: string;
  run_id: string | null;
  topic: string;
  focus_keyword: string;
  target_word_count: number;
  must_cover_entities: string[] | null;
  must_link_sources: string[] | null;
  reader_persona: string | null;
  intent: Intent | null;
  estimated_reading_time: number | null;
  outline_hint: Outline | null;
  status: BriefStatus;
  written_article_id: string | null;
  decided_at: string | null;
  created_at: string;
};

type FilterKey = "pending" | "approved" | "rejected" | "written" | "all";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "written", label: "Written" },
  { key: "all", label: "All" },
];

const INTENT_LABEL: Record<Intent, string> = {
  informational: "Informational",
  commercial: "Commercial",
  transactional: "Transactional",
  navigational: "Navigational",
};

function statusPillClass(status: BriefStatus): string {
  switch (status) {
    case "approved":
      return "bg-[var(--success-light)] text-[var(--success)]";
    case "rejected":
      return "bg-[var(--error-light)] text-[var(--error)]";
    case "written":
      return "bg-[var(--accent-light)] text-[var(--accent)]";
    case "pending":
    default:
      return "bg-[var(--warning-light)] text-[var(--warning)]";
  }
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function normalizeBrief(raw: unknown): Brief {
  const r = (raw ?? {}) as Record<string, unknown>;
  const outline = (r.outline_hint as Outline | null | undefined) ?? null;
  return {
    id: String(r.id ?? ""),
    user_id: String(r.user_id ?? ""),
    run_id: (r.run_id as string | null) ?? null,
    topic: String(r.topic ?? ""),
    focus_keyword: String(r.focus_keyword ?? ""),
    target_word_count:
      typeof r.target_word_count === "number" ? r.target_word_count : 1500,
    must_cover_entities: asStringArray(r.must_cover_entities),
    must_link_sources: asStringArray(r.must_link_sources),
    reader_persona: (r.reader_persona as string | null) ?? null,
    intent: (r.intent as Intent | null) ?? null,
    estimated_reading_time:
      typeof r.estimated_reading_time === "number" ? r.estimated_reading_time : null,
    outline_hint: outline && typeof outline === "object" ? outline : null,
    status: ((r.status as BriefStatus) ?? "pending") as BriefStatus,
    written_article_id: (r.written_article_id as string | null) ?? null,
    decided_at: (r.decided_at as string | null) ?? null,
    created_at: String(r.created_at ?? new Date().toISOString()),
  };
}

export default function ContentBriefsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // New-brief form state
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formTopic, setFormTopic] = useState("");
  const [formKeyword, setFormKeyword] = useState("");
  const [formTone, setFormTone] = useState("");
  const [formAudience, setFormAudience] = useState("");

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("content_briefs")
        .select("*")
        .eq("user_id", user.user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!cancelled && data) {
        setBriefs((data as unknown[]).map(normalizeBrief));
      }
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
        .channel(`content-briefs-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "content_briefs",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const next = normalizeBrief(payload.new);
              setBriefs((prev) =>
                prev.some((b) => b.id === next.id) ? prev : [next, ...prev],
              );
            } else if (payload.eventType === "UPDATE") {
              const next = normalizeBrief(payload.new);
              setBriefs((prev) => prev.map((b) => (b.id === next.id ? next : b)));
            } else if (payload.eventType === "DELETE") {
              const old = payload.old as { id?: string };
              setBriefs((prev) => prev.filter((b) => b.id !== old.id));
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

  const visible = briefs.filter((b) => (filter === "all" ? true : b.status === filter));

  async function decide(id: string, action: "approved" | "rejected") {
    setBusyId(id);
    const snapshot = briefs;
    const decidedAt = new Date().toISOString();
    setBriefs((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, status: action, decided_at: decidedAt } : b,
      ),
    );
    const { error: updateError } = await supabase
      .from("content_briefs")
      .update({ status: action, decided_at: decidedAt })
      .eq("id", id);
    if (updateError) {
      setBriefs(snapshot);
      setError(updateError.message);
    }
    setBusyId(null);
  }

  async function generateArticle(b: Brief) {
    setBusyId(b.id);
    setError(null);
    try {
      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "article",
          topic: b.topic,
          focusKeyword: b.focus_keyword,
          options: { contentBriefId: b.id },
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
        .from("content_briefs")
        .update({ status: "written", decided_at: new Date().toISOString() })
        .eq("id", b.id);
      router.push(`/app/agent-runs/${runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusyId(null);
    }
  }

  async function submitNewBrief(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formTopic.trim() || !formKeyword.trim()) {
      setError("Topic and focus keyword are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "content_brief",
          topic: formTopic.trim(),
          focusKeyword: formKeyword.trim(),
          tone: formTone.trim() || undefined,
          targetAudience: formAudience.trim() || undefined,
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        setError(`Failed to dispatch: ${errText}`);
        return;
      }
      const { runId } = (await resp.json()) as { runId: string };
      router.push(`/app/agent-runs/${runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Content briefs</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Review and approve a content brief before spending tokens on a full article. Approve to
            keep, reject to discard, or generate the article straight from a brief.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className={cn(
              "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white",
              "hover:opacity-90",
            )}
          >
            {showForm ? "Close" : "New brief"}
          </button>
          <Link
            href="/app/research"
            className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]"
          >
            Back to research
          </Link>
        </div>
      </header>

      {showForm && (
        <form
          onSubmit={(e) => void submitNewBrief(e)}
          className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-4"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs">
              <span className="text-[var(--text-secondary)]">Topic</span>
              <input
                type="text"
                required
                value={formTopic}
                onChange={(e) => setFormTopic(e.target.value)}
                placeholder="e.g. internal linking strategies for SaaS blogs"
                className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              />
            </label>
            <label className="block text-xs">
              <span className="text-[var(--text-secondary)]">Focus keyword</span>
              <input
                type="text"
                required
                value={formKeyword}
                onChange={(e) => setFormKeyword(e.target.value)}
                placeholder="e.g. internal linking strategy"
                className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              />
            </label>
            <label className="block text-xs">
              <span className="text-[var(--text-secondary)]">Tone (optional)</span>
              <input
                type="text"
                value={formTone}
                onChange={(e) => setFormTone(e.target.value)}
                placeholder="e.g. authoritative, friendly"
                className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              />
            </label>
            <label className="block text-xs">
              <span className="text-[var(--text-secondary)]">Target audience (optional)</span>
              <input
                type="text"
                value={formAudience}
                onChange={(e) => setFormAudience(e.target.value)}
                placeholder="e.g. early-stage SaaS founders"
                className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white",
                "hover:opacity-90 disabled:opacity-50",
              )}
            >
              {submitting ? "Dispatching..." : "Generate brief"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="rounded-lg border border-[var(--error)] bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          const count =
            f.key === "all" ? briefs.length : briefs.filter((b) => b.status === f.key).length;
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
              ? 'No pending briefs. Click "New brief" to generate one.'
              : "No briefs match this filter."}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((b) => {
              const open = !!expanded[b.id];
              const entities = b.must_cover_entities ?? [];
              const sources = b.must_link_sources ?? [];
              const sections = b.outline_hint?.sections ?? [];
              const intent = b.intent ?? "informational";
              const canGenerate = b.status === "pending" || b.status === "approved";
              return (
                <li
                  key={b.id}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-[var(--text-primary)]">
                          {b.topic}
                        </h2>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                            statusPillClass(b.status),
                          )}
                        >
                          {b.status}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {b.focus_keyword && (
                          <span className="rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                            {b.focus_keyword}
                          </span>
                        )}
                        <span className="rounded-full bg-[var(--accent-light)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                          {INTENT_LABEL[intent]}
                        </span>
                        <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                          {b.target_word_count} words
                        </span>
                        {typeof b.estimated_reading_time === "number" && (
                          <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                            ~{b.estimated_reading_time} min read
                          </span>
                        )}
                      </div>

                      {b.reader_persona && (
                        <blockquote className="mt-3 border-l-2 border-[var(--accent)] pl-3 text-sm italic text-[var(--text-secondary)]">
                          {b.reader_persona}
                        </blockquote>
                      )}

                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((prev) => ({ ...prev, [b.id]: !prev[b.id] }))
                          }
                          className="text-xs font-medium text-[var(--accent)] hover:underline"
                        >
                          {open ? "Hide details" : "Show details"}
                        </button>
                        {open && (
                          <div className="mt-2 space-y-3 rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-3">
                            {entities.length > 0 && (
                              <div>
                                <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                                  Must-cover entities
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  {entities.map((entity, i) => (
                                    <span
                                      key={`${entity}-${i}`}
                                      className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-[11px] text-[var(--text-primary)]"
                                    >
                                      {entity}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {sources.length > 0 && (
                              <div>
                                <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                                  Must-link sources
                                </div>
                                <ul className="mt-1 space-y-1">
                                  {sources.map((url, i) => (
                                    <li key={`${url}-${i}`}>
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
                              </div>
                            )}

                            {b.outline_hint && sections.length > 0 && (
                              <div>
                                <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                                  Outline hint
                                </div>
                                <div className="mt-1 space-y-1">
                                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                                    {b.outline_hint.title}
                                  </h3>
                                  <ul className="space-y-1">
                                    {sections.map((s, i) => (
                                      <li
                                        key={`${s.heading}-${i}`}
                                        className={cn(
                                          "text-xs text-[var(--text-secondary)]",
                                          s.level >= 3 ? "ml-4" : "",
                                        )}
                                      >
                                        <span className="mr-1 font-mono text-[10px] text-[var(--text-tertiary)]">
                                          H{s.level}
                                        </span>
                                        <span className="font-medium text-[var(--text-primary)]">
                                          {s.heading}
                                        </span>
                                        {s.notes ? (
                                          <span className="ml-1 text-[var(--text-tertiary)]">
                                            — {s.notes}
                                          </span>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch gap-2 md:w-auto md:items-end">
                      <button
                        type="button"
                        disabled={busyId === b.id || b.status !== "pending"}
                        onClick={() => void decide(b.id, "approved")}
                        className={cn(
                          "rounded bg-[var(--success)] px-3 py-1.5 text-xs font-medium text-white",
                          "hover:opacity-90 disabled:opacity-40",
                        )}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === b.id || b.status !== "pending"}
                        onClick={() => void decide(b.id, "rejected")}
                        className={cn(
                          "rounded border border-[var(--error)] px-3 py-1.5 text-xs font-medium text-[var(--error)]",
                          "hover:bg-[var(--error-light)] disabled:opacity-40",
                        )}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={busyId === b.id || !canGenerate}
                        onClick={() => void generateArticle(b)}
                        className={cn(
                          "rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white",
                          "hover:opacity-90 disabled:opacity-40",
                        )}
                      >
                        {busyId === b.id ? "Working..." : "Generate article"}
                      </button>
                      {b.written_article_id && (
                        <Link
                          href={`/app/articles/${b.written_article_id}`}
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
