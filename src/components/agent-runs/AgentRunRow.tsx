"use client";

import Link from "next/link";
import type { AgentRun } from "@/lib/agent-runs";
import { cn } from "@/lib/utils";

export function AgentRunRow({ run }: { run: AgentRun }) {
  const statusColor = {
    pending: "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]",
    running: "bg-[var(--accent-light)] text-[var(--accent)]",
    succeeded: "bg-[var(--success-light)] text-[var(--success)]",
    failed: "bg-[var(--danger-light)] text-[var(--danger)]",
    cancelled: "bg-[var(--surface-sunken)] text-[var(--text-secondary)]",
  }[run.status];

  const duration = computeDuration(run);
  const created = formatRelative(run.created_at);

  return (
    <tr className="hover:bg-[var(--surface-sunken)]">
      <td className="px-4 py-3">
        <Link
          href={`/app/agent-runs/${run.id}`}
          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
        >
          {run.topic}
        </Link>
        {run.focus_keyword && (
          <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">{run.focus_keyword}</div>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusColor)}>
          {run.status}
        </span>
      </td>
      <td className="px-4 py-3 w-40">
        <div className="h-1.5 w-full rounded-full bg-[var(--surface-sunken)]">
          <div
            className="h-1.5 rounded-full bg-[var(--accent)] transition-all"
            style={{ width: `${Math.max(0, Math.min(100, run.progress_pct))}%` }}
          />
        </div>
        <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">{run.progress_pct}%</div>
      </td>
      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{run.kind}</td>
      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{created}</td>
      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{duration}</td>
      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{run.credits_charged}</td>
    </tr>
  );
}

function computeDuration(run: AgentRun): string {
  if (!run.started_at) return "—";
  const end = run.completed_at ? new Date(run.completed_at) : new Date();
  const start = new Date(run.started_at);
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return "—";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}
