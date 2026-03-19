"use client";

import { CopyButton } from "./CopyButton";

export function OutputCard({
  label,
  content,
  large,
}: {
  label: string;
  content: string;
  large?: boolean;
}) {
  return (
    <div
      className="rounded-xl border"
      style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
    >
      <div
        className="flex items-center justify-between border-b px-5 py-3"
        style={{ borderColor: "var(--card-border)" }}
      >
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--muted)" }}
        >
          {label}
        </h3>
        <CopyButton text={content} />
      </div>
      <div className={`px-5 py-4 ${large ? "max-h-[600px] overflow-y-auto" : ""}`}>
        {large ? (
          <pre
            className="whitespace-pre-wrap text-sm leading-relaxed"
            style={{
              color: "var(--foreground)",
              fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace",
            }}
          >
            {content}
          </pre>
        ) : (
          <p className="text-base leading-relaxed" style={{ color: "var(--foreground)" }}>
            {content}
          </p>
        )}
      </div>
    </div>
  );
}
