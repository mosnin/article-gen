"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

interface ArticlePerformance {
  articleId: string;
  title: string;
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  platform: string;
}

type SortKey = "title" | "platform" | "clicks" | "impressions" | "ctr" | "position";
type SortDir = "asc" | "desc";

function sortArticles(articles: ArticlePerformance[], key: SortKey, dir: SortDir): ArticlePerformance[] {
  return [...articles].sort((a, b) => {
    let cmp: number;
    if (key === "title" || key === "platform") {
      cmp = a[key].localeCompare(b[key]);
    } else {
      cmp = a[key] - b[key];
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = currentKey === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors",
        isActive && "text-[var(--text-primary)]",
        className,
      )}
    >
      {label}
      {isActive && (
        <svg viewBox="0 0 20 20" fill="currentColor" className={cn("h-3 w-3", currentDir === "asc" && "rotate-180")}>
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
}

export default function AnalyticsPage() {
  const [articles, setArticles] = useState<ArticlePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gscNotConnected, setGscNotConnected] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("impressions");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/gsc/article-performance");
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 400 && data.error?.includes("not connected")) {
            setGscNotConnected(true);
            return;
          }
          throw new Error(data.error || "Failed to fetch performance data");
        }

        setArticles(data.articles ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir(key === "title" || key === "platform" ? "asc" : "desc");
      }
    },
    [sortKey],
  );

  const sorted = sortArticles(articles, sortKey, sortDir);

  // GSC not connected state
  if (!loading && gscNotConnected) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Analytics"
          description="Track how your published articles perform in Google Search."
        />
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-[var(--surface-sunken)] flex items-center justify-center">
            <svg className="w-7 h-7 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <p className="font-medium text-[var(--text-primary)]">Google Search Console not connected</p>
          <p className="text-sm text-[var(--text-secondary)] max-w-xs">
            Connect your Google Search Console account to see how your published articles are performing in search.
          </p>
          <Link
            href="/app/settings"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity mt-2"
          >
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Track how your published articles perform in Google Search (last 28 days)."
      />

      {/* Sub-navigation */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-lg bg-[var(--accent-light)] px-3 py-1.5 text-xs font-medium text-[var(--accent)]">
          Performance
        </span>
        <Link
          href="/app/analytics/content-gaps"
          className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] transition-colors"
        >
          Content Gaps
        </Link>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-5 space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[var(--error-light)] flex items-center justify-center">
            <svg className="w-6 h-6 text-[var(--error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-[var(--text-primary)]">Failed to load analytics</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && articles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-[var(--surface-sunken)] flex items-center justify-center">
            <svg className="w-7 h-7 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="font-medium text-[var(--text-primary)]">No performance data yet</p>
          <p className="text-sm text-[var(--text-secondary)] max-w-xs">
            Published articles will appear here once Google Search Console starts reporting data for them.
          </p>
        </div>
      )}

      {/* Data table */}
      {!loading && !error && articles.length > 0 && (
        <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--surface-raised)]">
                  <th className="text-left px-4 py-3">
                    <SortHeader label="Article Title" sortKey="title" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">
                    <SortHeader label="Platform" sortKey="platform" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">
                    <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">URL</span>
                  </th>
                  <th className="text-right px-4 py-3">
                    <SortHeader label="Clicks" sortKey="clicks" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" />
                  </th>
                  <th className="text-right px-4 py-3">
                    <SortHeader label="Impressions" sortKey="impressions" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" />
                  </th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">
                    <SortHeader label="CTR%" sortKey="ctr" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" />
                  </th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">
                    <SortHeader label="Avg Pos" sortKey="position" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="justify-end" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {sorted.map((article) => (
                  <tr
                    key={`${article.articleId}-${article.url}`}
                    className="hover:bg-[var(--surface-sunken)] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-[var(--text-primary)] line-clamp-1">{article.title}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="inline-flex items-center rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)] capitalize">
                        {article.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell max-w-[200px]">
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--accent)] hover:underline truncate block"
                      >
                        {article.url.replace(/^https?:\/\//, "")}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--text-primary)]">
                      {article.clicks.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--text-primary)]">
                      {article.impressions.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--text-secondary)] hidden sm:table-cell">
                      {article.ctr}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--text-secondary)] hidden sm:table-cell">
                      {article.position}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
