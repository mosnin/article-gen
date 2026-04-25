"use client";

import { useEffect, useRef, useState } from "react";
import { useAgentRun } from "@/hooks/useAgentRun";
import { StepEvent } from "./StepEvent";
import { cn } from "@/lib/utils";

export function AgentStream({
  runId,
  className,
  onComplete,
}: {
  runId: string;
  className?: string;
  onComplete?: (articleId: string | null) => void;
}) {
  const { run, events, isLoading, error, status, transport } = useAgentRun(runId);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  useEffect(() => {
    if (!run) return;
    if (status === "succeeded") onComplete?.(run.article_id ?? null);
  }, [run, status, onComplete]);

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events.length, autoScroll]);

  if (!runId) return null;
  if (isLoading && events.length === 0) {
    return (
      <div className={cn("rounded-lg border border-[var(--border-default)] p-6", className)}>
        <p className="text-sm text-[var(--text-secondary)]">Loading run...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className={cn("rounded-lg border border-[var(--error)] p-4 text-sm text-[var(--error)]", className)}>
        {error.message}
      </div>
    );
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom > 50) {
      if (autoScroll) setAutoScroll(false);
    } else if (distanceFromBottom <= 50) {
      if (!autoScroll) setAutoScroll(true);
    }
  };

  const handleToggleAutoScroll = () => {
    if (autoScroll) {
      setAutoScroll(false);
    } else {
      setAutoScroll(true);
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  };

  return (
    <div className={cn("rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)]", className)}>
      <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
        <div className="flex items-center gap-3">
          <StatusChip status={status} />
          <span className="text-sm font-medium text-[var(--text-primary)]">{run?.topic}</span>
          {run?.current_step && (
            <span className="text-xs text-[var(--text-tertiary)]">· {run.current_step}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
            {transport}
          </span>
          <button
            type="button"
            onClick={handleToggleAutoScroll}
            aria-pressed={!autoScroll}
            className="rounded border border-[var(--border-strong)] px-2 py-0.5 text-xs hover:bg-[var(--surface-sunken)]"
          >
            {autoScroll ? "Pause" : "Resume"}
          </button>
        </div>
      </div>
      {typeof run?.progress_pct === "number" && (
        <div className="h-1 w-full bg-[var(--surface-sunken)]">
          <div
            className="h-1 bg-[var(--accent)] transition-all"
            style={{ width: `${run.progress_pct}%` }}
          />
        </div>
      )}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        aria-live="polite"
        aria-relevant="additions"
        className="max-h-[480px] overflow-y-auto px-4 py-2"
      >
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-tertiary)]">Waiting for agent output...</p>
        ) : (
          events.map((ev) => <StepEvent key={ev.id} event={ev} />)
        )}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string | null }) {
  const color = {
    pending: "bg-[var(--surface-sunken)] text-[var(--text-tertiary)]",
    running: "bg-[var(--accent-light)] text-[var(--accent)]",
    succeeded: "bg-[var(--success-light)] text-[var(--success)]",
    failed: "bg-[var(--error-light)] text-[var(--error)]",
    cancelled: "bg-[var(--surface-sunken)] text-[var(--text-secondary)]",
  }[status ?? "pending"];
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", color)}>
      {status ?? "pending"}
    </span>
  );
}
