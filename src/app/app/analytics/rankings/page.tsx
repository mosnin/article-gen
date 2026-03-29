"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import type { KeywordRanking } from "@/app/api/gsc/keyword-rankings/route";

const OPPORTUNITY_LABELS: Record<string, { label: string; color: string }> = {
  top3:    { label: "Reach Top 3",    color: "bg-blue-50 text-blue-700 border-blue-200" },
  snippet: { label: "Win Snippet",    color: "bg-purple-50 text-purple-700 border-purple-200" },
  page1:   { label: "Get to Page 1",  color: "bg-orange-50 text-orange-700 border-orange-200" },
  growing: { label: "Growing",        color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

function TrendArrow({ trend }: { trend: KeywordRanking["trend"] }) {
  if (trend === "up")   return <span className="text-emerald-500 font-bold">↑</span>;
  if (trend === "down") return <span className="text-red-400 font-bold">↓</span>;
  return <span className="text-[var(--text-tertiary)]">–</span>;
}

function PositionBar({ pos }: { pos: number }) {
  const pct = Math.max(0, Math.min(100, ((100 - pos) / 100) * 100));
  const color = pos <= 3 ? "bg-emerald-400" : pos <= 10 ? "bg-blue-400" : "bg-orange-300";
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-semibold tabular-nums w-8 text-right ${pos <= 3 ? "text-emerald-600" : pos <= 10 ? "text-blue-600" : "text-[var(--text-secondary)]"}`}>
        {pos}
      </span>
      <div className="w-20 h-1.5 rounded-full bg-[var(--border-light)] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function RankingsPage() {
  const [rankings, setRankings] = useState<KeywordRanking[]>([]);
  const [siteUrl, setSiteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "snippet" | "top3" | "page1" | "growing">("all");

  useEffect(() => {
    fetch("/api/gsc/keyword-rankings")
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setRankings(d.rankings ?? []);
        setSiteUrl(d.siteUrl ?? "");
      })
      .catch(() => setError("Failed to load rankings"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? rankings : rankings.filter(r => r.opportunity === filter);

  const summary = {
    top3: rankings.filter(r => r.position <= 3).length,
    top10: rankings.filter(r => r.position <= 10).length,
    rising: rankings.filter(r => r.trend === "up").length,
    opportunities: rankings.filter(r => r.opportunity !== null).length,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Keyword Rankings"
        description={siteUrl ? `Tracking ${rankings.length} keywords for ${siteUrl}` : "Google Search Console rank tracking"}
      />

      {error === "Google Search Console not connected" ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center space-y-3">
          <p className="text-[var(--text-secondary)]">Connect Google Search Console to track your keyword rankings.</p>
          <Link href="/app/integrations" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--brand)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
            Connect GSC
          </Link>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-[var(--bg-hover)] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Top 3", value: summary.top3, color: "text-emerald-600" },
              { label: "Top 10", value: summary.top10, color: "text-blue-600" },
              { label: "Rising", value: summary.rising, color: "text-purple-600" },
              { label: "Opportunities", value: summary.opportunities, color: "text-orange-600" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
                <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-2">
            {(["all", "snippet", "top3", "page1", "growing"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filter === f ? "bg-[var(--brand)] text-white border-[var(--brand)]" : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)]"}`}
              >
                {f === "all" ? `All (${rankings.length})` : OPPORTUNITY_LABELS[f]?.label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-hover)]">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Keyword</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] hidden sm:table-cell">Opportunity</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Position</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] hidden md:table-cell">Clicks</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] hidden md:table-cell">Impr.</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] hidden lg:table-cell">CTR</th>
                  <th className="text-center px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)]">
                {filtered.map((r, i) => (
                  <tr key={i} className="hover:bg-[var(--bg-hover)] transition-colors">
                    <td className="px-4 py-3 text-[var(--text-primary)] font-medium max-w-[200px] truncate">{r.query}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {r.opportunity && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${OPPORTUNITY_LABELS[r.opportunity]?.color}`}>
                          {OPPORTUNITY_LABELS[r.opportunity]?.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PositionBar pos={r.position} />
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)] tabular-nums hidden md:table-cell">{r.clicks.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)] tabular-nums hidden md:table-cell">{r.impressions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)] tabular-nums hidden lg:table-cell">{r.ctr}%</td>
                    <td className="px-4 py-3 text-center"><TrendArrow trend={r.trend} /></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--text-tertiary)]">No keywords found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
