"use client";

import { useState, useMemo } from "react";
import { marked } from "marked";

export function ArticlePreview({ article }: { article: string }) {
  const [copied, setCopied] = useState(false);

  const html = useMemo(() => {
    return marked.parse(article, { async: false }) as string;
  }, [article]);

  const handleCopyPlainText = async () => {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const plainText = temp.innerText || temp.textContent || "";
    await navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyHtml = async () => {
    await navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={handleCopyPlainText}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
          style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)"; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy Plain Text
        </button>
        <button
          onClick={handleCopyHtml}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
          style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)"; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          Copy HTML
        </button>
        {copied && (
          <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>
            Copied!
          </span>
        )}
      </div>
      <div
        className="article-preview rounded-xl border p-8 md:p-12"
        style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
