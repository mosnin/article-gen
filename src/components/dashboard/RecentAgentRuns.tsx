"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AgentRun } from "@/lib/agent-runs";
import { cn } from "@/lib/utils";

export function RecentAgentRuns({ className }: { className?: string }) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/agent/runs?limit=5", { cache: "no-store" });
        const data = await resp.json();
        if (!cancelled) setRuns(data.runs ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const statusColor = (s: string) => {
    switch (s) {
      case "running": return "bg-[var(--accent-light)] text-[var(--accent)]";
      case "succeeded": return "bg-[var(--success-light)] text-[var(--success)]";
      case "failed": return "bg-[var(--error-light)] text-[var(--error)]";
      case "cancelled": return "bg-[var(--surface-sunken)] text-[var(--text-secondary)]";
      default: return "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]";
    }
  };

  return (
    <section className={cn("rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)]", className)}>
      <header className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recent agent runs</h2>
        <Link href="/app/agent-runs" className="text-xs text-[var(--accent)] hover:underline">View all</Link>
      </header>
      <div className="divide-y divide-[var(--border-default)]">
        {isLoading && runs.length === 0 ? (
          <p className="p-4 text-sm text-[var(--text-tertiary)]">Loading...</p>
        ) : error ? (
          <p className="p-4 text-sm text-[var(--error)]">{error}</p>
        ) : runs.length === 0 ? (
          <p className="p-4 text-sm text-[var(--text-tertiary)]">
            No agent runs yet.{" "}
            <Link href="/app/generate?mode=agent" className="text-[var(--accent)] hover:underline">Start one</Link>.
          </p>
        ) : (
          runs.map((r) => (
            <Link
              key={r.id}
              href={`/app/agent-runs/${r.id}`}
              className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-[var(--surface-sunken)]"
            >
              <span className="truncate text-sm text-[var(--text-primary)]">{r.topic}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px]", statusColor(r.status))}>
                  {r.status}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)]">{relativeTime(r.created_at)}</span>
              </span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}
