"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { format, parseISO } from "date-fns";

interface Article {
  id: string;
  title: string;
  topic: string;
  slug: string | null;
  posted: boolean;
  published_platform: string | null;
  created_at: string;
  updated_at: string;
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

export default function ArticlesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const { data } = await supabase
        .from("articles")
        .select("id, title, topic, slug, posted, published_platform, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setArticles(data ?? []);
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = articles.filter((a) => {
    const matchesSearch =
      !search ||
      (a.title || a.topic).toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "published" && a.posted) ||
      (filter === "draft" && !a.posted);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Content History</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {articles.length} article{articles.length !== 1 ? "s" : ""} generated
          </p>
        </div>
        <Link
          href="/app/generate"
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors"
        >
          + New Article
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            placeholder="Search articles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
          />
        </div>
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
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-[var(--surface-sunken)] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] py-16 text-center">
          <svg viewBox="0 0 20 20" fill="currentColor" className="mx-auto h-8 w-8 text-[var(--text-tertiary)] mb-3">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {search ? "No articles match your search" : "No articles yet"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            {!search && "Generate your first article to get started"}
          </p>
          {!search && (
            <Link
              href="/app/generate"
              className="mt-4 inline-block rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors"
            >
              Generate Article
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border-default)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--surface-sunken)]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] hidden sm:table-cell">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] hidden md:table-cell">Platform</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] hidden lg:table-cell">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)] bg-[var(--surface-base)]">
              {filtered.map((article) => (
                <tr key={article.id} className="hover:bg-[var(--surface-sunken)] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--text-primary)] line-clamp-1">
                      {article.title || article.topic}
                    </p>
                    {article.slug && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">/{article.slug}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      article.posted
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${article.posted ? "bg-green-500" : "bg-gray-400"}`} />
                      {article.posted ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-[var(--text-secondary)]">
                      {article.published_platform
                        ? PLATFORM_LABELS[article.published_platform] ?? article.published_platform
                        : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {format(parseISO(article.created_at), "MMM d, yyyy")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
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
