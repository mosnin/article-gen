"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase-browser";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { CreditForecast } from "./components/CreditForecast";

interface Article {
  id: string;
  title: string;
  topic: string;
  posted: boolean;
  created_at: string;
}

interface Cluster {
  id: string;
  pillar_topic: string;
  phase: string;
  article_count?: number;
  created_at: string;
}

interface Stats {
  total: number;
  thisMonth: number;
  lastMonth: number;
  thisWeek: number;
  published: number;
  credits: number;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 80, h = 32, pad = 2;
  const pts = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline
        points={pts}
        fill="none"
        stroke="var(--brand)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatCard({
  label,
  value,
  description,
  loading,
  trend,
}: {
  label: string;
  value: number | string;
  description?: string;
  loading: boolean;
  trend?: number[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-sm font-medium text-[var(--text-secondary)]">{label}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-24" />
            {description !== undefined && <Skeleton className="h-4 w-32 mt-1" />}
          </>
        ) : (
          <>
            <div className="flex items-end justify-between gap-2">
              <p className="text-3xl font-bold text-[var(--text-primary)]">{value}</p>
              {trend && trend.length >= 2 && <Sparkline data={trend} />}
            </div>
            {description && (
              <p className="text-xs text-[var(--text-secondary)] mt-1">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [clustersLoading, setClustersLoading] = useState(true);

  const [stats, setStats] = useState<Stats>({
    total: 0,
    thisMonth: 0,
    lastMonth: 0,
    thisWeek: 0,
    published: 0,
    credits: 0,
  });
  const [weeklyTrend, setWeeklyTrend] = useState<number[]>([]);
  const [recentArticles, setRecentArticles] = useState<Article[]>([]);
  const [activeClusters, setActiveClusters] = useState<Cluster[]>([]);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      const userId = user.id;

      // Compute date boundaries
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // 8-week trend: start of the oldest week
      const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
      // Align to Monday of that week
      const dayOfWeek = eightWeeksAgo.getDay(); // 0=Sun
      const daysToMonday = (dayOfWeek + 6) % 7;
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - daysToMonday);
      eightWeeksAgo.setHours(0, 0, 0, 0);

      const [totalRes, thisMonthRes, lastMonthRes, thisWeekRes, publishedRes, creditsRes, trendRes] =
        await Promise.allSettled([
          supabase
            .from("articles")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId),
          supabase
            .from("articles")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("created_at", startOfMonth),
          supabase
            .from("articles")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("created_at", startOfLastMonth)
            .lt("created_at", endOfLastMonth),
          supabase
            .from("articles")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("created_at", sevenDaysAgo),
          supabase
            .from("articles")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("posted", true),
          fetch("/api/credits"),
          // Fetch created_at for all articles in the last 8 weeks to bucket by week client-side
          supabase
            .from("articles")
            .select("created_at")
            .eq("user_id", userId)
            .gte("created_at", eightWeeksAgo.toISOString()),
        ]);

      let credits = 0;
      if (creditsRes.status === "fulfilled") {
        try {
          const data = await creditsRes.value.json();
          if (!data.error) credits = data.credits ?? 0;
        } catch {
          /* silent */
        }
      }

      // Build weekly trend buckets
      const weekCounts = Array(8).fill(0);
      if (trendRes.status === "fulfilled" && trendRes.value.data) {
        for (const row of trendRes.value.data) {
          const ts = new Date(row.created_at).getTime();
          const weekIndex = Math.floor(
            (ts - eightWeeksAgo.getTime()) / (7 * 24 * 60 * 60 * 1000)
          );
          if (weekIndex >= 0 && weekIndex < 8) {
            weekCounts[weekIndex]++;
          }
        }
      }
      setWeeklyTrend(weekCounts);

      setStats({
        total: totalRes.status === "fulfilled" ? (totalRes.value.count ?? 0) : 0,
        thisMonth:
          thisMonthRes.status === "fulfilled" ? (thisMonthRes.value.count ?? 0) : 0,
        lastMonth:
          lastMonthRes.status === "fulfilled" ? (lastMonthRes.value.count ?? 0) : 0,
        thisWeek:
          thisWeekRes.status === "fulfilled" ? (thisWeekRes.value.count ?? 0) : 0,
        published:
          publishedRes.status === "fulfilled" ? (publishedRes.value.count ?? 0) : 0,
        credits,
      });

      setLoading(false);

      // Fetch recent articles
      const { data: articles } = await supabase
        .from("articles")
        .select("id, title, topic, posted, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      setRecentArticles(articles ?? []);
      setArticlesLoading(false);

      // Fetch active clusters
      const { data: clusters } = await supabase
        .from("clusters")
        .select("id, pillar_topic, phase, article_count, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      setActiveClusters(clusters ?? []);
      setClustersLoading(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute content velocity
  const velocityPct =
    stats.lastMonth > 0
      ? Math.round(((stats.thisMonth - stats.lastMonth) / stats.lastMonth) * 100)
      : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Welcome back. Here's an overview of your content."
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Total Articles"
          value={stats.total}
          description="All time"
          loading={loading}
          trend={weeklyTrend}
        />
        <StatCard
          label="This Month"
          value={stats.thisMonth}
          description={
            loading
              ? undefined
              : velocityPct !== null
              ? velocityPct >= 0
                ? `↑ ${velocityPct}% vs last month`
                : `↓ ${Math.abs(velocityPct)}% vs last month`
              : "Articles created"
          }
          loading={loading}
          trend={weeklyTrend}
        />
        <StatCard
          label="This Week"
          value={stats.thisWeek}
          description="Last 7 days"
          loading={loading}
          trend={weeklyTrend.slice(-4)}
        />
        <StatCard
          label="Published"
          value={stats.published}
          description="Posted to WordPress"
          loading={loading}
        />
        <CreditForecast />
      </div>

      {/* Content Velocity */}
      {!loading && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--text-secondary)]">Content Velocity:</span>
          {velocityPct === null ? (
            <span className="text-sm text-[var(--text-secondary)]">
              No data from last month
            </span>
          ) : velocityPct >= 0 ? (
            <span className="text-sm font-semibold text-green-600">
              ↑ {velocityPct}% vs last month
            </span>
          ) : (
            <span className="text-sm font-semibold text-red-500">
              ↓ {Math.abs(velocityPct)}% vs last month
            </span>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => router.push("/app/generate")}>
            Generate Article
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/app/generate?mode=cluster")}
          >
            Topic Cluster
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/app/settings")}
          >
            Import from GSC
          </Button>
        </div>
      </div>

      {/* Recent Articles */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Recent Articles
        </h2>
        <Card>
          {articlesLoading ? (
            <CardContent className="pt-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-16 shrink-0" />
                  <Skeleton className="h-4 w-20 shrink-0" />
                </div>
              ))}
            </CardContent>
          ) : recentArticles.length === 0 ? (
            <CardContent className="pt-6 flex flex-col items-center justify-center py-12 text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[var(--surface-sunken)] flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-[var(--text-secondary)]"
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
              <div>
                <p className="font-medium text-[var(--text-primary)]">No articles yet</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Get started by generating your first article.
                </p>
              </div>
              <Button onClick={() => router.push("/app/generate")}>
                Generate your first article
              </Button>
            </CardContent>
          ) : (
            <div className="divide-y divide-[var(--border-default)]">
              {recentArticles.map((article) => (
                <button
                  key={article.id}
                  className="w-full text-left px-6 py-4 flex items-center gap-4 hover:bg-[var(--surface-sunken)] transition-colors"
                  onClick={() => router.push(`/app/generate?id=${article.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--text-primary)] truncate">
                      {article.title || "(Untitled)"}
                    </p>
                    {article.topic && (
                      <p className="text-sm text-[var(--text-secondary)] truncate mt-0.5">
                        {article.topic}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={article.posted ? "success" : "neutral"}
                    className="shrink-0"
                  >
                    {article.posted ? "Published" : "Draft"}
                  </Badge>
                  <span className="text-xs text-[var(--text-secondary)] shrink-0 hidden sm:block">
                    {format(new Date(article.created_at), "MMM d, yyyy")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Active Clusters */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Active Clusters
        </h2>
        <Card>
          {clustersLoading ? (
            <CardContent className="pt-6 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-5 w-20 shrink-0" />
                  <Skeleton className="h-4 w-16 shrink-0" />
                </div>
              ))}
            </CardContent>
          ) : activeClusters.length === 0 ? (
            <CardContent className="pt-6 flex flex-col items-center justify-center py-12 text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[var(--surface-sunken)] flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-[var(--text-secondary)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)]">No clusters yet</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Create a topic cluster to organise your content strategy.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push("/app/generate?mode=cluster")}
              >
                Create a cluster
              </Button>
            </CardContent>
          ) : (
            <div className="divide-y divide-[var(--border-default)]">
              {activeClusters.map((cluster) => (
                <div
                  key={cluster.id}
                  className="px-6 py-4 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--text-primary)] truncate">
                      {cluster.pillar_topic}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Created {format(new Date(cluster.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  {cluster.phase && (
                    <Badge variant="default" className="shrink-0 capitalize">
                      {cluster.phase}
                    </Badge>
                  )}
                  {cluster.article_count !== undefined && (
                    <span className="text-sm text-[var(--text-secondary)] shrink-0">
                      {cluster.article_count}{" "}
                      {cluster.article_count === 1 ? "article" : "articles"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
