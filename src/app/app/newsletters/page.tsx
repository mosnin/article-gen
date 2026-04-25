"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type DigestStatus =
  | "draft"
  | "approved"
  | "scheduled"
  | "sent"
  | "archived"
  | "dismissed";

type NewsletterDigest = {
  id: string;
  user_id: string;
  run_id: string | null;
  period_start: string;
  period_end: string;
  subject: string;
  preheader: string | null;
  intro: string;
  article_ids: string[];
  body_markdown: string;
  body_html: string | null;
  status: DigestStatus;
  scheduled_for: string | null;
  sent_at: string | null;
  external_url: string | null;
  created_at: string;
};

type StatusFilter = DigestStatus | "all";

const FILTER_PILLS: Array<{ key: StatusFilter; label: string }> = [
  { key: "draft", label: "Draft" },
  { key: "approved", label: "Approved" },
  { key: "scheduled", label: "Scheduled" },
  { key: "sent", label: "Sent" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All" },
];

const PAGE_SIZE = 50;

function statusPillClass(s: DigestStatus): string {
  switch (s) {
    case "draft":
      return "bg-[var(--surface-sunken)] text-[var(--text-secondary)]";
    case "approved":
      return "bg-[var(--accent-light)] text-[var(--accent)]";
    case "scheduled":
      return "bg-[var(--warning-light)] text-[var(--warning)]";
    case "sent":
      return "bg-[var(--success-light)] text-[var(--success)]";
    case "archived":
      return "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]";
    case "dismissed":
    default:
      return "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]";
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString();
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString();
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t);
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

async function renderMarkdownSafe(md: string): Promise<string> {
  const raw = (await marked.parse(md ?? "")) as string;
  return DOMPurify.sanitize(raw);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewslettersPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [niche, setNiche] = useState<string>("");
  const [digests, setDigests] = useState<NewsletterDigest[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("draft");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dispatchingPeriod, setDispatchingPeriod] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { subject: string; preheader: string; intro: string }>
  >({});
  const [previewHtml, setPreviewHtml] = useState<Record<string, string>>({});
  const [scheduleDt, setScheduleDt] = useState<Record<string, string>>({});
  const [copyState, setCopyState] = useState<Record<string, string>>({});

  // Initial fetch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (cancelled) return;
      setUserId(u.user.id);

      const { data: settings } = await supabase
        .from("user_settings")
        .select("niche")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (!cancelled) {
        setNiche(((settings as { niche?: string } | null)?.niche ?? "").toString());
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Digests query (re-runs when filter or userId change).
  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    (async () => {
      let q = supabase
        .from("newsletter_digests")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error: qerr } = await q;
      if (cancelled) return;
      if (qerr) {
        setError(qerr.message);
        return;
      }
      setDigests((data ?? []) as NewsletterDigest[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId, filter]);

  // Realtime: newsletter_digests for this user.
  useEffect(() => {
    if (!userId) return;
    const chan = supabase
      .channel(`newsletter-digests-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "newsletter_digests",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newRow = payload.new as NewsletterDigest | undefined;
          const oldRow = payload.old as NewsletterDigest | undefined;
          const matches = (r: NewsletterDigest) =>
            filter === "all" || r.status === filter;
          if (payload.eventType === "INSERT" && newRow) {
            if (!matches(newRow)) return;
            setDigests((prev) => {
              if (prev.some((d) => d.id === newRow.id)) return prev;
              return [newRow, ...prev].slice(0, PAGE_SIZE);
            });
          } else if (payload.eventType === "UPDATE" && newRow) {
            setDigests((prev) => {
              if (!matches(newRow)) {
                return prev.filter((d) => d.id !== newRow.id);
              }
              const exists = prev.some((d) => d.id === newRow.id);
              if (exists) return prev.map((d) => (d.id === newRow.id ? newRow : d));
              return [newRow, ...prev].slice(0, PAGE_SIZE);
            });
          } else if (payload.eventType === "DELETE" && oldRow) {
            setDigests((prev) => prev.filter((d) => d.id !== oldRow.id));
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(chan);
    };
  }, [supabase, userId, filter]);

  // Render markdown previews for visible/expanded digests.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = { ...previewHtml };
      let changed = false;
      for (const d of digests) {
        if (next[d.id]) continue;
        const html = await renderMarkdownSafe(d.body_markdown ?? "");
        if (cancelled) return;
        next[d.id] = html;
        changed = true;
      }
      if (!cancelled && changed) setPreviewHtml(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digests]);

  async function dispatchDigest(periodDays: number): Promise<void> {
    if (!niche.trim()) {
      setError("Set a niche in your settings before generating a digest.");
      return;
    }
    setDispatchingPeriod(periodDays);
    setError(null);
    try {
      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "newsletter_digest",
          topic: niche,
          newsletterPeriodDays: periodDays,
          quality: "standard",
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Failed to dispatch digest: ${t}`);
      }
      const { runId } = (await resp.json()) as { runId: string };
      router.push(`/app/agent-runs/${runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDispatchingPeriod(null);
    }
  }

  function ensureDraft(d: NewsletterDigest): {
    subject: string;
    preheader: string;
    intro: string;
  } {
    return (
      drafts[d.id] ?? {
        subject: d.subject,
        preheader: d.preheader ?? "",
        intro: d.intro ?? "",
      }
    );
  }

  function setDraftField(
    id: string,
    field: "subject" | "preheader" | "intro",
    value: string,
  ): void {
    setDrafts((prev) => {
      const cur = prev[id] ?? {
        subject: "",
        preheader: "",
        intro: "",
      };
      return { ...prev, [id]: { ...cur, [field]: value } };
    });
  }

  async function saveField(
    d: NewsletterDigest,
    field: "subject" | "preheader" | "intro",
  ): Promise<void> {
    const draft = drafts[d.id];
    if (!draft) return;
    const value = draft[field];
    const dbField =
      field === "subject" ? "subject" : field === "preheader" ? "preheader" : "intro";
    setBusyId(d.id);
    const { error: upErr } = await supabase
      .from("newsletter_digests")
      .update({ [dbField]: value })
      .eq("id", d.id);
    setBusyId(null);
    if (upErr) setError(upErr.message);
  }

  async function setStatus(
    d: NewsletterDigest,
    next: DigestStatus,
    extras: Record<string, unknown> = {},
  ): Promise<void> {
    setBusyId(d.id);
    const { error: upErr } = await supabase
      .from("newsletter_digests")
      .update({ status: next, ...extras })
      .eq("id", d.id);
    setBusyId(null);
    if (upErr) setError(upErr.message);
  }

  async function approve(d: NewsletterDigest): Promise<void> {
    if (d.status !== "draft") return;
    await setStatus(d, "approved");
  }

  async function schedule(d: NewsletterDigest): Promise<void> {
    const local = scheduleDt[d.id];
    if (!local) {
      setError("Pick a date/time first.");
      return;
    }
    const t = new Date(local).getTime();
    if (Number.isNaN(t)) {
      setError("Invalid date/time.");
      return;
    }
    await setStatus(d, "scheduled", { scheduled_for: new Date(t).toISOString() });
  }

  async function markSent(d: NewsletterDigest): Promise<void> {
    const externalUrl = window.prompt(
      "Optional external URL (e.g. Beehiiv/Mailchimp send link). Leave blank to skip.",
      d.external_url ?? "",
    );
    const extras: Record<string, unknown> = { sent_at: new Date().toISOString() };
    if (externalUrl !== null) {
      const trimmed = externalUrl.trim();
      extras.external_url = trimmed.length > 0 ? trimmed : null;
    }
    await setStatus(d, "sent", extras);
  }

  async function archive(d: NewsletterDigest): Promise<void> {
    await setStatus(d, "archived");
  }

  async function dismiss(d: NewsletterDigest): Promise<void> {
    if (!confirm("Dismiss this digest? It will be hidden from active filters.")) return;
    await setStatus(d, "dismissed");
  }

  async function copyText(id: string, label: string, text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState((p) => ({ ...p, [`${id}:${label}`]: "Copied!" }));
      setTimeout(() => {
        setCopyState((p) => {
          const next = { ...p };
          delete next[`${id}:${label}`];
          return next;
        });
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Copy failed");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Newsletters</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Auto-composed editorial digests of your recently-published articles.
          </p>
          {niche && (
            <span className="mt-2 inline-block rounded-full bg-[var(--accent-light)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
              Niche: {niche}
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={dispatchingPeriod !== null || !niche.trim()}
            onClick={() => void dispatchDigest(7)}
            className={cn(
              "rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white",
              "hover:opacity-90 disabled:opacity-40",
            )}
          >
            {dispatchingPeriod === 7 ? "Dispatching..." : "Generate weekly digest"}
          </button>
          <button
            type="button"
            disabled={dispatchingPeriod !== null || !niche.trim()}
            onClick={() => void dispatchDigest(30)}
            className={cn(
              "rounded border border-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent)]",
              "hover:bg-[var(--accent-light)] disabled:opacity-40",
            )}
          >
            {dispatchingPeriod === 30 ? "Dispatching..." : "Generate monthly digest"}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-[var(--error)] bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_PILLS.map((p) => {
          const active = p.key === filter;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setFilter(p.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                active
                  ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]"
                  : "border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-12 text-center text-sm text-[var(--text-tertiary)]">
          Loading digests...
        </div>
      ) : digests.length === 0 ? (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-12 text-center text-sm text-[var(--text-tertiary)]">
          No digests in the {filter} state. Use the buttons above to generate one.
        </div>
      ) : (
        <ul className="space-y-3">
          {digests.map((d) => {
            const expanded = expandedId === d.id;
            const draft = ensureDraft(d);
            const html = previewHtml[d.id] ?? "";
            return (
              <li
                key={d.id}
                className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)]"
              >
                {/* Row header (clickable) */}
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : d.id)}
                  className="flex w-full flex-col gap-2 p-4 text-left md:flex-row md:items-start md:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-[var(--text-primary)]">
                        {d.subject}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                          statusPillClass(d.status),
                        )}
                      >
                        {d.status}
                      </span>
                      <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                        {(d.article_ids?.length ?? 0)} articles
                      </span>
                    </div>
                    {d.preheader && (
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {d.preheader}
                      </p>
                    )}
                    <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                      Period: {fmtDate(d.period_start)} – {fmtDate(d.period_end)} · Created:{" "}
                      {fmtDate(d.created_at)}
                      {d.scheduled_for && ` · Scheduled: ${fmtDateTime(d.scheduled_for)}`}
                      {d.sent_at && ` · Sent: ${fmtDateTime(d.sent_at)}`}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--text-tertiary)]">
                    {expanded ? "Hide" : "Open"}
                  </span>
                </button>

                {/* Expanded body */}
                {expanded && (
                  <div className="space-y-4 border-t border-[var(--border-default)] p-4">
                    {/* Editable fields */}
                    <div className="grid grid-cols-1 gap-3">
                      <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
                        Subject
                        <textarea
                          value={draft.subject}
                          rows={2}
                          onChange={(e) => setDraftField(d.id, "subject", e.target.value)}
                          onBlur={() => void saveField(d, "subject")}
                          className="rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
                        />
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                          {draft.subject.length} chars (target 50-70)
                        </span>
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
                        Preheader
                        <textarea
                          value={draft.preheader}
                          rows={2}
                          onChange={(e) =>
                            setDraftField(d.id, "preheader", e.target.value)
                          }
                          onBlur={() => void saveField(d, "preheader")}
                          className="rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
                        />
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                          {draft.preheader.length} chars (target 110-130)
                        </span>
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
                        Intro
                        <textarea
                          value={draft.intro}
                          rows={4}
                          onChange={(e) => setDraftField(d.id, "intro", e.target.value)}
                          onBlur={() => void saveField(d, "intro")}
                          className="rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
                        />
                      </label>
                    </div>

                    {/* Rendered body preview */}
                    <div>
                      <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
                        Body preview
                      </div>
                      <div
                        className="prose prose-sm max-w-none rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] p-4 text-sm text-[var(--text-primary)]"
                        dangerouslySetInnerHTML={{ __html: html }}
                      />
                    </div>

                    {/* Article ID list */}
                    {d.article_ids && d.article_ids.length > 0 && (
                      <div>
                        <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
                          Included articles
                        </div>
                        <ul className="flex flex-wrap gap-2">
                          {d.article_ids.map((aid) => (
                            <li key={aid}>
                              <Link
                                href={`/app/articles/${aid}`}
                                className="rounded-full border border-[var(--border-default)] px-2 py-1 font-mono text-[11px] text-[var(--accent)] hover:bg-[var(--surface-sunken)]"
                              >
                                {aid.slice(0, 8)}…
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Copy buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copyText(d.id, "subject", d.subject)}
                        className="rounded border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                      >
                        {copyState[`${d.id}:subject`] ?? "Copy subject"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void copyText(d.id, "markdown", d.body_markdown ?? "")
                        }
                        className="rounded border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                      >
                        {copyState[`${d.id}:markdown`] ?? "Copy body markdown"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyText(d.id, "html", html)}
                        className="rounded border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                      >
                        {copyState[`${d.id}:html`] ?? "Copy body HTML"}
                      </button>
                    </div>

                    {/* Lifecycle actions */}
                    <div className="flex flex-wrap items-end gap-2 border-t border-[var(--border-default)] pt-4">
                      <button
                        type="button"
                        disabled={busyId === d.id || d.status !== "draft"}
                        onClick={() => void approve(d)}
                        className={cn(
                          "rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white",
                          "hover:opacity-90 disabled:opacity-40",
                        )}
                      >
                        Approve
                      </button>

                      <div className="flex items-end gap-2">
                        <label className="flex flex-col gap-1 text-[10px] text-[var(--text-secondary)]">
                          Schedule for
                          <input
                            type="datetime-local"
                            value={
                              scheduleDt[d.id] ??
                              isoToLocalInput(d.scheduled_for)
                            }
                            onChange={(e) =>
                              setScheduleDt((p) => ({ ...p, [d.id]: e.target.value }))
                            }
                            className="rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] px-2 py-1 text-xs text-[var(--text-primary)]"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={
                            busyId === d.id ||
                            (d.status !== "draft" && d.status !== "approved")
                          }
                          onClick={() => void schedule(d)}
                          className="rounded border border-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-light)] disabled:opacity-40"
                        >
                          Schedule
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={busyId === d.id || d.status === "sent"}
                        onClick={() => void markSent(d)}
                        className="rounded border border-[var(--success)] px-3 py-1.5 text-xs font-medium text-[var(--success)] hover:bg-[var(--success-light)] disabled:opacity-40"
                      >
                        Mark sent
                      </button>

                      <button
                        type="button"
                        disabled={busyId === d.id || d.status === "archived"}
                        onClick={() => void archive(d)}
                        className="rounded border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] disabled:opacity-40"
                      >
                        Archive
                      </button>

                      <button
                        type="button"
                        disabled={busyId === d.id || d.status === "dismissed"}
                        onClick={() => void dismiss(d)}
                        className="rounded border border-[var(--error)] px-3 py-1.5 text-xs text-[var(--error)] hover:bg-[var(--error-light)] disabled:opacity-40"
                      >
                        Dismiss
                      </button>

                      {d.external_url && (
                        <a
                          href={d.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-xs text-[var(--accent)] hover:underline"
                        >
                          External send link ↗
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
