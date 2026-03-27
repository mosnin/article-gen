"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";

interface MatchedArticle {
  id: string;
  title: string;
  url: string;
}

interface ContentGap {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  matchedArticle?: MatchedArticle;
  type: "optimize" | "create";
}

export default function ContentGapsPage() {
  const [gaps, setGaps] = useState<ContentGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gscNotConnected, setGscNotConnected] = useState(false);

  useEffect(() => {
    async function fetchGaps() {
      try {
        const res = await fetch("/api/gsc/content-gaps");
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 400 && data.error?.includes("not connected")) {
            setGscNotConnected(true);
            return;
          }
          setError(data.error ?? "Failed to load content gaps");
          return;
        }

        setGaps(data.gaps ?? []);
      } catch {
        setError("Failed to load content gaps");
      } finally {
        setLoading(false);
      }
    }

    fetchGaps();
  }, []);

  const optimizeGaps = gaps.filter((g) => g.type === "optimize");
  const createGaps = gaps.filter((g) => g.type === "create");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Gap Analyzer"
        description="Discover quick-win optimization opportunities and untapped content ideas from your search data."
      />

      {/* Sub-navigation */}
      <div className="flex items-center gap-2">
        <Link
          href="/app/analytics"
          className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] transition-colors"
        >
          Performance
        </Link>
        <span className="inline-flex items-center rounded-lg bg-[var(--accent-light)] px-3 py-1.5 text-xs font-medium text-[var(--accent)]">
          Content Gaps
        </span>
      </div>

      {/* GSC not connected */}
      {gscNotConnected && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-light)]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-[var(--accent)]">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Connect Google Search Console</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Link your GSC account to discover content optimization opportunities.
              </p>
            </div>
            <Link href="/app/settings" className={buttonVariants()}>
              Go to Settings
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {loading && !gscNotConnected && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {!loading && !error && !gscNotConnected && (
        <>
          {gaps.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <p className="text-sm text-[var(--text-secondary)]">
                  No content gaps found. This could mean your site is performing well, or there is not enough search data yet.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Optimize Existing Content */}
          {optimizeGaps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Optimize Existing Content</CardTitle>
                <CardDescription>
                  Articles that rank but underperform. These are quick wins — small rewrites can boost CTR significantly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="hidden sm:grid sm:grid-cols-[1fr_100px_80px_80px_80px_120px] gap-3 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  <span>Query / Article</span>
                  <span className="text-right">Impressions</span>
                  <span className="text-right">CTR</span>
                  <span className="text-right">Position</span>
                  <span className="text-right">Clicks</span>
                  <span />
                </div>
                <div className="divide-y divide-[var(--border-default)]">
                  {optimizeGaps.map((gap) => (
                    <div
                      key={gap.query}
                      className="grid grid-cols-1 sm:grid-cols-[1fr_100px_80px_80px_80px_120px] items-center gap-2 sm:gap-3 px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">{gap.query}</p>
                        {gap.matchedArticle && (
                          <a
                            href={gap.matchedArticle.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-xs text-[var(--accent)] hover:underline block"
                          >
                            {gap.matchedArticle.title}
                          </a>
                        )}
                      </div>
                      <p className="text-right text-sm tabular-nums text-[var(--text-secondary)]">
                        {gap.impressions.toLocaleString()}
                      </p>
                      <div className="text-right">
                        <Badge variant="warning">{gap.ctr}%</Badge>
                      </div>
                      <p className="text-right text-sm tabular-nums text-[var(--text-secondary)]">
                        {gap.position}
                      </p>
                      <p className="text-right text-sm tabular-nums text-[var(--text-secondary)]">
                        {gap.clicks.toLocaleString()}
                      </p>
                      <div className="flex justify-end">
                        {gap.matchedArticle && (
                          <Link
                            href={`/app/articles/${gap.matchedArticle.id}`}
                            className={buttonVariants({ size: "sm", variant: "outline" })}
                          >
                            Optimize
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Content Opportunities */}
          {createGaps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Content Opportunities</CardTitle>
                <CardDescription>
                  Queries with search visibility but no matching article. Create targeted content to capture this traffic.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="hidden sm:grid sm:grid-cols-[1fr_100px_80px_80px_80px_120px] gap-3 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  <span>Query</span>
                  <span className="text-right">Impressions</span>
                  <span className="text-right">CTR</span>
                  <span className="text-right">Position</span>
                  <span className="text-right">Clicks</span>
                  <span />
                </div>
                <div className="divide-y divide-[var(--border-default)]">
                  {createGaps.map((gap) => (
                    <div
                      key={gap.query}
                      className="grid grid-cols-1 sm:grid-cols-[1fr_100px_80px_80px_80px_120px] items-center gap-2 sm:gap-3 px-3 py-3"
                    >
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">{gap.query}</p>
                      <p className="text-right text-sm tabular-nums text-[var(--text-secondary)]">
                        {gap.impressions.toLocaleString()}
                      </p>
                      <div className="text-right">
                        <Badge variant="warning">{gap.ctr}%</Badge>
                      </div>
                      <p className="text-right text-sm tabular-nums text-[var(--text-secondary)]">
                        {gap.position}
                      </p>
                      <p className="text-right text-sm tabular-nums text-[var(--text-secondary)]">
                        {gap.clicks.toLocaleString()}
                      </p>
                      <div className="flex justify-end">
                        <Link
                          href={`/app/generate?topic=${encodeURIComponent(gap.query)}`}
                          className={buttonVariants({ size: "sm" })}
                        >
                          Create Article
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
