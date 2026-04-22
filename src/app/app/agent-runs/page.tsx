"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AgentRun } from "@/lib/agent-runs";
import { AgentRunRow } from "@/components/agent-runs/AgentRunRow";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | AgentRun["status"];
type KindFilter = "all" | AgentRun["kind"];

export default function AgentRunsPage() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kind, setKind] = useState<KindFilter>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/agent/runs?limit=100", { cache: "no-store" });
      if (!resp.ok) throw new Error(`load failed: ${resp.status}`);
      const data = (await resp.json()) as { runs: AgentRun[] };
      setRuns(data.runs ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 20_000);
    return () => clearInterval(t);
  }, [refresh]);

  const filtered = useMemo(
    () =>
      runs.filter(
        (r) =>
          (status === "all" || r.status === status) &&
          (kind === "all" || r.kind === kind),
      ),
    [runs, status, kind],
  );

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Agent runs</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Live and historical runs of the agentic article pipeline.
          </p>
        </div>
        <Link
          href="/app/generate?mode=agent"
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Start new run
        </Link>
      </header>

      <div className="mb-4 flex items-center gap-3">
        <Filter label="Status" value={status} onChange={(v) => setStatus(v as StatusFilter)}
          options={["all", "pending", "running", "succeeded", "failed", "cancelled"]} />
        <Filter label="Kind" value={kind} onChange={(v) => setKind(v as KindFilter)}
          options={["all", "article", "autopilot", "cluster", "research_only"]} />
        <button
          onClick={() => void refresh()}
          className="ml-auto rounded border border-[var(--border-default)] px-3 py-1.5 text-xs hover:bg-[var(--surface-sunken)]"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--danger)] bg-[var(--danger-light)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-sunken)] text-xs uppercase tracking-wider text-[var(--text-tertiary)]">
            <tr>
              <th className="px-4 py-2 text-left">Topic</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Progress</th>
              <th className="px-4 py-2 text-left">Kind</th>
              <th className="px-4 py-2 text-left">Created</th>
              <th className="px-4 py-2 text-left">Duration</th>
              <th className="px-4 py-2 text-left">Credits</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {isLoading && runs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[var(--text-tertiary)]">
                  Loading runs...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[var(--text-tertiary)]">
                  No agent runs yet.{" "}
                  <Link href="/app/generate?mode=agent" className="text-[var(--accent)] hover:underline">
                    Start one from Generate
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              filtered.map((r) => <AgentRunRow key={r.id} run={r} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
      {label}:
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "rounded border border-[var(--border-default)] bg-[var(--surface)] px-2 py-1 text-xs",
          "focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]",
        )}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
