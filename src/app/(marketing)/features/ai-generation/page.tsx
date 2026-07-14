import type { Metadata } from "next";
import Link from "next/link";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";

export const metadata: Metadata = {
  title: "AI Article Generation – ArticleGen",
  description:
    "Generate publish-ready, SEO-optimized articles in under 60 seconds. ArticleGen researches your topic, drafts a structured outline, and writes a full long-form article with headings, meta description, schema markup, and internal links.",
};

const steps = [
  {
    number: "01",
    title: "Enter a topic or keyword",
    description:
      "You type a focus keyword or topic. ArticleGen immediately begins researching related questions, competing articles, and semantic keywords.",
  },
  {
    number: "02",
    title: "Review the AI outline",
    description:
      "A structured outline is generated in seconds. Edit any section, reorder headings, or approve as-is.",
  },
  {
    number: "03",
    title: "Generate & publish",
    description:
      "The full article is written — 2,000 to 4,000 words — and sent directly to your publishing platform.",
  },
];

const stats = [
  { value: "94 avg", label: "SEO score" },
  { value: "2,847", label: "Average word count" },
  { value: "<60s", label: "Generation time" },
];

export default function AiGenerationPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-white text-center">
        <div className="max-w-[720px] mx-auto px-6">
          <BlurFade inView delay={0.1}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] mb-3">
              AI Generation
            </p>
            <h1 className="text-[32px] md:text-[44px] font-bold text-[#111827] leading-[1.15]">
              From keyword to publish-ready article in 60 seconds
            </h1>
            <p className="text-[20px] text-[#6B7280] mt-3 max-w-[560px] mx-auto">
              ArticleGen researches your topic, drafts a structured outline, and
              writes a full SEO-optimized article — complete with headings, meta
              description, schema markup, and internal links.
            </p>
          </BlurFade>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-[#F8F9FA]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: steps */}
            <div>
              <BlurFade inView delay={0.1}>
                <h2 className="text-[28px] font-bold text-[#111827] mb-8">
                  How it works
                </h2>
              </BlurFade>
              <div className="space-y-8">
                {steps.map((step, i) => (
                  <BlurFade key={step.number} inView delay={0.15 + i * 0.05}>
                    <div className="flex gap-5">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center">
                        <span className="text-[13px] font-bold text-[#2563EB]">
                          {step.number}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-[17px] font-semibold text-[#111827] mb-1">
                          {step.title}
                        </h3>
                        <p className="text-[15px] text-[#6B7280] leading-[1.6]">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </BlurFade>
                ))}
              </div>
            </div>

            {/* Right: terminal mockup */}
            <BlurFade inView delay={0.2}>
              <div
                className="rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                style={{ background: "#0f172a" }}
              >
                {/* Title bar */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                  <span className="w-3 h-3 rounded-full bg-red-500/70" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <span className="w-3 h-3 rounded-full bg-green-500/70" />
                  <span className="ml-2 text-[12px] text-white/40 font-mono">
                    article-generator
                  </span>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 font-mono text-[13px]">
                  <div className="flex items-center gap-2">
                    <span className="text-[#34D399]">$</span>
                    <span className="text-white/80">
                      generate --keyword &quot;best crm software 2025&quot;
                    </span>
                  </div>
                  <div className="space-y-1 text-white/50">
                    <p>
                      <span className="text-[#60A5FA]">✓</span> Researching
                      topic...
                    </p>
                    <p>
                      <span className="text-[#60A5FA]">✓</span> Analysing top
                      10 SERP results...
                    </p>
                    <p>
                      <span className="text-[#60A5FA]">✓</span> Building
                      semantic keyword map...
                    </p>
                    <p>
                      <span className="text-[#60A5FA]">✓</span> Generating
                      outline (12 headings)...
                    </p>
                    <p>
                      <span className="text-[#60A5FA]">✓</span> Writing full
                      article (3,241 words)...
                    </p>
                  </div>

                  {/* Skeleton lines */}
                  <div className="space-y-2 pt-2">
                    <div className="h-2 rounded bg-white/10 w-full" />
                    <div className="h-2 rounded bg-white/10 w-5/6" />
                    <div className="h-2 rounded bg-white/10 w-4/6" />
                  </div>

                  {/* SEO badge */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-white/40 text-[12px]">
                      Generation complete
                    </span>
                    <span className="inline-flex items-center gap-1.5 bg-[#34D399]/15 text-[#34D399] text-[12px] font-semibold px-3 py-1 rounded-full">
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      SEO score: 96
                    </span>
                  </div>
                </div>
              </div>
            </BlurFade>
          </div>
        </div>
      </section>

      {/* Key stats */}
      <section className="py-12 bg-white">
        <div className="max-w-[900px] mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {stats.map((stat, i) => (
              <BlurFade key={stat.label} inView delay={0.1 + i * 0.05}>
                <div className="text-center p-8 rounded-2xl border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                  <p className="text-[40px] font-bold text-[#111827] leading-none">
                    {stat.value}
                  </p>
                  <p className="text-[14px] text-[#6B7280] mt-2">{stat.label}</p>
                </div>
              </BlurFade>
            ))}
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
