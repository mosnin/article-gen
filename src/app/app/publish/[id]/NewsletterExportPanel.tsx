"use client";

import { useState, useRef, useEffect } from "react";

export interface NewsletterOutput {
  subject: string;
  previewText: string;
  htmlContent: string;
  plainText: string;
}

interface Props {
  articleContent: string;
  articleTitle: string;
  focusKeyword?: string;
  publishedUrl?: string;
}

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

export default function NewsletterExportPanel({
  articleContent,
  articleTitle,
  focusKeyword,
  publishedUrl,
}: Props) {
  const [open, setOpen] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [ctaText, setCtaText] = useState("Read the full article");
  const [ctaUrl, setCtaUrl] = useState(publishedUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [result, setResult] = useState<NewsletterOutput | null>(null);
  const [activeTab, setActiveTab] = useState<"html" | "plain">("html");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Keep ctaUrl in sync if the parent-supplied publishedUrl changes
  useEffect(() => {
    if (publishedUrl && !ctaUrl) setCtaUrl(publishedUrl);
  }, [publishedUrl, ctaUrl]);

  // Update iframe srcdoc when HTML result arrives or tab switches
  useEffect(() => {
    if (activeTab === "html" && result?.htmlContent && iframeRef.current) {
      iframeRef.current.srcdoc = result.htmlContent;
    }
  }, [activeTab, result]);

  const handleGenerate = async () => {
    setLoading(true);
    setApiError("");
    setResult(null);
    try {
      const res = await fetch("/api/repurpose/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: articleContent,
          title: articleTitle,
          keyword: focusKeyword,
          authorName: authorName.trim() || undefined,
          ctaText: ctaText.trim() || "Read the full article",
          ctaUrl: ctaUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error || "Failed to generate newsletter");
      } else {
        setResult(data as NewsletterOutput);
        setActiveTab("html");
      }
    } catch {
      setApiError("Network error — please try again");
    }
    setLoading(false);
  };

  const handleDownloadHtml = () => {
    if (!result?.htmlContent) return;
    const blob = new Blob([result.htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = articleTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60);
    a.download = `newsletter-${safeName}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputStyle = {
    width: "100%", padding: "8px 12px", borderRadius: 8,
    border: "1px solid var(--card-border)", background: "var(--background)",
    fontSize: 13, outline: "none", boxSizing: "border-box" as const,
  };

  const labelStyle = {
    display: "block", fontSize: 12, fontWeight: 600 as const,
    color: "var(--muted)", marginBottom: 4,
  };

  return (
    <div style={{ marginTop: 16 }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
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
          <span style={{ fontSize: 15 }}>📧</span>
          Export as Newsletter
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Slide-over panel */}
      {open && (
        <div style={{
          marginTop: 8, background: "var(--card)", border: "1px solid var(--card-border)",
          borderRadius: 12, overflow: "hidden",
        }}>
          {/* Panel header */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--card-border)" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Newsletter Generator</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
              Generate a ready-to-send newsletter from this article
            </div>
          </div>

          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Form fields */}
            {!result && (
              <>
                <div>
                  <label style={labelStyle}>Author Name (optional)</label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>CTA Button Text</label>
                  <input
                    type="text"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    placeholder="Read the full article"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>CTA URL (optional)</label>
                  <input
                    type="url"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="https://yourblog.com/post"
                    style={inputStyle}
                  />
                </div>

                {/* Error */}
                {apiError && (
                  <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", color: "var(--error)", fontSize: 13 }}>
                    {apiError}
                  </div>
                )}

                {/* Generate button */}
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  style={{
                    width: "100%", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                    background: "var(--accent)", color: "#fff", border: "none",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "opacity 0.15s",
                  }}
                >
                  {loading ? (
                    <>
                      <svg className="progress-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      Generating Newsletter…
                    </>
                  ) : (
                    "Generate Newsletter"
                  )}
                </button>
              </>
            )}

            {/* Results */}
            {result && !loading && (
              <>
                {/* Subject line */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Subject Line
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                    padding: "10px 14px", borderRadius: 8,
                    background: "var(--background)", border: "1px solid var(--card-border)",
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", flex: 1, minWidth: 0, wordBreak: "break-word" }}>
                      {result.subject}
                    </span>
                    <CopyButton text={result.subject} />
                  </div>
                </div>

                {/* Preview text */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Preview Text
                  </div>
                  <div style={{
                    display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10,
                    padding: "10px 14px", borderRadius: 8,
                    background: "var(--background)", border: "1px solid var(--card-border)",
                  }}>
                    <span style={{ fontSize: 13, color: "var(--foreground)", flex: 1, minWidth: 0, wordBreak: "break-word", lineHeight: 1.5 }}>
                      {result.previewText}
                    </span>
                    <CopyButton text={result.previewText} />
                  </div>
                </div>

                {/* Tabs */}
                <div>
                  <div style={{ display: "flex", gap: 4, background: "var(--background)", border: "1px solid var(--card-border)", borderRadius: 8, padding: 4, marginBottom: 10 }}>
                    {(["html", "plain"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                          flex: 1, padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                          background: activeTab === tab ? "var(--accent)" : "transparent",
                          color: activeTab === tab ? "#fff" : "var(--muted)",
                          transition: "all 0.15s",
                        }}
                      >
                        {tab === "html" ? "HTML" : "Plain Text"}
                      </button>
                    ))}
                  </div>

                  {/* HTML tab */}
                  {activeTab === "html" && (
                    <div>
                      <iframe
                        ref={iframeRef}
                        title="Newsletter HTML Preview"
                        sandbox="allow-same-origin"
                        style={{
                          width: "100%", height: 420, borderRadius: 8,
                          border: "1px solid var(--card-border)", background: "#fff",
                          display: "block",
                        }}
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <CopyButton text={result.htmlContent} label="Copy HTML" />
                        <button
                          onClick={handleDownloadHtml}
                          style={{
                            padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: "var(--background)", color: "var(--foreground)",
                            border: "1px solid var(--card-border)", cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                          }}
                        >
                          ⬇ Download HTML
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Plain text tab */}
                  {activeTab === "plain" && (
                    <div>
                      <textarea
                        readOnly
                        value={result.plainText}
                        rows={14}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 12, lineHeight: 1.6,
                          border: "1px solid var(--card-border)", background: "var(--background)",
                          color: "var(--foreground)", resize: "vertical", fontFamily: "inherit",
                          outline: "none", boxSizing: "border-box",
                        }}
                      />
                      <div style={{ marginTop: 8 }}>
                        <CopyButton text={result.plainText} label="Copy Plain Text" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Regenerate */}
                <button
                  onClick={() => { setResult(null); setApiError(""); }}
                  style={{
                    padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: "var(--background)", border: "1px solid var(--card-border)",
                    color: "var(--muted)", cursor: "pointer", alignSelf: "flex-start",
                  }}
                >
                  Regenerate
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
