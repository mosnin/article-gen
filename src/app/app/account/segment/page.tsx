"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AudienceLevel = "beginner" | "intermediate" | "advanced" | "mixed";

type UserSegment = {
  id: string;
  user_id: string;
  run_id: string | null;
  persona_label: string;
  persona_description: string;
  industry: string | null;
  business_model: string | null;
  audience_technical_level: AudienceLevel | null;
  primary_goals: string[];
  brand_voice: string | null;
  content_pillars: string[];
  tone_keywords: string[];
  confidence: number;
  created_at: string;
};

const HISTORY_PAGE_SIZE = 20;

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString();
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString();
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function normalizeRow(raw: Record<string, unknown>): UserSegment {
  const level = raw.audience_technical_level;
  const allowed: ReadonlyArray<AudienceLevel> = [
    "beginner",
    "intermediate",
    "advanced",
    "mixed",
  ];
  const audienceTechnicalLevel: AudienceLevel | null =
    typeof level === "string" && (allowed as readonly string[]).includes(level)
      ? (level as AudienceLevel)
      : null;
  const conf = typeof raw.confidence === "number" ? raw.confidence : 0;
  return {
    id: String(raw.id ?? ""),
    user_id: String(raw.user_id ?? ""),
    run_id:
      typeof raw.run_id === "string" || raw.run_id === null
        ? (raw.run_id as string | null)
        : null,
    persona_label: typeof raw.persona_label === "string" ? raw.persona_label : "",
    persona_description:
      typeof raw.persona_description === "string" ? raw.persona_description : "",
    industry: typeof raw.industry === "string" ? raw.industry : null,
    business_model:
      typeof raw.business_model === "string" ? raw.business_model : null,
    audience_technical_level: audienceTechnicalLevel,
    primary_goals: asStringArray(raw.primary_goals),
    brand_voice: typeof raw.brand_voice === "string" ? raw.brand_voice : null,
    content_pillars: asStringArray(raw.content_pillars),
    tone_keywords: asStringArray(raw.tone_keywords),
    confidence: conf,
    created_at: typeof raw.created_at === "string" ? raw.created_at : "",
  };
}

function confidencePillClass(conf: number): string {
  if (conf >= 0.7) return "bg-[var(--success-light)] text-[var(--success)]";
  if (conf >= 0.4) return "bg-[var(--warning-light)] text-[var(--warning)]";
  return "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]";
}

function levelLabel(l: AudienceLevel | null): string {
  if (!l) return "—";
  return l.charAt(0).toUpperCase() + l.slice(1);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UserSegmentPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [latest, setLatest] = useState<UserSegment | null>(null);
  const [history, setHistory] = useState<UserSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Initial fetch (auth + latest snapshot).
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

      const { data, error: qerr } = await supabase
        .from("user_segments")
        .select("*")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (qerr) {
        setError(qerr.message);
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      setLatest(rows.length > 0 ? normalizeRow(rows[0]) : null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Realtime: any new user_segments row for this user moves to "latest".
  useEffect(() => {
    if (!userId) return;
    const chan = supabase
      .channel(`user-segments-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_segments",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {
            const row = normalizeRow(payload.new as Record<string, unknown>);
            setLatest((prev) => {
              if (!prev) return row;
              return Date.parse(row.created_at) > Date.parse(prev.created_at)
                ? row
                : prev;
            });
            // If history is already loaded, prepend.
            if (historyLoaded) {
              setHistory((prev) => {
                if (prev.some((r) => r.id === row.id)) return prev;
                return [row, ...prev].slice(0, HISTORY_PAGE_SIZE);
              });
            }
          } else if (payload.eventType === "DELETE" && payload.old) {
            const oldId = (payload.old as { id?: string }).id ?? "";
            setLatest((prev) => (prev && prev.id === oldId ? null : prev));
            setHistory((prev) => prev.filter((r) => r.id !== oldId));
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(chan);
    };
  }, [supabase, userId, historyLoaded]);

  async function loadHistory(): Promise<void> {
    if (!userId || historyLoaded) return;
    const { data, error: qerr } = await supabase
      .from("user_segments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_PAGE_SIZE);
    if (qerr) {
      setError(qerr.message);
      return;
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    setHistory(rows.map(normalizeRow));
    setHistoryLoaded(true);
  }

  async function refreshSegment(): Promise<void> {
    setDispatching(true);
    setError(null);
    try {
      const resp = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "user_segment",
          // The segment agent only needs userId (read from session by the
          // route), but the dispatch endpoint expects a `topic` field — pass
          // a placeholder; the agent ignores it.
          topic: "user-segment-refresh",
          quality: "standard",
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Failed to dispatch: ${t}`);
      }
      const { runId } = (await resp.json()) as { runId: string };
      router.push(`/app/agent-runs/${runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDispatching(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Audience segment
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            An auto-inferred persona + content posture distilled from your
            niche, autonomous schedules, and recently-published articles.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={dispatching}
            onClick={() => void refreshSegment()}
            className={cn(
              "rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white",
              "hover:opacity-90 disabled:opacity-40",
            )}
          >
            {dispatching ? "Dispatching..." : "Refresh my segment"}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-[var(--error)] bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-12 text-center text-sm text-[var(--text-tertiary)]">
          Loading segment...
        </div>
      ) : !latest ? (
        <div className="rounded-lg border border-dashed border-[var(--border-default)] bg-[var(--surface-raised)] p-12 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            No segment snapshot yet. Generate one to see your inferred audience
            persona, content pillars, and brand voice.
          </p>
          <button
            type="button"
            disabled={dispatching}
            onClick={() => void refreshSegment()}
            className={cn(
              "mt-4 rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white",
              "hover:opacity-90 disabled:opacity-40",
            )}
          >
            {dispatching ? "Dispatching..." : "Generate my segment"}
          </button>
        </div>
      ) : (
        <>
          {/* Persona card */}
          <section
            className={cn(
              "rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-6",
              "shadow-sm",
            )}
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                  {latest.persona_label}
                </h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {latest.persona_description}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
                  confidencePillClass(latest.confidence),
                )}
                title="Agent confidence (0-1)"
              >
                Confidence: {(latest.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </section>

          {/* Industry / business model / technical level */}
          <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-4">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                Industry
              </div>
              <div className="mt-1 text-sm text-[var(--text-primary)]">
                {latest.industry ?? "—"}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-4">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                Business model
              </div>
              <div className="mt-1 text-sm text-[var(--text-primary)]">
                {latest.business_model ?? "—"}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-4">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                Audience level
              </div>
              <div className="mt-1 text-sm text-[var(--text-primary)]">
                {levelLabel(latest.audience_technical_level)}
              </div>
            </div>
          </section>

          {/* Brand voice blockquote */}
          {latest.brand_voice && (
            <section>
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Brand voice
              </div>
              <blockquote
                className={cn(
                  "rounded-lg border-l-4 border-[var(--accent)] bg-[var(--surface-raised)]",
                  "px-4 py-3 text-sm italic text-[var(--text-primary)]",
                )}
              >
                {latest.brand_voice}
              </blockquote>
            </section>
          )}

          {/* Chip lists */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <ChipList
              title="Primary goals"
              items={latest.primary_goals}
              variant="accent"
            />
            <ChipList
              title="Content pillars"
              items={latest.content_pillars}
              variant="default"
            />
            <ChipList
              title="Tone keywords"
              items={latest.tone_keywords}
              variant="muted"
            />
          </section>

          {/* Footer: snapshot date + history toggle */}
          <section className="flex flex-col gap-2 border-t border-[var(--border-default)] pt-4 text-xs text-[var(--text-tertiary)] md:flex-row md:items-center md:justify-between">
            <div>
              Snapshot: {fmtDateTime(latest.created_at)}
              {latest.run_id && (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={`/app/agent-runs/${latest.run_id}`}
                    className="text-[var(--accent)] hover:underline"
                  >
                    View run
                  </a>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (!historyOpen) void loadHistory();
                setHistoryOpen((v) => !v);
              }}
              className="rounded border border-[var(--border-default)] px-2 py-1 text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
            >
              {historyOpen ? "Hide history" : "View history"}
            </button>
          </section>

          {/* History */}
          {historyOpen && (
            <section className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-4">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">
                Prior snapshots
              </h3>
              {!historyLoaded ? (
                <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                  Loading history...
                </p>
              ) : history.length <= 1 ? (
                <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                  No prior snapshots — this is your first.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {history
                    .filter((r) => r.id !== latest.id)
                    .map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-col gap-1 rounded border border-[var(--border-default)] bg-[var(--surface-base)] p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-[var(--text-primary)]">
                            {r.persona_label}
                          </div>
                          <div className="text-[11px] text-[var(--text-tertiary)]">
                            {fmtDate(r.created_at)} ·{" "}
                            {(r.confidence * 100).toFixed(0)}% confidence
                            {r.industry && ` · ${r.industry}`}
                          </div>
                        </div>
                        {r.run_id && (
                          <a
                            href={`/app/agent-runs/${r.run_id}`}
                            className="text-xs text-[var(--accent)] hover:underline"
                          >
                            View run
                          </a>
                        )}
                      </li>
                    ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChipList({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: "accent" | "default" | "muted";
}): React.JSX.Element {
  const chipClass =
    variant === "accent"
      ? "bg-[var(--accent-light)] text-[var(--accent)]"
      : variant === "muted"
        ? "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]"
        : "bg-[var(--surface-sunken)] text-[var(--text-secondary)]";
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] p-4">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="mt-2 text-xs text-[var(--text-tertiary)]">—</div>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <li
              key={`${it}-${i}`}
              className={cn("rounded-full px-2 py-1 text-[11px]", chipClass)}
            >
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
