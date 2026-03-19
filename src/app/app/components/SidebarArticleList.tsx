"use client";

import type { ArticleSession } from "../types";

interface SidebarArticleListProps {
  sessions: ArticleSession[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  getStepLabel: (session: ArticleSession) => string;
}

export function SidebarArticleList({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
  getStepLabel,
}: SidebarArticleListProps) {
  return (
    <div className="space-y-1">
      {sessions.map((session) => (
        <button
          key={session.id}
          onClick={() => onSelect(session.id)}
          className="group flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors"
          style={{
            background:
              activeSessionId === session.id ? "var(--card)" : "transparent",
          }}
          onMouseEnter={(e) => {
            if (activeSessionId !== session.id)
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(0,0,0,0.04)";
          }}
          onMouseLeave={(e) => {
            if (activeSessionId !== session.id)
              (e.currentTarget as HTMLButtonElement).style.background =
                "transparent";
          }}
        >
          <span className="mt-0.5 flex-shrink-0">
            {session.queued ? (
              <span
                className="block h-2 w-2 rounded-full"
                style={{ background: "var(--card-border)" }}
              />
            ) : session.loading ? (
              <span
                className="sidebar-pulse block h-2 w-2 rounded-full"
                style={{ background: "var(--accent)" }}
              />
            ) : session.error ? (
              <span
                className="block h-2 w-2 rounded-full"
                style={{ background: "var(--error)" }}
              />
            ) : session.posted ? (
              <span
                className="block h-2 w-2 rounded-full"
                style={{ background: "var(--success)" }}
              />
            ) : (
              <span
                className="block h-2 w-2 rounded-full"
                style={{ background: "#007aff" }}
              />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block truncate text-sm"
              style={{ color: "var(--foreground)" }}
            >
              {session.result?.title || session.topic}
            </span>
            {session.queued && (
              <span
                className="block truncate text-xs"
                style={{ color: "var(--muted)" }}
              >
                Queued
              </span>
            )}
            {session.loading && (
              <span
                className="block truncate text-xs"
                style={{ color: "var(--muted)" }}
              >
                {getStepLabel(session)}
              </span>
            )}
            {session.error && (
              <span
                className="block truncate text-xs"
                style={{ color: "var(--error)" }}
              >
                Failed
              </span>
            )}
          </span>
          <span
            className="mt-0.5 flex-shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-black/5 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(session.id);
            }}
            style={{ color: "var(--muted)" }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </span>
        </button>
      ))}
    </div>
  );
}
