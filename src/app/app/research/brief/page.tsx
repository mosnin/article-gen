"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OutlineItem {
  heading: string;
  level: "h2" | "h3";
  children?: OutlineItem[];
}

interface CompetitorInsight {
  domain: string;
  title: string;
  angle: string;
}

interface ContentBrief {
  keyword: string;
  suggestedTitle: string;
  suggestedWordCount: number;
  targetAudience: string;
  contentAngle: string;
  mustIncludeTopics: string[];
  questionsToAnswer: string[];
  suggestedOutline: OutlineItem[];
  nlpTermsToInclude: string[];
  competitorInsights: CompetitorInsight[];
  internalLinkOpportunities: string[];
}

// ─── Spin icon ────────────────────────────────────────────────────────────────

function SpinIcon() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className="shrink-0 p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] transition-colors"
    >
      {copied ? (
        <svg
          className="w-4 h-4 text-[var(--success)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}

// ─── Collapsible Outline ──────────────────────────────────────────────────────

function OutlineSection({ items }: { items: OutlineItem[] }) {
  const [open, setOpen] = useState(true);

  // Flatten h2/h3 hierarchy: group h3s under their nearest h2
  const grouped: Array<{ h2: OutlineItem; h3s: OutlineItem[] }> = [];
  let current: { h2: OutlineItem; h3s: OutlineItem[] } | null = null;

  for (const item of items) {
    if (item.level === "h2") {
      current = { h2: item, h3s: item.children ?? [] };
      grouped.push(current);
    } else if (item.level === "h3" && current) {
      current.h3s.push(item);
    }
  }

  // If no h2s at all, just show a flat list
  const flatItems = grouped.length === 0 ? items : [];

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left group"
      >
        <svg
          className={cn(
            "w-4 h-4 text-[var(--text-secondary)] transition-transform shrink-0",
            open ? "rotate-90" : "rotate-0"
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <span className="text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
          {open ? "Collapse outline" : "Expand outline"}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-2 pl-1 fade-in-up">
          {grouped.length > 0
            ? grouped.map((group, gi) => (
                <div key={gi} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider w-7 shrink-0">
                      H2
                    </span>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {group.h2.heading}
                    </p>
                  </div>
                  {group.h3s.map((sub, si) => (
                    <div key={si} className="flex items-center gap-2 pl-7">
                      <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider w-7 shrink-0">
                        H3
                      </span>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {sub.heading}
                      </p>
                    </div>
                  ))}
                </div>
              ))
            : flatItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider w-7 shrink-0",
                      item.level === "h2"
                        ? "text-[var(--accent)]"
                        : "text-[var(--text-secondary)]"
                    )}
                  >
                    {item.level.toUpperCase()}
                  </span>
                  <p
                    className={cn(
                      "text-sm",
                      item.level === "h2"
                        ? "font-medium text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] pl-4"
                    )}
                  >
                    {item.heading}
                  </p>
                </div>
              ))}
        </div>
      )}
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function BriefSkeleton() {
  return (
    <div className="space-y-4">
      {/* Title card */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-7 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
        </CardContent>
      </Card>
      {/* Content angle */}
      <Card>
        <CardContent className="pt-5 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </CardContent>
      </Card>
      {/* Topics */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <Skeleton className="h-4 w-40" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-24 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>
      {/* Questions */}
      <Card>
        <CardContent className="pt-5 space-y-2">
          <Skeleton className="h-4 w-36" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </CardContent>
      </Card>
      {/* Two columns */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-5 space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-20 rounded-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 space-y-2">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Brief Result ─────────────────────────────────────────────────────────────

function BriefResult({ brief }: { brief: ContentBrief }) {
  const router = useRouter();
  const encoded = encodeURIComponent(brief.keyword);

  return (
    <div className="space-y-4 fade-in-up">
      {/* ── Suggested Title ──────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            Suggested Title
          </p>
          <div className="flex items-start gap-2">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] leading-snug flex-1">
              {brief.suggestedTitle}
            </h2>
            <CopyButton text={brief.suggestedTitle} />
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Badge variant="default">
              {brief.suggestedWordCount.toLocaleString()} words
            </Badge>
            <Badge variant="neutral">{brief.targetAudience}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── Content Angle ────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            Content Angle
          </p>
          <div className="rounded-lg bg-[var(--accent-light)] border border-[var(--border-default)] px-4 py-3">
            <p className="text-sm text-[var(--text-primary)] leading-relaxed">
              {brief.contentAngle}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Must-Include Topics ──────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            Must-Include Topics
          </p>
          <div className="flex flex-wrap gap-2">
            {brief.mustIncludeTopics.map((topic, i) => (
              <Badge
                key={i}
                variant="neutral"
                className="fade-in-up"
                style={{ animationDelay: `${i * 30}ms` } as React.CSSProperties}
              >
                {topic}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Questions to Answer ──────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            Questions to Answer
          </p>
          <ol className="space-y-2">
            {brief.questionsToAnswer.map((q, i) => (
              <li
                key={i}
                className="flex gap-3 fade-in-up"
                style={{ animationDelay: `${i * 35}ms` } as React.CSSProperties}
              >
                <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-[var(--text-primary)] leading-snug">
                  {q}
                </p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* ── Suggested Outline ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Suggested Outline</CardTitle>
          <CardDescription>
            Recommended H2 / H3 heading hierarchy for this article.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <OutlineSection items={brief.suggestedOutline} />
        </CardContent>
      </Card>

      {/* ── NLP Terms ────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            NLP Terms to Include
          </p>
          <div className="flex flex-wrap gap-2">
            {brief.nlpTermsToInclude.map((term, i) => (
              <span
                key={i}
                className={cn(
                  "fade-in-up inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                  i % 3 === 0
                    ? "bg-[var(--accent-light)] text-[var(--accent)] border-[var(--border-default)]"
                    : i % 3 === 1
                    ? "bg-[var(--success-light)] text-[var(--success)] border-[var(--border-default)]"
                    : "bg-[var(--surface-sunken)] text-[var(--text-secondary)] border-[var(--border-default)]"
                )}
                style={{ animationDelay: `${i * 25}ms` } as React.CSSProperties}
              >
                {term}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Competitor Insights ──────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 px-0.5">
          Competitor Insights
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {brief.competitorInsights.map((ci, i) => (
            <Card
              key={i}
              className="fade-in-up"
              style={{ animationDelay: `${i * 50}ms` } as React.CSSProperties}
            >
              <CardContent className="pt-4 pb-4 space-y-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-[var(--surface-sunken)] flex items-center justify-center shrink-0">
                    <svg
                      className="w-3 h-3 text-[var(--text-secondary)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"
                      />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                    {ci.domain}
                  </span>
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)] leading-snug line-clamp-2">
                  {ci.title}
                </p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-3">
                  {ci.angle}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Internal Link Opportunities ──────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Internal Link Opportunities</CardTitle>
          <CardDescription>
            Existing content on your site you can link to from this article.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <ul className="space-y-2">
            {brief.internalLinkOpportunities.map((link, i) => (
              <li
                key={i}
                className="flex items-center gap-2 fade-in-up"
                style={{ animationDelay: `${i * 30}ms` } as React.CSSProperties}
              >
                <svg
                  className="w-3.5 h-3.5 text-[var(--accent)] shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                <p className="text-sm text-[var(--text-primary)]">{link}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-end">
        <Button
          size="lg"
          onClick={() =>
            router.push(
              `/app/generate?topic=${encoded}&keyword=${encoded}`
            )
          }
        >
          Generate Article from Brief
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContentBriefPage() {
  const [keyword, setKeyword] = useState("");
  const [niche, setNiche] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<ContentBrief | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
      toast.error("Please enter a keyword.");
      return;
    }

    setLoading(true);
    setError(null);
    setBrief(null);

    try {
      const res = await fetch("/api/generate/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: trimmedKeyword,
          niche: niche.trim() || undefined,
          targetAudience: targetAudience.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to generate content brief.");
      }

      setBrief(data as ContentBrief);
      toast.success("Content brief generated.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Brief Generator"
        description="Generate a comprehensive brief for any keyword to guide your article creation."
      />

      {/* ── Input Form ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Brief Details</CardTitle>
          <CardDescription>
            Enter a target keyword plus optional context to generate a detailed
            content brief.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="brief-keyword">Target keyword</Label>
              <Input
                id="brief-keyword"
                placeholder="e.g. best project management software"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                disabled={loading}
                maxLength={200}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="brief-niche">
                  Niche{" "}
                  <span className="text-[var(--text-secondary)] font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="brief-niche"
                  placeholder="e.g. SaaS productivity tools"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  disabled={loading}
                  maxLength={150}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brief-audience">
                  Target audience{" "}
                  <span className="text-[var(--text-secondary)] font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="brief-audience"
                  placeholder="e.g. startup founders"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  disabled={loading}
                  maxLength={150}
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading || !keyword.trim()}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <SpinIcon />
                  Generating…
                </span>
              ) : (
                "Generate Brief"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Loading state ─────────────────────────────────────── */}
      {loading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-0.5">
            <SpinIcon />
            <p className="text-sm text-[var(--text-secondary)]">
              Building your content brief…
            </p>
          </div>
          <BriefSkeleton />
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────── */}
      {!loading && error && (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center justify-center py-12 text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--error-light)] flex items-center justify-center">
              <svg
                className="w-6 h-6 text-[var(--error)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-[var(--text-primary)]">
                Generation failed
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-sm">
                {error}
              </p>
            </div>
            <Button variant="outline" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Empty state ───────────────────────────────────────── */}
      {!loading && !error && brief === null && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-[var(--surface-sunken)] flex items-center justify-center">
            <svg
              className="w-7 h-7 text-[var(--text-secondary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="font-medium text-[var(--text-primary)]">
            Enter a keyword to generate your brief
          </p>
          <p className="text-sm text-[var(--text-secondary)] max-w-xs">
            We'll create a complete content brief with outline, NLP terms,
            competitor insights, and more.
          </p>
        </div>
      )}

      {/* ── Brief result ──────────────────────────────────────── */}
      {!loading && !error && brief !== null && (
        <BriefResult brief={brief} />
      )}
    </div>
  );
}
