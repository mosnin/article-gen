"use client";

/* ─── Section 1: Article Generation ─── */
function ArticleGenerationCard() {
  return (
    <div className="rounded-2xl bg-[#0a0a0a] border border-gray-800 overflow-hidden w-full max-w-lg">
      {/* Input bar */}
      <div className="px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3 bg-[#1a1a1a] rounded-lg px-4 py-3 border border-gray-700">
          <span className="text-gray-500 text-xs flex-shrink-0">Prompt</span>
          <span className="text-gray-300 text-sm">
            Write me an article about best SEO practices in 2025
          </span>
        </div>
      </div>

      {/* Output panel */}
      <div className="px-5 py-5 space-y-4">
        <span className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
          Article Output
        </span>

        <div className="space-y-2.5">
          {/* Fake title line */}
          <div className="h-3 rounded bg-gray-700" style={{ width: "78%" }} />
          {/* Fake body lines */}
          <div className="space-y-1.5 pt-1">
            <div className="h-2 rounded bg-gray-800" style={{ width: "95%" }} />
            <div className="h-2 rounded bg-gray-800" style={{ width: "88%" }} />
            <div className="h-2 rounded bg-gray-800" style={{ width: "92%" }} />
            <div className="h-2 rounded bg-gray-800" style={{ width: "65%" }} />
          </div>
          {/* Fake subheading */}
          <div className="h-2.5 rounded bg-gray-700 mt-3" style={{ width: "52%" }} />
          <div className="space-y-1.5 pt-1">
            <div className="h-2 rounded bg-gray-800" style={{ width: "90%" }} />
            <div className="h-2 rounded bg-gray-800" style={{ width: "84%" }} />
            <div className="h-2 rounded bg-gray-800" style={{ width: "72%" }} />
          </div>
        </div>

        {/* Footer stats */}
        <div className="flex items-center gap-4 pt-2 border-t border-gray-800">
          <span className="text-xs text-gray-500">2,847 words</span>
          <span className="text-gray-700">·</span>
          <span className="text-xs text-gray-500">SEO Score:</span>
          <span className="text-xs font-bold text-white">94</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Section 2: Publishing platforms card ─── */
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
    <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden w-full max-w-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center">
          <span className="text-white text-xs font-bold">AG</span>
        </div>
        <span className="text-sm font-semibold text-gray-800">ArticleGen</span>
        <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
          Publishing...
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {publishPlatforms.map((p) => (
          <div
            key={p}
            className="flex items-center justify-center px-2 py-3 rounded-lg border border-gray-200 bg-gray-50 text-center"
          >
            <span className="text-xs font-semibold text-gray-700 leading-tight">
              {p}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full bg-gray-900" style={{ width: "100%" }} />
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">8 / 8 published</span>
      </div>
    </div>
  );
}

/* ─── Section 3: Analytics bar chart ─── */
const rankingData = [
  { keyword: "best SEO practices", position: 2, bar: 90, color: "bg-gray-900" },
  { keyword: "content marketing tools", position: 4, bar: 72, color: "bg-gray-700" },
  { keyword: "AI article generator", position: 6, bar: 58, color: "bg-gray-500" },
  { keyword: "blog automation", position: 9, bar: 38, color: "bg-gray-400" },
  { keyword: "publish to WordPress", position: 14, bar: 22, color: "bg-gray-300" },
];

function AnalyticsChart() {
  return (
    <div className="w-full max-w-lg space-y-3">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
          Keyword Rankings
        </span>
        <span className="text-xs text-gray-400">Last 30 days</span>
      </div>

      {rankingData.map((row) => (
        <div key={row.keyword} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 truncate max-w-[260px]">
              {row.keyword}
            </span>
            <span className="text-xs font-bold text-gray-900 flex-shrink-0 ml-2">
              #{row.position}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${row.color}`}
              style={{ width: `${row.bar}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main export ─── */
export function FeatureSections() {
  return (
    <>
      {/* ── Section 1: dark card left, text right ── */}
      <section className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: dark UI card */}
            <div className="flex justify-center lg:justify-start">
              <ArticleGenerationCard />
            </div>

            {/* Right: text */}
            <div className="space-y-6">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                AI Generation
              </p>
              <h2 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight text-gray-900">
                From keyword to publish-ready article in 60 seconds
              </h2>
              <p className="text-base leading-relaxed text-gray-500 max-w-md">
                ArticleGen researches your topic, builds a structured outline, and
                writes a full SEO-optimized article — complete with headings,
                internal links, and metadata — ready to publish the moment it
                finishes.
              </p>
              <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:border-gray-900 hover:text-gray-900 transition-colors">
                See how it works →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: text left, light card right ── */}
      <section className="py-24 bg-[#f9f9f9]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: text */}
            <div className="space-y-6">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Publishing
              </p>
              <h2 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight text-gray-900">
                Publish to 8 platforms with one click
              </h2>
              <p className="text-base leading-relaxed text-gray-500 max-w-md">
                Connect WordPress, Shopify, Ghost, Medium, Dev.to, Notion,
                Webflow, and HubSpot once. Then hit publish and reach all of
                them simultaneously — no copy-pasting, no reformatting.
              </p>
              <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:border-gray-900 hover:text-gray-900 transition-colors">
                View integrations →
              </button>
            </div>

            {/* Right: platform grid card */}
            <div className="flex justify-center lg:justify-end">
              <PublishingCard />
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: dark/light split ── */}
      <section className="min-h-[480px] flex flex-col lg:flex-row">
        {/* Left half: dark */}
        <div className="lg:w-1/2 bg-[#0a0a0a] px-8 sm:px-12 lg:px-16 py-24 flex items-center">
          <div className="max-w-md space-y-6">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
              Analytics
            </p>
            <h2 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight text-white">
              See exactly what&apos;s ranking and why
            </h2>
            <p className="text-base leading-relaxed text-gray-400">
              Connect Google Search Console and instantly surface which articles
              are climbing, which are stalling, and where to focus your next
              piece. Turn data into your next publish.
            </p>
            <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-700 text-sm font-semibold text-gray-300 hover:border-gray-400 hover:text-white transition-colors">
              Explore analytics →
            </button>
          </div>
        </div>

        {/* Right half: light */}
        <div className="lg:w-1/2 bg-[#f9f9f9] px-8 sm:px-12 lg:px-16 py-24 flex items-center">
          <AnalyticsChart />
        </div>
      </section>
    </>
  );
}
