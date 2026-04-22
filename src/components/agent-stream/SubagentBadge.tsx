"use client";

import { cn } from "@/lib/utils";

type State = "idle" | "running" | "done" | "error";

export function SubagentBadge({
  name,
  state = "idle",
  duration,
  className,
}: {
  name: string;
  state?: State;
  duration?: number;
  className?: string;
}) {
  const color = {
    idle: "bg-[var(--surface-sunken)] text-[var(--text-tertiary)] border-[var(--border-default)]",
    running: "bg-[var(--accent-light)] text-[var(--accent)] border-[var(--accent)]",
    done: "bg-[var(--success-light)] text-[var(--success)] border-[var(--success)]",
    error: "bg-[var(--error-light)] text-[var(--error)] border-[var(--error)]",
  }[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        color,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          state === "running" && "animate-pulse bg-current",
          state === "idle" && "bg-current opacity-40",
          state === "done" && "bg-current",
          state === "error" && "bg-current",
        )}
      />
      {name}
      {duration != null && state === "done" && (
        <span className="text-[10px] text-[var(--text-tertiary)]">{formatDuration(duration)}</span>
      )}
    </span>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 1000)}s`;
}
