"use client";

import { useEffect, useState } from "react";
import type { ArticleAuditItem } from "@/app/api/audit/route";

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : score >= 40 ? "bg-yellow-50 text-yellow-700 border-yellow-200"
    : "bg-red-50 text-red-600 border-red-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${color}`}>
      {score}/100
    </span>
  );
}

function HealthDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
  );
}

export default function ContentAuditPage() {
  const [items, setItems] = useState<ArticleAuditItem[]>([]);
  const [summary, setSummary] = useState<{ total: number; published: number; needsRefresh: number; thin: number; noImages: number; avgScore: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "refresh" | "thin" | "no-images">("all");

  useEffect(() => {
    fetch("/api/audit")
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setSummary(d.summary ?? null); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(i => {
    if (filter === "refresh") return i.needsRefresh;
    if (filter === "thin") return i.wordCountHealth === "thin";
    if (filter === "no-images") return !i.hasImages;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#111827]">Content Audit</h1>
        <p className="text-[#6B7280] mt-1">Health check across all your articles</p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {[
            { label: "Total Articles", value: summary.total, color: "text-[#111827]" },
            { label: "Published", value: summary.published, color: "text-emerald-600" },
            { label: "Avg Score", value: `${summary.avgScore}/100`, color: summary.avgScore >= 70 ? "text-emerald-600" : "text-yellow-600" },
            { label: "Needs Refresh", value: summary.needsRefresh, color: summary.needsRefresh > 0 ? "text-orange-600" : "text-[#6B7280]" },
            { label: "Thin Content", value: summary.thin, color: summary.thin > 0 ? "text-red-600" : "text-[#6B7280]" },
            { label: "No Images", value: summary.noImages, color: summary.noImages > 0 ? "text-red-600" : "text-[#6B7280]" },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-[#6B7280] mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {([["all", "All"], ["refresh", "Needs Refresh"], ["thin", "Thin Content"], ["no-images", "No Images"]] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filter === val
                ? "bg-[#111827] text-white border-[#111827]"
                : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#111827] hover:text-[#111827]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-[#6B7280]">Auditing your content…</div>
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Article</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Score</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Words</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide hidden sm:table-cell">Images</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide hidden sm:table-cell">FAQ</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide hidden md:table-cell">Age</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-[#6B7280]">No articles match this filter</td></tr>
              )}
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#111827] truncate max-w-[260px]">{item.title}</p>
                    {item.focusKeyword && <p className="text-xs text-[#9CA3AF] mt-0.5">{item.focusKeyword}</p>}
                    {item.needsRefresh && (
                      <span className="inline-block mt-1 text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                        ↻ Needs refresh
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center"><ScoreBadge score={item.score} /></td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs font-medium ${item.wordCountHealth === "good" ? "text-emerald-600" : "text-red-500"}`}>
                      {item.wordCount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center hidden sm:table-cell"><HealthDot ok={item.hasImages} /></td>
                  <td className="px-3 py-3 text-center hidden sm:table-cell"><HealthDot ok={item.hasFaq} /></td>
                  <td className="px-3 py-3 text-center hidden md:table-cell">
                    <span className="text-xs text-[#9CA3AF]">{item.ageInDays}d ago</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.isPublished ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {item.isPublished ? "Published" : "Draft"}
                    </span>
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
