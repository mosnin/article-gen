"use client";

import { useEffect, useRef, useState } from "react";

/* ─── Scroll-entrance hook ─── */
function useVisible(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ─── Diagram 1: Terminal-style article generation ─── */
function ArticleGenerationDiagram() {
  return (
    <div className="rounded-2xl bg-gray-900 dark:bg-gray-950 shadow-2xl overflow-hidden border border-gray-700 dark:border-gray-800 max-w-md w-full">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 dark:bg-gray-900 border-b border-gray-700">
        <span className="w-3 h-3 rounded-full bg-red-500" />
        <span className="w-3 h-3 rounded-full bg-yellow-500" />
        <span className="w-3 h-3 rounded-full bg-green-500" />
        <span className="ml-2 text-xs text-gray-400 font-mono">articlegen — generate</span>
      </div>
      {/* Content */}
      <div className="px-5 py-5 font-mono text-sm space-y-3">
        <div className="space-y-1">
          <div className="flex gap-2">
            <span className="text-gray-500">Topic:</span>
            <span className="text-green-300">&ldquo;best CRM for B2B startups&rdquo;</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500">Keywords:</span>
            <span className="text-green-300">CRM, sales pipeline...</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500">Tone:</span>
            <span className="text-green-300">Professional</span>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-gray-300">
              <span className="text-green-400">▶</span> Researching...
            </span>
            <span className="text-green-400 text-xs">✓ Done</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-gray-300">
              <span className="text-green-400">▶</span> Generating outline
            </span>
            <span className="text-green-400 text-xs">✓ Done</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-gray-300">
                <span className="text-blue-400">▶</span> Writing article...
              </span>
              <span className="text-blue-400 text-xs">82%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
                style={{ width: "82%" }}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-3 flex items-center gap-4">
          <span className="text-green-400">📝</span>
          <span className="text-green-300 font-semibold">2,847 words</span>
          <span className="text-gray-500">·</span>
          <span className="text-yellow-300">SEO Score:</span>
          <span className="text-yellow-300 font-bold">94</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Diagram 2: Multi-platform publishing spoke ─── */
const platforms = [
  { name: "WordPress", color: "bg-blue-500 text-white", pos: "top-left" },
  { name: "Ghost", color: "bg-amber-500 text-white", pos: "top-right" },
  { name: "Medium", color: "bg-gray-900 text-white dark:bg-gray-700", pos: "mid-right" },
  { name: "Dev.to", color: "bg-indigo-600 text-white", pos: "bot-right" },
  { name: "Shopify", color: "bg-green-600 text-white", pos: "bot-left" },
  { name: "Notion", color: "bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-white", pos: "mid-left" },
  { name: "Webflow", color: "bg-purple-600 text-white", pos: "top-mid" },
  { name: "Webhook", color: "bg-rose-500 text-white", pos: "bot-mid" },
];

function PublishingDiagram() {
  return (
    <div className="relative flex items-center justify-center max-w-md w-full mx-auto select-none" style={{ height: 320 }}>
      {/* Center publish button */}
      <div className="absolute z-10 flex flex-col items-center justify-center w-20 h-20 rounded-full bg-blue-600 text-white shadow-xl border-4 border-blue-400/40">
        <span className="text-[10px] font-bold uppercase tracking-wide leading-tight text-center">Publish</span>
      </div>

      {/* Spokes + badges */}
      {platforms.map((p, i) => {
        const angle = (i / platforms.length) * 2 * Math.PI - Math.PI / 2;
        const radius = 120;
        const cx = Math.cos(angle) * radius;
        const cy = Math.sin(angle) * radius;
        return (
          <div
            key={p.name}
            className="absolute flex flex-col items-center"
            style={{
              transform: `translate(calc(${cx}px - 50%), calc(${cy}px - 50%))`,
              left: "50%",
              top: "50%",
            }}
          >
            <span
              className={`${p.color} rounded-full px-3 py-1.5 text-xs font-bold shadow whitespace-nowrap border border-white/20`}
            >
              {p.name}
            </span>
          </div>
        );
      })}

      {/* SVG lines from center to each badge */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 320 320"
        style={{ left: 0, top: 0 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {platforms.map((p, i) => {
          const angle = (i / platforms.length) * 2 * Math.PI - Math.PI / 2;
          const radius = 120;
          const cx = 160 + Math.cos(angle) * radius;
          const cy = 160 + Math.sin(angle) * radius;
          return (
            <line
              key={p.name}
              x1={160}
              y1={160}
              x2={cx}
              y2={cy}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              className="text-gray-300 dark:text-gray-600"
            />
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Diagram 3: Mini analytics dashboard ─── */
function AnalyticsDiagram() {
  return (
    <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden max-w-md w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Content Performance</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">Last 30 days</span>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Row 1 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate max-w-[160px]">
              &ldquo;best CRM startups&rdquo;
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Pos:</span>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">#4</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div className="h-full rounded-full bg-amber-400" style={{ width: "40%" }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">847 impressions</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
              <span className="text-xs text-gray-600 dark:text-gray-300">CTR: 3.2%</span>
              <a href="#" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                Optimize ↗
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-700" />

        {/* Row 2 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate max-w-[160px]">
              &ldquo;CRM comparison&rdquo;
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Pos:</span>
              <span className="text-xs font-bold text-green-600 dark:text-green-400">#2</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div className="h-full rounded-full bg-green-500" style={{ width: "80%" }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">2.1k impressions</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-xs text-gray-600 dark:text-gray-300">CTR: 8.7% — Great</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-700" />

        {/* Row 3 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate max-w-[160px]">
              &ldquo;SaaS sales tools 2025&rdquo;
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Pos:</span>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">#7</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div className="h-full rounded-full bg-blue-400" style={{ width: "28%" }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">312 impressions</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
              <span className="text-xs text-gray-600 dark:text-gray-300">CTR: 1.1%</span>
              <a href="#" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                Optimize ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Diagram 4: Content calendar ─── */
const calendarItems = [
  { day: "Mon", title: "SaaS onboarding tips", status: "published", icon: "✓", iconColor: "text-green-500" },
  { day: "Wed", title: "Product-led growth strategies", status: "published", icon: "✓", iconColor: "text-green-500" },
  { day: "Fri", title: "B2B email sequences", status: "scheduled", icon: "⏰", iconColor: "text-amber-500" },
  { day: "Mon", title: "CRM vs Spreadsheets", status: "draft", icon: "📝", iconColor: "text-blue-500" },
];

function CalendarDiagram() {
  return (
    <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden max-w-md w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-blue-600 text-white">
        <div className="flex items-center gap-2">
          <span className="text-base">📅</span>
          <span className="text-sm font-semibold">Content Calendar</span>
        </div>
        <span className="text-xs font-medium opacity-80">March 2026</span>
      </div>

      {/* Calendar rows */}
      <div className="px-5 py-4 space-y-3">
        {calendarItems.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700"
          >
            <div className="flex-shrink-0 w-9 text-center">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{item.day}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">{item.title}</p>
            </div>
            <span className={`text-base flex-shrink-0 ${item.iconColor}`}>{item.icon}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-gray-700">
        <button className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
          Approve All
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400">Next publish: 3 days</span>
      </div>
    </div>
  );
}

/* ─── Bullet list helper ─── */
function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 mt-4">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
          <span className="mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400 font-bold">✓</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ─── Feature section template ─── */
interface FeatureSectionProps {
  label: string;
  headline: string;
  description: string;
  bullets: string[];
  diagram: React.ReactNode;
  diagramLeft?: boolean;
  bgClass: string;
}

function FeatureSection({
  label,
  headline,
  description,
  bullets,
  diagram,
  diagramLeft = false,
  bgClass,
}: FeatureSectionProps) {
  const { ref, visible } = useVisible();

  const textBlock = (
    <div
      className={`transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-3">
        {label}
      </p>
      <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white mb-4">
        {headline}
      </h2>
      <p className="text-base leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
      <BulletList items={bullets} />
    </div>
  );

  const diagramBlock = (
    <div
      className={`flex justify-center transition-all duration-700 ease-out delay-150 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
    >
      {diagram}
    </div>
  );

  return (
    <section ref={ref} className={`${bgClass} py-20 lg:py-28`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {diagramLeft ? (
            <>
              {diagramBlock}
              {textBlock}
            </>
          ) : (
            <>
              {textBlock}
              {diagramBlock}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── Main export ─── */
export function FeatureSections() {
  return (
    <>
      <FeatureSection
        label="CONTENT GENERATION"
        headline="From keyword to 3,000-word article in minutes"
        description="ArticleGen researches your topic, generates a structured outline, writes the full article with proper heading hierarchy, internal links, and SEO metadata — ready to publish."
        bullets={[
          "E-E-A-T optimized content",
          "LSI keyword integration",
          "Custom brand voice",
          "500–8,000 word count control",
        ]}
        diagram={<ArticleGenerationDiagram />}
        diagramLeft={false}
        bgClass="bg-white dark:bg-gray-950"
      />

      <FeatureSection
        label="ONE-CLICK PUBLISHING"
        headline="Publish to 8 platforms the moment you're done writing"
        description="Connect your WordPress, Shopify, Ghost, Medium, Dev.to, Notion, Webflow accounts once. Then publish to all of them simultaneously with a single click."
        bullets={[
          "WordPress multi-blog support",
          "Shopify blog posts",
          "Medium canonical URLs",
          "Dev.to + Ghost + Notion + Webflow",
        ]}
        diagram={<PublishingDiagram />}
        diagramLeft={true}
        bgClass="bg-gray-50 dark:bg-gray-900"
      />

      <FeatureSection
        label="SEO INTELLIGENCE"
        headline="Connect Google Search Console and find content gaps instantly"
        description="Import your highest-potential keywords directly from GSC. See which articles are ranking, which are underperforming, and get one-click suggestions to optimize or create new content."
        bullets={[
          "GSC keyword import",
          "Published article performance",
          "Content gap analysis",
          "CTR improvement recommendations",
        ]}
        diagram={<AnalyticsDiagram />}
        diagramLeft={false}
        bgClass="bg-white dark:bg-gray-950"
      />

      <FeatureSection
        label="AUTOPILOT MODE"
        headline="Generate a 30-day content calendar and publish it automatically"
        description="Set your niche, keyword targets, and publishing cadence. ArticleGen's Autopilot generates your content plan, creates articles on schedule, and publishes them without you lifting a finger."
        bullets={[
          "AI-generated 30-day content plans",
          "Approval before publishing",
          "Smart scheduling",
          "Credit-based usage tracking",
        ]}
        diagram={<CalendarDiagram />}
        diagramLeft={true}
        bgClass="bg-gray-50 dark:bg-gray-900"
      />
    </>
  );
}
