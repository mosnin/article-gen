import type { Metadata } from "next";
import Link from "next/link";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";

export const metadata: Metadata = {
  title: "SEO & Analytics – ArticleGen",
  description:
    "Connect Google Search Console and get instant visibility into which articles are climbing, which are stalling, and where to focus your next content piece.",
};

const analyticsFeatures = [
  {
    title: "Keyword Position Tracking",
    description:
      "See your exact SERP position for every keyword across every article you've published.",
  },
  {
    title: "Article Update Recommendations",
    description:
      "ArticleGen identifies articles that are on page 2 and tells you exactly what to add to push them to page 1.",
  },
  {
    title: "GSC OAuth Integration",
    description:
      "Connect in one click with Google OAuth — no API keys, no setup headaches.",
  },
  {
    title: "Content Gap Analysis",
    description:
      "See which keywords your competitors rank for that you don't, so you always know what to write next.",
  },
];

export default function SeoAnalyticsPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-white text-center">
        <div className="max-w-[720px] mx-auto px-6">
          <BlurFade inView delay={0.1}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] mb-3">
              SEO & Analytics
            </p>
            <h1 className="text-[32px] md:text-[44px] font-bold text-[#111827] leading-[1.15]">
              See exactly what ranks and why
            </h1>
            <p className="text-[20px] text-[#6B7280] mt-3 max-w-[560px] mx-auto">
              Connect Google Search Console and get instant visibility into which
              articles are climbing, which are stalling, and where to focus your
              next content piece.
            </p>
          </BlurFade>
        </div>
      </section>

      {/* Features + chart */}
      <section className="py-16 bg-[#F8F9FA]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Left: feature cards */}
            <div className="space-y-4">
              {analyticsFeatures.map((feature, i) => (
                <BlurFade key={feature.title} inView delay={0.1 + i * 0.05}>
                  <MagicCard gradientColor="#3B82F615" className="rounded-xl">
                    <div className="p-6">
                      <h3 className="text-[17px] font-semibold text-[#111827] mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-[15px] text-[#6B7280] leading-[1.6]">
                        {feature.description}
                      </p>
                    </div>
                  </MagicCard>
                </BlurFade>
              ))}
            </div>

            {/* Right: analytics chart mockup */}
            <BlurFade inView delay={0.2}>
              <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
                {/* Card header */}
                <div className="px-6 py-4 border-b border-[#E5E7EB]">
                  <p className="text-[13px] font-semibold text-[#111827]">
                    Keyword Performance
                  </p>
                  <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                    Last 30 days · Google Search Console
                  </p>
                </div>

                {/* Chart area */}
                <div className="px-6 pt-5 pb-4">
                  {/* Y-axis labels + bar chart */}
                  <div className="flex items-end gap-2 h-[160px]">
                    {[65, 82, 74, 91, 78, 95, 88, 100, 92, 97, 85, 99].map(
                      (h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t-md transition-all"
                          style={{
                            height: `${h}%`,
                            background:
                              i === 11
                                ? "#2563EB"
                                : i >= 8
                                  ? "#93C5FD"
                                  : "#DBEAFE",
                          }}
                        />
                      )
                    )}
                  </div>
                  {/* X labels */}
                  <div className="flex justify-between mt-2">
                    <span className="text-[11px] text-[#9CA3AF]">Mar 1</span>
                    <span className="text-[11px] text-[#9CA3AF]">Mar 15</span>
                    <span className="text-[11px] text-[#9CA3AF]">Mar 28</span>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 border-t border-[#E5E7EB]">
                  {[
                    { label: "Avg. position", value: "4.2" },
                    { label: "Total clicks", value: "8,341" },
                    { label: "Impressions", value: "142K" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="px-4 py-4 text-center border-r border-[#E5E7EB] last:border-r-0"
                    >
                      <p className="text-[18px] font-bold text-[#111827]">
                        {stat.value}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Keyword rows */}
                <div className="px-6 py-4 border-t border-[#E5E7EB] space-y-3">
                  {[
                    { keyword: "best crm software", pos: 3, change: "+2" },
                    { keyword: "project management tools", pos: 7, change: "+5" },
                    { keyword: "email marketing tips", pos: 12, change: "-1" },
                  ].map((row) => (
                    <div
                      key={row.keyword}
                      className="flex items-center justify-between"
                    >
                      <span className="text-[13px] text-[#374151] truncate max-w-[180px]">
                        {row.keyword}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-[13px] font-semibold text-[#111827]">
                          #{row.pos}
                        </span>
                        <span
                          className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${
                            row.change.startsWith("+")
                              ? "bg-[#D1FAE5] text-[#059669]"
                              : "bg-[#FEE2E2] text-[#DC2626]"
                          }`}
                        >
                          {row.change}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </BlurFade>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[#F0F4FF] text-center">
        <div className="max-w-[720px] mx-auto px-6">
          <BlurFade inView delay={0.1}>
            <h2 className="text-[28px] font-bold text-[#111827]">
              Ready to start?
            </h2>
            <p className="text-[18px] text-[#6B7280] mt-2">
              Start your 3-day trial for $1 today.
            </p>
            <Link
              href="/trial"
              className="h-[52px] px-8 text-base font-semibold rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white mt-6 inline-flex items-center transition-colors"
            >
              Start your trial
            </Link>
          </BlurFade>
        </div>
      </section>
    </>
  );
}
