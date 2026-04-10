"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";

/* ─── Checkmark SVG ─── */
function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-4 h-4 text-[#3B82F6] flex-shrink-0 mt-0.5"
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* ─── Section 1 visual: dark terminal article generation card ─── */
function ArticleGenerationCard() {
  return (
    <MagicCard
      className="rounded-2xl overflow-hidden w-full max-w-lg"
      gradientColor="#1e40af30"
    >
      <div className="rounded-2xl bg-[#0f172a] overflow-hidden w-full max-w-lg">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="w-3 h-3 rounded-full bg-yellow-400" />
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span className="ml-3 text-[12px] text-white/40">article-generation.md</span>
        </div>

        {/* Skeleton content */}
        <div className="px-5 py-5 space-y-4">
          {/* Fake H1 */}
          <div className="h-3 rounded bg-white/20" style={{ width: "72%" }} />
          {/* Fake body block 1 */}
          <div className="space-y-1.5">
            <div className="h-2 rounded bg-white/10" style={{ width: "96%" }} />
            <div className="h-2 rounded bg-white/10" style={{ width: "89%" }} />
            <div className="h-2 rounded bg-white/10" style={{ width: "93%" }} />
            <div className="h-2 rounded bg-white/10" style={{ width: "62%" }} />
          </div>
          {/* Fake H2 */}
          <div className="h-2.5 rounded bg-white/15 mt-3" style={{ width: "50%" }} />
          {/* Fake body block 2 */}
          <div className="space-y-1.5">
            <div className="h-2 rounded bg-white/10" style={{ width: "91%" }} />
            <div className="h-2 rounded bg-white/10" style={{ width: "85%" }} />
            <div className="h-2 rounded bg-white/10" style={{ width: "74%" }} />
          </div>
          {/* Fake H2 */}
          <div className="h-2.5 rounded bg-white/15 mt-3" style={{ width: "44%" }} />
          <div className="space-y-1.5">
            <div className="h-2 rounded bg-white/10" style={{ width: "88%" }} />
            <div className="h-2 rounded bg-white/10" style={{ width: "79%" }} />
          </div>

          {/* Status footer */}
          <div className="flex items-center gap-3 pt-3 border-t border-white/10">
            <span className="text-[12px] text-white/40">2,847 words</span>
            <span className="text-white/20">·</span>
            <span className="text-[12px] text-white/40">SEO:</span>
            <span className="text-[12px] font-bold text-white">94</span>
          </div>
        </div>
      </div>
    </MagicCard>
  );
}

/* ─── Section 2 visual: publishing platforms card ─── */
const publishPlatforms = [
  "WordPress",
  "Shopify",
  "Ghost",
  "Medium",
  "Dev.to",
  "Notion",
  "Webflow",
  "HubSpot",
];

function PublishingCard() {
  return (
    <MagicCard
      className="rounded-2xl overflow-hidden w-full max-w-lg"
      gradientColor="#3B82F620"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-full bg-[#111827] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[11px] font-bold">AG</span>
          </div>
          <span className="text-[14px] font-semibold text-[#111827]">ArticleGen</span>
          <span className="ml-auto text-[12px] bg-[#F1F3F5] px-2 py-1 rounded-full text-[#6B7280]">
            Publishing...
          </span>
        </div>

        {/* 4x2 platform grid */}
        <div className="grid grid-cols-4 gap-2">
          {publishPlatforms.map((platform) => (
            <div
              key={platform}
              className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg p-3 text-center"
            >
              <span className="text-[13px] font-semibold text-[#111827] leading-tight">
                {platform}
              </span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-5 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-[#E5E7EB] overflow-hidden">
            <div className="h-full rounded-full bg-[#2563EB] w-full" />
          </div>
          <span className="text-[12px] text-[#9CA3AF] flex-shrink-0">8 / 8 published</span>
        </div>
      </div>
    </MagicCard>
  );
}

/* ─── Section 3 visual: analytics keyword rankings card ─── */
const rankingData = [
  { keyword: "best SEO practices", position: "#2", bar: 90 },
  { keyword: "content marketing tools", position: "#4", bar: 72 },
  { keyword: "AI article generator", position: "#6", bar: 58 },
  { keyword: "blog automation", position: "#9", bar: 38 },
  { keyword: "publish to WordPress", position: "#14", bar: 22 },
];

function AnalyticsCard() {
  return (
    <MagicCard
      className="rounded-2xl overflow-hidden w-full max-w-lg"
      gradientColor="#3B82F620"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
            Keyword Rankings
          </span>
          <span className="text-[12px] text-[#9CA3AF]">Last 30 days</span>
        </div>

        {/* Keyword rows */}
        <div className="space-y-3">
          {rankingData.map((row) => (
            <div key={row.keyword}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[14px] text-[#111827] truncate max-w-[240px]">
                  {row.keyword}
                </span>
                <span className="text-[13px] font-bold text-[#111827] flex-shrink-0 ml-2">
                  {row.position}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#2563EB]"
                  style={{ width: `${row.bar}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </MagicCard>
  );
}

/* ─── Feature section data ─── */
type FeatureData = {
  label: string;
  headline: string;
  description: string;
  bullets: string[];
  cta: string;
  bg: string;
  visualLeft: boolean;
  visual: React.ReactNode;
};

/* ─── Single feature section ─── */
function FeatureSection({ data }: { data: FeatureData }) {
  const textBlock = (
    <BlurFade inView delay={0.1}>
      <div className="flex flex-col justify-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#3B82F6] mb-2">
          {data.label}
        </p>
        <h2 className="text-[28px] lg:text-[36px] font-bold text-[#111827] leading-[1.2] tracking-[-0.01em] mt-2">
          {data.headline}
        </h2>
        <p className="text-[16px] text-[#6B7280] leading-[1.6] max-w-[480px] mt-4">
          {data.description}
        </p>
        <ul className="mt-4 space-y-2">
          {data.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckIcon />
              <span className="text-[14px] text-[#6B7280]">{bullet}</span>
            </li>
          ))}
        </ul>
        <a
          href="#"
          className="mt-6 inline-flex items-center gap-1 text-[16px] font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors w-fit"
        >
          {data.cta} &rarr;
        </a>
      </div>
    </BlurFade>
  );

  const visualBlock = (
    <BlurFade inView delay={0.2}>
      <div className="flex items-center justify-center">{data.visual}</div>
    </BlurFade>
  );

  return (
    <section className={`${data.bg} py-16 lg:py-20`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {data.visualLeft ? (
            <>
              {visualBlock}
              {textBlock}
            </>
          ) : (
            <>
              {textBlock}
              {visualBlock}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── Main export ─── */
export function FeatureSections() {
  const sections: FeatureData[] = [
    {
      label: "AI Generation",
      headline: "From keyword to publish-ready article in 60 seconds",
      description:
        "ArticleGen researches your topic, builds a structured outline, and writes a full SEO-optimized article — complete with headings, internal links, and metadata.",
      bullets: [
        "Keyword research built-in",
        "2,000–4,000 word articles",
        "SEO score of 90+ guaranteed",
      ],
      cta: "See how it works",
      bg: "bg-[#FFFFFF]",
      visualLeft: true,
      visual: <ArticleGenerationCard />,
    },
    {
      label: "Publishing",
      headline: "Publish to 8 platforms with one click",
      description:
        "Connect WordPress, Shopify, Ghost, Medium, Dev.to, Notion, Webflow, and HubSpot once — then reach all of them simultaneously.",
      bullets: [
        "No reformatting needed",
        "Schedule or publish instantly",
        "Per-platform custom settings",
      ],
      cta: "View integrations",
      bg: "bg-[#F1F3F5]",
      visualLeft: false,
      visual: <PublishingCard />,
    },
    {
      label: "Analytics",
      headline: "See exactly what ranks and why",
      description:
        "Connect Google Search Console and surface which articles are climbing, which are stalling, and where to focus next.",
      bullets: [
        "GSC integration built-in",
        "Keyword position tracking",
        "Article update recommendations",
      ],
      cta: "Explore analytics",
      bg: "bg-[#FFFFFF]",
      visualLeft: true,
      visual: <AnalyticsCard />,
    },
  ];

  return (
    <>
      {sections.map((section) => (
        <FeatureSection key={section.label} data={section} />
      ))}
    </>
  );
}
