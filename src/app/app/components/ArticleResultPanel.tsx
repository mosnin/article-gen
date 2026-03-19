"use client";

import type { ArticleSession } from "../types";
import { CopyButton } from "./CopyButton";
import { OutputCard } from "./OutputCard";
import { ImagePromptCard } from "./ImagePromptCard";
import { ArticlePreview } from "./ArticlePreview";

const STEPS = [
  "Organizing context & researching facts...",
  "Generating SEO metadata...",
  "Writing article & creating image prompts...",
  "Generating AI images...",
];

const STEP_LABELS = ["Researching...", "Metadata...", "Writing...", "Images..."];

function getStepLabel(session: ArticleSession): string {
  if (session.currentStep === 3 && session.imageProgress) return session.imageProgress;
  return STEP_LABELS[session.currentStep] || "";
}

function getStepText(session: ArticleSession, i: number): string {
  if (i === 3 && session.currentStep === 3 && session.imageProgress) return session.imageProgress;
  return STEPS[i];
}

interface ArticleResultPanelProps {
  session: ArticleSession;
  resultView: "data" | "preview";
  onResultViewChange: (v: "data" | "preview") => void;
  onTogglePosted: () => void;
  onRetry: () => void;
  onPublish: () => void;
  hasAnyPlatform: boolean;
  batchCountdown: number;
}

export function ArticleResultPanel({
  session,
  resultView,
  onResultViewChange,
  onTogglePosted,
  onRetry,
  onPublish,
  hasAnyPlatform,
  batchCountdown,
}: ArticleResultPanelProps) {
  /* ── Queued ── */
  if (session.queued) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--card)" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h2 className="mb-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Queued</h2>
        <p className="mb-1 text-sm font-medium" style={{ color: "var(--foreground)" }}>{session.topic}</p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Waiting in batch queue.{batchCountdown > 0 && ` Next batch starts in ${batchCountdown}s.`}
        </p>
      </div>
    );
  }

  /* ── Loading ── */
  if (session.loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-4 text-center">
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>{session.topic}</h2>
          {session.quality === "standard" && (
            <span className="text-xs" style={{ color: "var(--muted)" }}>Standard (~2,000 words)</span>
          )}
        </div>
        <div className="mb-8 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="loading-dot h-3 w-3 rounded-full" style={{ background: "var(--accent)" }} />
          ))}
        </div>
        <div className="space-y-3 text-center">
          {STEPS.map((step, i) => (
            <p
              key={step}
              className="text-sm font-medium transition-all duration-500"
              style={{
                color: i === session.currentStep ? "var(--accent)" : i < session.currentStep ? "var(--success)" : "var(--muted)",
                opacity: i <= session.currentStep ? 1 : 0.4,
              }}
            >
              {i < session.currentStep ? "✓ " : i === session.currentStep ? "◯ " : "  "}
              {getStepText(session, i)}
            </p>
          ))}
        </div>
        <p className="mt-8 text-xs" style={{ color: "var(--muted)" }}>This may take a couple of minutes...</p>
      </div>
    );
  }

  /* ── Error ── */
  if (!session.loading && !session.queued && session.error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(239, 68, 68, 0.1)" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h2 className="mb-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Generation Failed</h2>
        <p className="mb-1 text-sm" style={{ color: "var(--muted)" }}>Topic: {session.topic}</p>
        <div className="mb-6 max-w-md rounded-xl border px-4 py-3 text-center text-sm" style={{ borderColor: "var(--error)", background: "rgba(239, 68, 68, 0.1)", color: "var(--error)" }}>
          {session.error}
        </div>
        <button
          onClick={onRetry}
          className="rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-all duration-200"
          style={{ background: "var(--accent)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-hover)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--accent)"; }}
        >
          Retry
        </button>
      </div>
    );
  }

  /* ── Result ── */
  if (!session.result) return null;

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <div className="flex items-start justify-between gap-4">
          <h2 className="mb-1 text-2xl font-bold" style={{ color: "var(--foreground)" }}>Generated Article</h2>
          <button
            onClick={onTogglePosted}
            className="flex flex-shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200"
            style={{
              borderColor: session.posted ? "var(--success)" : "var(--card-border)",
              background: session.posted ? "rgba(52, 199, 89, 0.1)" : "var(--card)",
              color: session.posted ? "var(--success)" : "var(--muted)",
            }}
            onMouseEnter={(e) => {
              if (!session.posted) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--success)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--success)";
              }
            }}
            onMouseLeave={(e) => {
              if (!session.posted) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)";
              }
            }}
          >
            {session.posted ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <span className="block h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: "currentColor" }} />
            )}
            {session.posted ? "Posted" : "Mark as Posted"}
          </button>
          {hasAnyPlatform && (
            <button
              onClick={onPublish}
              className="flex flex-shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200"
              style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--accent)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
                (e.currentTarget as HTMLButtonElement).style.background = "var(--accent)";
                (e.currentTarget as HTMLButtonElement).style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)";
                (e.currentTarget as HTMLButtonElement).style.background = "var(--card)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Publish Article
            </button>
          )}
        </div>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Focus: <span style={{ color: "var(--accent)" }}>{session.result.focusKeyword}</span>
          {session.result.keywords.length > 0 && (
            <> {" | "}Keywords:{" "}
              {session.result.keywords.map((kw, i) => (
                <span key={kw}>
                  <span style={{ color: "var(--accent)" }}>{kw}</span>
                  {i < session.result!.keywords.length - 1 ? ", " : ""}
                </span>
              ))}
            </>
          )}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex overflow-hidden rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
        <button
          onClick={() => onResultViewChange("data")}
          className="flex-1 px-4 py-2 text-sm font-medium transition-colors"
          style={{ background: resultView === "data" ? "var(--accent)" : "var(--card)", color: resultView === "data" ? "#fff" : "var(--foreground)" }}
        >
          Data
        </button>
        <button
          onClick={() => onResultViewChange("preview")}
          className="flex-1 px-4 py-2 text-sm font-medium transition-colors"
          style={{ background: resultView === "preview" ? "var(--accent)" : "var(--card)", color: resultView === "preview" ? "#fff" : "var(--foreground)" }}
        >
          Preview
        </button>
      </div>

      {/* Data tab */}
      {resultView === "data" && (
        <div className="space-y-6">
          <OutputCard label="Title" content={session.result.title} />
          <OutputCard label="Meta Description" content={session.result.metaDescription} />
          <OutputCard label="Slug" content={session.result.slug} />
          <OutputCard label="Focus Keyword" content={session.result.focusKeyword} />
          {session.result.keywords.length > 0 && (
            <OutputCard label="Keywords" content={session.result.keywords.join(", ")} />
          )}
          <OutputCard label="Article (Markdown)" content={session.result.article} large />

          <div>
            <h3 className="mb-4 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Image Prompts</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {session.result.imagePrompts.map((image, i) => (
                <ImagePromptCard key={i} image={image} generatedImage={session.result?.generatedImages?.[i]} />
              ))}
            </div>
          </div>

          {session.result.schema && (
            <div>
              <h3 className="mb-4 text-lg font-semibold" style={{ color: "var(--foreground)" }}>JSON-LD Schema</h3>
              <div className="rounded-xl border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: "var(--card-border)" }}>
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>Structured Data</span>
                  <CopyButton text={`<script type="application/ld+json">\n${session.result.schema}\n</script>`} label="Copy Schema" />
                </div>
                <pre className="overflow-x-auto p-5 text-xs leading-relaxed" style={{ color: "var(--foreground)" }}>
                  {session.result.schema}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview tab */}
      {resultView === "preview" && (
        <ArticlePreview article={session.result.article} />
      )}
    </div>
  );
}
