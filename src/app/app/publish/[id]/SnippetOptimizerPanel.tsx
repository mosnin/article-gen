"use client";

import { useState } from "react";

export interface SnippetOpportunity {
  keyword: string;
  snippetType: "paragraph" | "list" | "table" | "how-to" | "none";
  currentSnippetOwner: string | null;
  rewrittenSection: string;
  targetHeading: string;
  tips: string[];
}

interface Props {
  focusKeyword: string;
  articleContent: string;
  onApplySection: (section: string) => void;
}

const SNIPPET_TYPE_META: Record<
  SnippetOpportunity["snippetType"],
  { emoji: string; label: string; color: string; bg: string }
> = {
  paragraph: { emoji: "📝", label: "Paragraph", color: "#0369a1", bg: "rgba(3,105,161,0.08)" },
  list:      { emoji: "📋", label: "List",      color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
  table:     { emoji: "📊", label: "Table",     color: "#0f766e", bg: "rgba(15,118,110,0.08)" },
  "how-to":  { emoji: "🔧", label: "How-To",   color: "#c2410c", bg: "rgba(194,65,12,0.08)"  },
  none:      { emoji: "–",  label: "None",      color: "var(--muted)", bg: "rgba(0,0,0,0.04)" },
};

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };
  return (
    <button
      onClick={handleCopy}
      style={{
        padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
        background: copied ? "rgba(52,199,89,0.12)" : "var(--background)",
        color: copied ? "var(--success)" : "var(--accent)",
        border: `1px solid ${copied ? "var(--success)" : "var(--accent)"}`,
        cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
      }}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

export default function SnippetOptimizerPanel({ focusKeyword, articleContent, onApplySection }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SnippetOpportunity | null>(null);
  const [apiError, setApiError] = useState("");
  const [applied, setApplied] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setApiError("");
    setResult(null);
    setApplied(false);
    try {
      const res = await fetch("/api/serp/snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: focusKeyword, content: articleContent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error || "Failed to analyze snippet opportunity");
      } else {
        setResult(data as SnippetOpportunity);
      }
    } catch {
      setApiError("Network error — please try again");
    }
    setLoading(false);
  };

  const handleApply = () => {
    if (result?.rewrittenSection) {
      onApplySection(result.rewrittenSection);
      setApplied(true);
    }
  };

  const snippetMeta = result ? SNIPPET_TYPE_META[result.snippetType] : null;

  return (
    <div style={{ marginTop: 16 }}>
      {/* Trigger button */}
      <button
        onClick={() => { setOpen((v) => !v); if (!open && !result) handleAnalyze(); }}
        style={{
          width: "100%", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: open ? "var(--background)" : "var(--card)",
          border: `1px solid ${open ? "var(--accent)" : "var(--card-border)"}`,
          color: open ? "var(--accent)" : "var(--foreground)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
          transition: "all 0.15s",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15 }}>🎯</span>
          Featured Snippet Optimizer
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          marginTop: 8, background: "var(--card)", border: "1px solid var(--card-border)",
          borderRadius: 12, overflow: "hidden",
        }}>
          {/* Panel header */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--card-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Featured Snippet Analysis</div>
              {focusKeyword && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  Keyword: <strong style={{ color: "var(--foreground)" }}>{focusKeyword}</strong>
                </div>
              )}
            </div>
            {!loading && (
              <button
                onClick={handleAnalyze}
                style={{
                  padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                  background: "var(--background)", border: "1px solid var(--card-border)",
                  color: "var(--muted)", cursor: "pointer",
                }}
              >
                Re-analyze
              </button>
            )}
          </div>

          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Loading state */}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", color: "var(--muted)", fontSize: 13 }}>
                <svg className="progress-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                Analyzing SERP for snippet opportunities…
              </div>
            )}

            {/* Error state */}
            {apiError && !loading && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", color: "var(--error)", fontSize: 13 }}>
                {apiError}
              </div>
            )}

            {/* Results */}
            {result && !loading && (
              <>
                {/* Snippet type badge + owner */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {snippetMeta && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                      background: snippetMeta.bg, color: snippetMeta.color,
                    }}>
                      {snippetMeta.emoji} {snippetMeta.label}
                    </span>
                  )}
                  {result.currentSnippetOwner && (
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      Current owner: <strong style={{ color: "var(--foreground)" }}>{result.currentSnippetOwner}</strong>
                    </span>
                  )}
                  {!result.currentSnippetOwner && result.snippetType !== "none" && (
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>No clear snippet owner</span>
                  )}
                </div>

                {/* Target Heading */}
                {result.targetHeading && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Suggested Heading
                    </div>
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                      padding: "10px 14px", borderRadius: 8,
                      background: "var(--background)", border: "1px solid var(--card-border)",
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", flex: 1, minWidth: 0, wordBreak: "break-word" }}>
                        {result.targetHeading}
                      </span>
                      <CopyButton text={result.targetHeading} />
                    </div>
                  </div>
                )}

                {/* Rewritten Section */}
                {result.rewrittenSection && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Optimized Section
                    </div>
                    <textarea
                      readOnly
                      value={result.rewrittenSection}
                      rows={8}
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 12, lineHeight: 1.6,
                        border: "1px solid var(--card-border)", background: "var(--background)",
                        color: "var(--foreground)", resize: "vertical", fontFamily: "inherit",
                        outline: "none", boxSizing: "border-box",
                      }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <CopyButton text={result.rewrittenSection} label="Copy to Clipboard" />
                      <button
                        onClick={handleApply}
                        disabled={applied}
                        style={{
                          padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: applied ? "rgba(52,199,89,0.12)" : "var(--accent)",
                          color: applied ? "var(--success)" : "#fff",
                          border: applied ? "1px solid var(--success)" : "none",
                          cursor: applied ? "default" : "pointer", transition: "all 0.15s",
                        }}
                      >
                        {applied ? "Applied!" : "Apply Section"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Tips */}
                {result.tips && result.tips.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Optimization Tips
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                      {result.tips.map((tip, i) => (
                        <li key={i} style={{ fontSize: 12, color: "var(--foreground)", lineHeight: 1.5 }}>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
