"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { format, parseISO } from "date-fns";

interface Cluster {
  id: string;
  pillar_topic: string;
  pillar_keyword: string | null;
  quality: string;
  pillar_article_id: string | null;
  existing_pillar_url: string | null;
  created_at: string;
  article_count: number;
}

const QUALITY_LABELS: Record<string, { label: string; color: string }> = {
  premium: {
    label: "Premium",
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  standard: {
    label: "Standard",
    color:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  basic: {
    label: "Basic",
    color:
      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
};

export default function ClustersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }

      // Fetch clusters
      const { data: clusterRows } = await supabase
        .from("clusters")
        .select(
          "id, pillar_topic, pillar_keyword, quality, pillar_article_id, existing_pillar_url, created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!clusterRows) {
        setLoading(false);
        return;
      }

      // Fetch article counts per cluster in one query
      const clusterIds = clusterRows.map((c) => c.id);
      const countMap: Record<string, number> = {};

      if (clusterIds.length > 0) {
        const { data: articleRows } = await supabase
          .from("articles")
          .select("cluster_id")
          .eq("user_id", user.id)
          .in("cluster_id", clusterIds);

        if (articleRows) {
          for (const row of articleRows) {
            if (row.cluster_id) {
              countMap[row.cluster_id] = (countMap[row.cluster_id] ?? 0) + 1;
            }
          }
        }
      }

      setClusters(
        clusterRows.map((c) => ({
          ...c,
          article_count: countMap[c.id] ?? 0,
        }))
      );
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = clusters.filter(
    (c) =>
      !search ||
      c.pillar_topic.toLowerCase().includes(search.toLowerCase()) ||
      (c.pillar_keyword ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Topic Clusters
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {clusters.length} cluster{clusters.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/app/generate"
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors"
        >
          + New Cluster
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
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
          placeholder="Search clusters…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-lg bg-[var(--surface-sunken)] animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] py-16 text-center">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="mx-auto h-8 w-8 text-[var(--text-tertiary)] mb-3"
          >
            <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
          </svg>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {search ? "No clusters match your search" : "No clusters yet"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            {!search &&
              "Create a topic cluster to organise related articles around a pillar topic"}
          </p>
          {!search && (
            <Link
              href="/app/generate"
              className="mt-4 inline-block rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors"
            >
              Create Cluster
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border-default)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--surface-sunken)]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                  Pillar Topic
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] hidden sm:table-cell">
                  Keyword
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] hidden md:table-cell">
                  Quality
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                  Articles
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] hidden lg:table-cell">
                  Created
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)] bg-[var(--surface-base)]">
              {filtered.map((cluster) => {
                const qualityMeta =
                  QUALITY_LABELS[cluster.quality] ?? QUALITY_LABELS.standard;
                return (
                  <tr
                    key={cluster.id}
                    className="hover:bg-[var(--surface-sunken)] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--text-primary)] line-clamp-1">
                        {cluster.pillar_topic}
                      </p>
                      {cluster.existing_pillar_url && (
                        <a
                          href={cluster.existing_pillar_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--accent)] truncate block mt-0.5"
                        >
                          {cluster.existing_pillar_url}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-[var(--text-secondary)]">
                        {cluster.pillar_keyword || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${qualityMeta.color}`}
                      >
                        {qualityMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-sunken)] border border-[var(--border-default)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-3 w-3 text-[var(--text-tertiary)]"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {cluster.article_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {format(parseISO(cluster.created_at), "MMM d, yyyy")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/app/articles?cluster=${cluster.id}`}
                        className="rounded-md border border-[var(--border-default)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        View Articles
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
