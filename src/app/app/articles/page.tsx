"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { format, parseISO, differenceInDays, differenceInWeeks, differenceInMonths } from "date-fns";
import { EmptyState } from "@/components/ui/empty-state";

type Lifecycle =
  | "draft"
  | "scheduled"
  | "published"
  | "needs_refresh"
  | "archived";

interface Article {
  id: string;
  title: string;
  topic: string;
  slug: string | null;
  posted: boolean;
  published_platform: string | null;
  created_at: string;
  updated_at: string;
  word_count: number | null;
  publish_at: string | null;
  focus_keyword: string | null;
  lifecycle: Lifecycle | null;
}

const PLATFORM_LABELS: Record<string, string> = {
  wordpress: "WordPress",
  shopify: "Shopify",
  ghost: "Ghost",
  medium: "Medium",
  devto: "Dev.to",
  notion: "Notion",
  webflow: "Webflow",
  webhook: "Webhook",
};

type SortKey = "created_at" | "word_count" | "published_platform";
type FilterKey =
  | "all"
  | "published"
  | "scheduled"
  | "draft"
  | "needs_refresh"
  | "archived";

const FILTER_TABS: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "scheduled", label: "Scheduled" },
  { key: "draft", label: "Drafts" },
  { key: "needs_refresh", label: "Needs refresh" },
  { key: "archived", label: "Archived" },
];

const LIFECYCLE_BADGE: Record<
  Lifecycle,
  { label: string; bg: string; fg: string }
> = {
  published: {
    label: "Published",
    bg: "var(--success-light)",
    fg: "var(--success)",
  },
  scheduled: {
    label: "Scheduled",
    bg: "var(--accent-light)",
    fg: "var(--accent)",
  },
  needs_refresh: {
    label: "Needs refresh",
    bg: "var(--warning-light)",
    fg: "var(--warning)",
  },
  draft: {
    label: "Draft",
    bg: "var(--surface-sunken)",
    fg: "var(--text-tertiary)",
  },
  archived: {
    label: "Archived",
    bg: "var(--surface-sunken)",
    fg: "var(--text-tertiary)",
  },
};

function LifecycleBadge({ lifecycle }: { lifecycle: Lifecycle | null }) {
  const key: Lifecycle = lifecycle ?? "draft";
  const cfg = LIFECYCLE_BADGE[key];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
      style={{ backgroundColor: cfg.bg, color: cfg.fg }}
    >
      {cfg.label}
    </span>
  );
}

function ageLabel(isoDate: string): string {
  const now = new Date();
  const date = parseISO(isoDate);
  const months = differenceInMonths(now, date);
  if (months >= 1) return `${months}mo ago`;
  const weeks = differenceInWeeks(now, date);
  if (weeks >= 1) return `${weeks}w ago`;
  const days = differenceInDays(now, date);
  if (days >= 1) return `${days}d ago`;
  return "Today";
}

function WordCountBar({ count }: { count: number | null }) {
  if (count === null) return null;
  const TARGET = 2000;
  const pct = Math.min(100, Math.round((count / TARGET) * 100));
  const colorClass =
    count >= 1200
      ? "bg-green-500"
      : count >= 600
      ? "bg-yellow-400"
      : "bg-red-400";
  return (
    <div className="mt-2 h-1 w-full rounded-full bg-[var(--border-default)] overflow-hidden">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ArticlesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clusterId = searchParams.get("cluster");
  const supabase = createClient();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }

      let query = supabase
        .from("articles")
        .select(
          "id, title, topic, slug, posted, published_platform, created_at, updated_at, word_count, publish_at, focus_keyword, lifecycle"
        )
        .eq("user_id", user.id);
      if (clusterId) {
        query = query.eq("cluster_id", clusterId);
      }
      const { data } = await query.order("created_at", { ascending: false });

      setArticles((data ?? []) as Article[]);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterId]);

  const filtered = useMemo(() => {
    let list = articles.filter((a) => {
      const matchesSearch =
        !search ||
        (a.title || a.topic).toLowerCase().includes(search.toLowerCase());
      const lifecycle: Lifecycle | null = a.lifecycle ?? null;
      let matchesFilter = false;
      if (filter === "all") {
        // Hide archived from "all" by default unless explicitly selected.
        matchesFilter = lifecycle !== "archived";
      } else if (filter === "published") {
        // Backward compat: include legacy posted=true rows even if lifecycle hasn't been backfilled.
        matchesFilter = lifecycle === "published" || a.posted;
      } else if (filter === "scheduled") {
        matchesFilter = lifecycle === "scheduled";
      } else if (filter === "draft") {
        matchesFilter = (lifecycle === "draft" || lifecycle === null) && !a.posted;
      } else if (filter === "needs_refresh") {
        matchesFilter = lifecycle === "needs_refresh";
      } else if (filter === "archived") {
        matchesFilter = lifecycle === "archived";
      }
      return matchesSearch && matchesFilter;
    });

    list = [...list].sort((a, b) => {
      if (sortKey === "word_count") {
        return (b.word_count ?? -1) - (a.word_count ?? -1);
      }
      if (sortKey === "published_platform") {
        const pa = a.published_platform ?? "";
        const pb = b.published_platform ?? "";
        return pa.localeCompare(pb);
      }
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    return list;
  }, [articles, search, filter, sortKey]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">
            Content History
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {articles.length} article{articles.length !== 1 ? "s" : ""}{" "}
            generated
          </p>
        </div>
        <Link
          href="/app/generate"
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors"
        >
          + New Article
        </Link>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            placeholder="Search articles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
          />
        </div>

        {/* Status tabs */}
        <div className="flex rounded-lg border border-[var(--border-default)] overflow-hidden text-sm">
          {(["all", "published", "draft"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface-base)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Sort by */}
        <div className="flex items-center gap-1.5 text-sm">
          <span className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
            Sort:
          </span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-2 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] cursor-pointer"
          >
            <option value="created_at">Created</option>
            <option value="word_count">Word Count</option>
            <option value="published_platform">Published</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 p-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)]"
            >
              <div
                className="h-4 rounded skeleton"
                style={{ width: `${50 + (i % 4) * 12}%` }}
              />
              <div className="flex gap-2">
                <div className="h-3 w-16 rounded-full skeleton" />
                <div className="h-3 w-20 rounded-full skeleton" />
              </div>
              <div className="flex gap-2">
                <div className="h-3 w-24 rounded-full skeleton" />
                <div className="h-3 w-14 rounded-full skeleton" />
              </div>
              <div className="h-1 w-full rounded-full skeleton" />
              <div className="h-7 w-full rounded-md skeleton mt-1" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="✍️"
          title="No articles yet"
          description="Generate your first SEO article in minutes."
          action={{ label: "Write First Article", href: "/app/generate" }}
        />
      ) : (
        <div className="rounded-xl border border-[var(--border-default)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--surface-sunken)]">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)] hidden sm:table-cell">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)] hidden md:table-cell">
                  Platform
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)] hidden lg:table-cell">
                  Created
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)] bg-[var(--surface-base)]">
              {filtered.map((article) => (
                <tr
                  key={article.id}
                  className="hover:bg-[var(--surface-sunken)] transition-colors"
                >
                  {/* Title cell — enriched */}
                  <td className="px-4 py-3 max-w-0 w-full">
                    <Link
                      href={`/app/publish/${article.id}`}
                      className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline line-clamp-1 transition-colors"
                    >
                      {article.title || article.topic}
                    </Link>

                    {/* Focus keyword chip */}
                    {article.focus_keyword && (
                      <span className="mt-1 inline-block rounded-full bg-[var(--surface-sunken)] border border-[var(--border-default)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] leading-none">
                        {article.focus_keyword}
                      </span>
                    )}

                    {/* Slug */}
                    {article.slug && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">
                        /{article.slug}
                      </p>
                    )}

                    {/* Word count progress bar */}
                    <WordCountBar count={article.word_count} />

                    {/* Word count badge */}
                    {article.word_count != null && (
                      <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                        {article.word_count.toLocaleString()} words
                      </p>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        article.posted
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-[var(--surface-sunken)] text-[var(--text-secondary)] border border-[var(--border-default)]"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${article.posted ? "bg-green-500" : "bg-[var(--text-tertiary)]"}`}
                      />
                      {article.posted ? "Published" : "Draft"}
                    </span>
                  </td>

                  {/* Platform */}
                  <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap">
                    {article.published_platform ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <svg
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          className="h-3 w-3 shrink-0"
                        >
                          <path
                            fillRule="evenodd"
                            d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {PLATFORM_LABELS[article.published_platform] ??
                          article.published_platform}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--text-tertiary)]">
                        —
                      </span>
                    )}
                  </td>

                  {/* Created (age indicator) */}
                  <td className="px-4 py-3 hidden lg:table-cell whitespace-nowrap">
                    <span
                      className="text-xs text-[var(--text-tertiary)]"
                      title={format(parseISO(article.created_at), "MMM d, yyyy")}
                    >
                      {ageLabel(article.created_at)}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/app/publish/${article.id}`}
                      className="rounded-md border border-[var(--border-default)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
