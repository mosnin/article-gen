"use client";

import type { AgentEvent } from "@/lib/agent-runs";
import { cn } from "@/lib/utils";
import { SubagentBadge } from "./SubagentBadge";
import { StreamingCursor } from "./StreamingCursor";

export function StepEvent({ event }: { event: AgentEvent }) {
  const kind = event.kind;

  if (kind === "agent_started") {
    return (
      <Row icon="●">
        <SubagentBadge name={event.agent_name ?? "agent"} state="running" />
        <span className="text-[var(--text-tertiary)] text-xs">starting</span>
        <StreamingCursor />
      </Row>
    );
  }
  if (kind === "agent_ended") {
    return (
      <Row icon="✓">
        <SubagentBadge
          name={event.agent_name ?? "agent"}
          state={event.message?.includes("error") ? "error" : "done"}
          duration={event.duration_ms ?? undefined}
        />
      </Row>
    );
  }
  if (kind === "tool_started") {
    return (
      <Row icon="→" indent>
        <code className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-xs">
          {event.tool_name ?? "tool"}
        </code>
        {event.payload != null && (
          <span className="text-[var(--text-tertiary)] text-xs truncate max-w-[60ch]">
            {previewPayload(event.payload)}
          </span>
        )}
        <StreamingCursor />
      </Row>
    );
  }
  if (kind === "tool_ended") {
    return (
      <Row icon="✓" indent>
        <code className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-xs">
          {event.tool_name ?? "tool"}
        </code>
        {event.duration_ms != null && (
          <span className="text-[var(--text-tertiary)] text-[10px]">{event.duration_ms}ms</span>
        )}
        {event.message && (
          <span className="text-[var(--error)] text-xs">{event.message}</span>
        )}
      </Row>
    );
  }
  if (kind === "message") {
    return (
      <Row icon="💬" indent>
        <span className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
          {event.message}
        </span>
      </Row>
    );
  }
  if (kind === "warning") {
    return (
      <Row icon="!">
        <span className="rounded bg-[var(--warning-light)] px-2 py-0.5 text-xs text-[var(--warning)]">
          {event.message}
        </span>
      </Row>
    );
  }
  if (kind === "run_started") {
    return <Row icon="▶">Run started</Row>;
  }
  if (kind === "run_completed") {
    return <Row icon="✓">Run completed</Row>;
  }
  if (kind === "run_failed") {
    return (
      <Row icon="✗">
        <span className="text-[var(--error)]">{event.message ?? "Run failed"}</span>
      </Row>
    );
  }
  if (kind === "progress") {
    return (
      <Row icon="…" indent>
        <span className="text-xs text-[var(--text-tertiary)]">{event.message}</span>
      </Row>
    );
  }
  if (kind === "handoff") {
    return (
      <Row icon="↪" indent>
        <span className="text-xs">{event.message ?? "handoff"}</span>
      </Row>
    );
  }
  return null;
}

function Row({
  icon,
  indent,
  children,
}: {
  icon: string;
  indent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1 font-mono text-sm",
        indent && "pl-6",
      )}
    >
      <span
        aria-hidden="true"
        className="w-4 shrink-0 text-center text-[var(--text-tertiary)]"
      >
        {icon}
      </span>
      {children}
    </div>
  );
}

function previewPayload(p: unknown): string {
  if (p == null) return "";
  try {
    const s = typeof p === "string" ? p : JSON.stringify(p);
    return s.length > 120 ? s.slice(0, 120) + "..." : s;
  } catch {
    return "";
  }
}
