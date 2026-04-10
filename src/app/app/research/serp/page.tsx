"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SerpAnalysis } from "@/lib/serp-analyzer";

// ─── Difficulty badge ─────────────────────────────────────────────────────────

type DifficultyLevel = "Easy" | "Medium" | "Hard" | "Very Hard";

interface DifficultyResult {
  difficulty: DifficultyLevel;
  score?: number;
  reason?: string;
}

function DifficultyBadge({ level }: { level: DifficultyLevel }) {
  const styles: Record<DifficultyLevel, string> = {
    Easy:        "bg-[var(--success-light)] text-[var(--success)] border-[var(--border-default)]",
    Medium:      "bg-[var(--warning-light,var(--accent-light))] text-[var(--warning,var(--accent))] border-[var(--border-default)]",
    Hard:        "bg-[var(--surface-sunken)] text-[var(--text-secondary)] border-[var(--border-default)]",
    "Very Hard": "bg-[var(--error-light)] text-[var(--error)] border-[var(--border-default)]",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[level] ?? styles["Medium"]}`}>
      {level}
    </span>
  );
}

// ─── Spin icon ────────────────────────────────────────────────────────────────

function SpinIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function AnalysisSkeleton() {
  return (
    <div className="space-y-5">
      {/* Header bar skeleton */}
      <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="h-6 w-48 rounded-md bg-[var(--surface-sunken)] animate-pulse" />
        <div className="h-6 w-44 rounded-full bg-[var(--surface-sunken)] animate-pulse" />
      </div>

      {/* Domains grid skeleton */}
      <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-5 space-y-3">
        <div className="h-4 w-32 rounded bg-[var(--surface-sunken)] animate-pulse" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-7 w-28 rounded-full bg-[var(--surface-sunken)] animate-pulse" />
          ))}
        </div>
      </div>

      {/* Topics skeleton */}
      <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-5 space-y-3">
        <div className="h-4 w-36 rounded bg-[var(--surface-sunken)] animate-pulse" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-6 rounded-full bg-[var(--surface-sunken)] animate-pulse"
              style={{ width: `${60 + (i % 5) * 20}px` }}
            />
          ))}
        </div>
      </div>

      {/* Questions skeleton */}
      <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-5 space-y-3">
        <div className="h-4 w-44 rounded bg-[var(--surface-sunken)] animate-pulse" />
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div
                className="h-4 rounded bg-[var(--surface-sunken)] animate-pulse flex-1"
                style={{ maxWidth: `${50 + (i % 4) * 15}%` }}
              />
              <div className="h-7 w-24 rounded-md bg-[var(--surface-sunken)] animate-pulse shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-5 space-y-3">
        <div className="h-4 w-28 rounded bg-[var(--surface-sunken)] animate-pulse" />
        <div className="h-3 w-full rounded-full bg-[var(--surface-sunken)] animate-pulse" />
        <div className="h-4 w-52 rounded bg-[var(--surface-sunken)] animate-pulse" />
      </div>
    </div>
  );
}

// ─── Results display ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
      {children}
    </p>
  );
}

function AnalysisResults({
  analysis,
  onUseInBrief,
}: {
  analysis: SerpAnalysis;
  onUseInBrief: (question: string) => void;
}) {
  const domains = analysis.topDomains.slice(0, 8);
  const topics = analysis.commonTopics;
  const questions = analysis.questionsAnswered;
  const headings = analysis.commonHeadings;

  const avgPct = Math.min(100, Math.round((analysis.avgWordCount / (analysis.recommendedWordCount * 1.2)) * 100));
  const recPct = Math.min(100, Math.round((analysis.recommendedWordCount / (analysis.recommendedWordCount * 1.2)) * 100));

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--text-primary)] truncate">
          {analysis.keyword}
        </h2>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)] shrink-0">
          <svg className="w-3.5 h-3.5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Recommended word count:{" "}
          <span className="text-[var(--text-primary)] font-semibold">
            {analysis.recommendedWordCount.toLocaleString()} words
          </span>
        </span>
      </div>

      {/* Top Domains */}
      {domains.length > 0 && (
        <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-5">
          <SectionLabel>Top Domains</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {domains.map((domain, i) => (
              <span
                key={domain}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)]"
              >
                <span className="text-[10px] font-bold text-[var(--text-tertiary)] tabular-nums w-4 text-center">
                  {i + 1}
                </span>
                <span className="text-[var(--text-primary)] font-medium">{domain}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Common Topics */}
      {topics.length > 0 && (
        <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-5">
          <SectionLabel>Common Topics</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)] capitalize"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Questions Answered */}
      {questions.length > 0 && (
        <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-5">
          <SectionLabel>Questions Answered</SectionLabel>
          <ul className="space-y-2">
            {questions.map((q, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-3 py-2 border-b border-[var(--border-default)] last:border-0"
              >
                <span className="text-sm text-[var(--text-primary)] leading-relaxed flex-1">
                  {q}
                </span>
                <button
                  onClick={() => onUseInBrief(q)}
                  className="shrink-0 px-2.5 py-1 rounded-md text-xs font-medium border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors"
                >
                  Use in Brief
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Common Headings */}
      {headings.length > 0 && (
        <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-5">
          <SectionLabel>Common Headings</SectionLabel>
          <ol className="space-y-1.5 list-none">
            {headings.map((heading, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--text-primary)]">
                <span className="text-[10px] font-bold text-[var(--text-tertiary)] tabular-nums w-4 pt-0.5 shrink-0 text-right">
                  {i + 1}.
                </span>
                <span className="leading-relaxed">{heading}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Word Count Comparison */}
      <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-5">
        <SectionLabel>Word Count Comparison</SectionLabel>
        <div className="space-y-3">
          {/* Avg word count bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">Avg. competitor word count</span>
              <span className="font-semibold tabular-nums text-[var(--text-primary)]">{analysis.avgWordCount.toLocaleString()}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--surface-sunken)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent)] opacity-40 transition-all"
                style={{ width: `${avgPct}%` }}
              />
            </div>
          </div>
          {/* Recommended bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">Recommended word count</span>
              <span className="font-semibold tabular-nums text-[var(--accent)]">{analysis.recommendedWordCount.toLocaleString()}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--surface-sunken)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all"
                style={{ width: `${recPct}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">
            Target {analysis.recommendedWordCount.toLocaleString()} words — ~10% above the average to outrank competitors.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SerpAnalyzerPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<SerpAnalysis | null>(null);

  const [difficultyLoading, setDifficultyLoading] = useState(false);
  const [difficultyResult, setDifficultyResult] = useState<DifficultyResult | null>(null);
  const [difficultyError, setDifficultyError] = useState("");

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    const kw = keyword.trim();
    if (!kw) return;

    setLoading(true);
    setError("");
    setAnalysis(null);
    setDifficultyResult(null);
    setDifficultyError("");

    try {
      const res = await fetch("/api/serp/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: kw, numResults: 10 }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "SERP analysis failed");
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckDifficulty() {
    const kw = (analysis?.keyword ?? keyword).trim();
    if (!kw) return;

    setDifficultyLoading(true);
    setDifficultyError("");
    setDifficultyResult(null);

    try {
      const res = await fetch("/api/serp/difficulty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: kw }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed to check difficulty");
      setDifficultyResult(data);
    } catch (err) {
      setDifficultyError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDifficultyLoading(false);
    }
  }

  function handleUseInBrief(question: string) {
    const kw = analysis?.keyword ?? keyword;
    router.push(`/app/research/brief?keyword=${encodeURIComponent(kw)}&question=${encodeURIComponent(question)}`);
  }

  function handleGenerateBrief() {
    const kw = analysis?.keyword ?? keyword;
    router.push(`/app/research/brief?keyword=${encodeURIComponent(kw)}`);
  }

  const hasResults = !loading && analysis !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="SERP Analyzer"
        description="Analyze top-ranking pages for any keyword to inform your content strategy."
      />

      {/* Input form */}
      <form onSubmit={handleAnalyze} className="flex gap-2">
        <Input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="e.g. best project management software"
          disabled={loading}
          maxLength={300}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={loading || !keyword.trim()}
          className="whitespace-nowrap"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <SpinIcon />
              Analyzing…
            </span>
          ) : (
            "Analyze SERP"
          )}
        </Button>
      </form>

      {/* Error */}
      {error && !loading && (
        <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--error)]">{error}</p>
          <button
            onClick={() => setError("")}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && <AnalysisSkeleton />}

      {/* Results */}
      {hasResults && (
        <>
          <AnalysisResults analysis={analysis} onUseInBrief={handleUseInBrief} />

          {/* Action bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-1">
            <Button onClick={handleGenerateBrief}>
              Generate Content Brief
            </Button>

            <Button
              variant="outline"
              onClick={handleCheckDifficulty}
              disabled={difficultyLoading}
            >
              {difficultyLoading ? (
                <span className="flex items-center gap-2">
                  <SpinIcon className="h-3.5 w-3.5" />
                  Checking…
                </span>
              ) : (
                "Check Difficulty"
              )}
            </Button>

            {difficultyResult && (
              <div className="flex items-center gap-2">
                <DifficultyBadge level={difficultyResult.difficulty} />
                {difficultyResult.reason && (
                  <span className="text-xs text-[var(--text-tertiary)]">{difficultyResult.reason}</span>
                )}
              </div>
            )}

            {difficultyError && (
              <span className="text-xs text-[var(--error)]">{difficultyError}</span>
            )}
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && !error && analysis === null && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-[var(--surface-sunken)] flex items-center justify-center">
            <svg className="w-7 h-7 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="font-medium text-[var(--text-primary)]">Enter a keyword to analyze the SERP</p>
          <p className="text-sm text-[var(--text-secondary)] max-w-xs">
            We&apos;ll scan the top results to surface word count targets, common topics, and questions to answer.
          </p>
        </div>
      )}
    </div>
  );
}
