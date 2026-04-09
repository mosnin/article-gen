"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompetitorPage {
  rank: number;
  title: string;
  url: string;
  domain: string;
  wordCountEstimate: number;
  keyTopics: string[];
  strengths: string[];
  weaknesses: string[];
  uniqueAngles: string[];
}

interface CompetitorAnalysis {
  keyword: string;
  pages: CompetitorPage[];
  commonStrengths: string[];
  commonWeaknesses: string[];
  contentGaps: string[];
  winningStrategy: string;
  recommendedWordCount: number;
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton({ numCompetitors }: { numCompetitors: number }) {
  return (
    <div className="space-y-6">
      {/* Winning strategy skeleton */}
      <div className="rounded-2xl border border-[var(--accent-light)] bg-[var(--accent-light)] p-6 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>

      {/* Content gaps skeleton */}
      <div className="rounded-xl border border-[var(--border-default)] bg-white p-5 space-y-3">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-[var(--border-default)] p-4 space-y-2">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Competitor cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: numCompetitors }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border-default)] bg-white p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-8 rounded-full" />
              <Skeleton className="h-5 w-36" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-5 w-20 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Winning Strategy Box ─────────────────────────────────────────────────────

function WinningStrategyBox({ strategy, wordCount }: { strategy: string; wordCount: number }) {
  return (
    <div
      className="rounded-2xl border border-blue-200 p-6 fade-in-up"
      style={{
        background: "linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Winning Strategy</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">GPT synthesis of top-ranking patterns</p>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
          style={{
            background: "#fff",
            borderColor: "var(--accent)",
            color: "var(--accent)",
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Target {wordCount.toLocaleString()} words
        </span>
      </div>
      <p className="text-sm text-[var(--text-primary)] leading-relaxed">{strategy}</p>
    </div>
  );
}

// ─── Content Gap Card ─────────────────────────────────────────────────────────

function ContentGapCard({ gap, index }: { gap: string; index: number }) {
  const router = useRouter();
  const encoded = encodeURIComponent(gap);

  return (
    <div
      className="fade-in-up flex flex-col justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-white p-4 hover:border-[var(--accent)] transition-colors"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-base shrink-0">💡</span>
        <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">{gap}</p>
      </div>
      <button
        onClick={() => router.push(`/app/autopilot?topic=${encoded}`)}
        className="flex items-center justify-center gap-1.5 w-full rounded-lg px-3 py-2 text-xs font-semibold border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
      >
        <span>➕</span> Add to Plan
      </button>
    </div>
  );
}

// ─── Competitor Card ──────────────────────────────────────────────────────────

function CompetitorCard({ page, index }: { page: CompetitorPage; index: number }) {
  const rankColors = [
    { bg: "#fef3c7", text: "#92400e", border: "#fde68a" }, // gold-ish
    { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" }, // silver
    { bg: "#fef7ee", text: "#9a3412", border: "#fed7aa" }, // bronze
  ];
  const rankStyle = rankColors[index] ?? { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb" };

  return (
    <div
      className="fade-in-up flex flex-col gap-4 rounded-xl border border-[var(--border-default)] bg-white p-5"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <span
          className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border"
          style={{ background: rankStyle.bg, color: rankStyle.text, borderColor: rankStyle.border }}
        >
          #{page.rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-[var(--text-primary)] truncate">{page.domain}</p>
          <a
            href={page.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] truncate block transition-colors"
            title={page.title}
          >
            {page.title}
          </a>
        </div>
        <span className="shrink-0 text-xs font-medium text-[var(--text-secondary)] bg-[var(--surface-sunken)] px-2 py-0.5 rounded-full whitespace-nowrap">
          ~{page.wordCountEstimate.toLocaleString()}w
        </span>
      </div>

      {/* Key Topics */}
      {page.keyTopics.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">Key Topics</p>
          <div className="flex flex-wrap gap-1.5">
            {page.keyTopics.map((topic, i) => (
              <Badge key={i} variant="neutral" className="text-[11px]">{topic}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Strengths */}
      {page.strengths.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">Strengths</p>
          <ul className="space-y-1">
            {page.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--text-primary)]">
                <span className="mt-0.5 text-[var(--success)] shrink-0">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Weaknesses */}
      {page.weaknesses.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">Weaknesses</p>
          <ul className="space-y-1">
            {page.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--text-primary)]">
                <span className="mt-0.5 text-[var(--error)] shrink-0">✗</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Unique Angles */}
      {page.uniqueAngles.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">Unique Angles</p>
          <ul className="space-y-1">
            {page.uniqueAngles.map((a, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--text-primary)]">
                <span className="mt-0.5 text-[var(--accent)] shrink-0">•</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Common Patterns Section ──────────────────────────────────────────────────

function CommonPatternsSection({
  commonStrengths,
  commonWeaknesses,
}: {
  commonStrengths: string[];
  commonWeaknesses: string[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 fade-in-up">
      {/* Common Strengths */}
      <div className="rounded-xl border border-green-200 bg-[var(--success-light)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[var(--success)] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Common Strengths</h3>
            <p className="text-xs text-[var(--text-secondary)]">What all top pages do well — table stakes</p>
          </div>
        </div>
        <ul className="space-y-2">
          {commonStrengths.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
              <span className="mt-0.5 text-[var(--success)] shrink-0 font-bold">✓</span>
              {s}
            </li>
          ))}
        </ul>
      </div>

      {/* Common Weaknesses */}
      <div className="rounded-xl border border-red-200 bg-[var(--error-light)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[var(--error)] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Common Weaknesses</h3>
            <p className="text-xs text-[var(--text-secondary)]">What all miss — your opportunity to win</p>
          </div>
        </div>
        <ul className="space-y-2">
          {commonWeaknesses.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
              <span className="mt-0.5 text-[var(--error)] shrink-0 font-bold">✗</span>
              {w}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompetitorAnalyzerPage() {
  const [keyword, setKeyword] = useState("");
  const [numCompetitors, setNumCompetitors] = useState<3 | 5 | 8>(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CompetitorAnalysis | null>(null);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = keyword.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const res = await fetch("/api/serp/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: trimmed, numCompetitors }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to analyze competitors.");
      }

      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Competitor Content Analyzer"
        description="Analyze top-ranking pages for any keyword and uncover the gaps that will help you outrank them."
      />

      {/* ── Input Form ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border-default)] bg-white p-5">
        <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="competitor-keyword">Target keyword</Label>
            <Input
              id="competitor-keyword"
              placeholder="e.g. best project management software"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              disabled={loading}
              maxLength={200}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5 w-full sm:w-auto">
            <Label>Competitors to analyze</Label>
            <div className="flex gap-1.5">
              {([3, 5, 8] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumCompetitors(n)}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    numCompetitors === n
                      ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                      : "bg-white text-[var(--text-secondary)] border-[var(--border-default)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || !keyword.trim()}
            loading={loading}
            className="w-full sm:w-auto h-10"
          >
            {loading ? "Analyzing…" : "Analyze Competitors"}
          </Button>
        </form>
      </div>

      {/* ── Loading State ─────────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 py-3">
            <svg
              className="animate-spin h-5 w-5 text-[var(--accent)] shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              Analyzing top {numCompetitors} competing pages for &ldquo;{keyword}&rdquo;&hellip;
            </p>
          </div>
          <LoadingSkeleton numCompetitors={numCompetitors} />
        </div>
      )}

      {/* ── Error State ───────────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-[var(--error-light)] p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--error)] flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[var(--text-primary)]">Analysis failed</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      {/* ── Empty State ───────────────────────────────────────────────────── */}
      {!loading && !error && analysis === null && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--surface-sunken)" }}
          >
            <svg className="w-8 h-8 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-[var(--text-primary)]">Enter a keyword to get started</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-sm">
              We&apos;ll analyze the top-ranking pages, surface content gaps, and give you a winning strategy to outrank them.
            </p>
          </div>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {!loading && !error && analysis !== null && (
        <div className="space-y-8">

          {/* Winning Strategy */}
          <WinningStrategyBox
            strategy={analysis.winningStrategy}
            wordCount={analysis.recommendedWordCount}
          />

          {/* Content Gaps */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Content Gaps</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Topics your competitors miss — add them to your content plan
                </p>
              </div>
              <Badge variant="default">{analysis.contentGaps.length} gaps found</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {analysis.contentGaps.map((gap, i) => (
                <ContentGapCard key={i} gap={gap} index={i} />
              ))}
            </div>
          </section>

          {/* Competitors Grid */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Top {analysis.pages.length} Competitors
              </h2>
              <span className="text-xs text-[var(--text-secondary)] bg-[var(--surface-sunken)] px-2 py-0.5 rounded-full">
                for &ldquo;{analysis.keyword}&rdquo;
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {analysis.pages.map((page, i) => (
                <CompetitorCard key={page.url} page={page} index={i} />
              ))}
            </div>
          </section>

          {/* Common Strengths & Weaknesses */}
          {(analysis.commonStrengths.length > 0 || analysis.commonWeaknesses.length > 0) && (
            <section>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Market-Wide Patterns</h2>
              <CommonPatternsSection
                commonStrengths={analysis.commonStrengths}
                commonWeaknesses={analysis.commonWeaknesses}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
