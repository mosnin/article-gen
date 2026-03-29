"use client";

import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { WordRotate } from "@/components/ui/word-rotate";
import { BlurFade } from "@/components/ui/blur-fade";
import { DotPattern } from "@/components/ui/dot-pattern";
import { BorderBeam } from "@/components/ui/border-beam";
import { StarButtonInner } from "@/components/ui/star-button";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white pt-32 pb-24 lg:pt-40 lg:pb-32">
      {/* Dot pattern background */}
      <DotPattern
        className={cn(
          "absolute inset-0 z-0 fill-gray-400/20 stroke-gray-400/10",
          "[mask-image:radial-gradient(ellipse_at_center,white_20%,transparent_80%)]"
        )}
        cr={1}
        width={20}
        height={20}
      />

      <div className="relative z-10 mx-auto max-w-[1200px] px-6">
        <div className="grid lg:grid-cols-[55fr_45fr] gap-12 items-center">

          {/* LEFT COLUMN */}
          <div>
            {/* Overline badge */}
            <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em]">
              <AnimatedGradientText colorFrom="#3B82F6" colorTo="#8B5CF6" speed={0.8}>
                AI Content Platform
              </AnimatedGradientText>
            </div>

            {/* Headline — WordRotate renders its own motion.h1 internally, so we use a div wrapper */}
            <div className="text-[36px] md:text-[56px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#111827] mt-4">
              Write once.{" "}
              <span className="block">
                Rank on{" "}
                <WordRotate
                  words={["WordPress", "Ghost", "Medium", "Dev.to", "Webflow", "Shopify"]}
                  className="text-[#2563EB]"
                  duration={2000}
                />
              </span>
            </div>

            {/* Subheadline */}
            <BlurFade delay={0.2} inView>
              <p className="text-[18px] text-[#6B7280] leading-[1.6] max-w-[520px] mt-4">
                ArticleGen generates SEO-optimized articles and publishes them to
                your entire content stack &mdash; automatically.
              </p>
            </BlurFade>

            {/* CTAs */}
            <BlurFade delay={0.35} inView>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/trial" className="inline-flex">
                  <StarButtonInner
                    lightColor="#ffffff"
                    backgroundColor="#000000"
                    borderWidth={1}
                    className="h-[52px] px-8 text-base font-semibold"
                  >
                    Start Free Trial
                  </StarButtonInner>
                </Link>
                <a
                  href="#features"
                  className="h-[52px] px-8 text-base font-semibold rounded-xl border border-[#E5E7EB] text-[#111827] hover:bg-[#F8F9FA] transition-colors inline-flex items-center"
                >
                  See how it works
                </a>
              </div>
            </BlurFade>

            {/* Trust microcopy */}
            <BlurFade delay={0.45} inView>
              <p className="mt-3 text-[14px] text-[#9CA3AF]">
                No credit card required &middot; Cancel anytime
              </p>
            </BlurFade>
          </div>

          {/* RIGHT COLUMN — slide in from right */}
          <BlurFade delay={0.15} inView direction="left">
            <div className="mt-8 lg:mt-0 flex justify-center lg:justify-end">
              {/* Dark UI card mockup */}
              <div className="w-full max-w-[500px] rounded-2xl bg-[#0f172a] border border-[#1e293b] shadow-2xl overflow-hidden relative">

                {/* Header bar */}
                <div
                  className="px-4 py-3 flex items-center gap-2"
                  style={{ borderBottom: "1px solid #1e293b" }}
                >
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-[13px] text-[#64748b] ml-2">
                    ArticleGen &mdash; ai-seo-practices-2025.md
                  </span>
                </div>

                {/* Content area */}
                <div className="p-5 space-y-4">
                  <p className="text-[12px] font-mono text-[#94a3b8]">
                    # Best SEO Practices for 2025
                  </p>

                  <div className="space-y-2">
                    <div className="h-2.5 rounded" style={{ background: "#1e293b", width: "92%" }} />
                    <div className="h-2.5 rounded" style={{ background: "#1e293b", width: "85%" }} />
                    <div className="h-2.5 rounded" style={{ background: "#1e293b", width: "78%" }} />
                    <div className="h-2.5 rounded" style={{ background: "#1e293b", width: "96%" }} />
                    <div className="h-2.5 rounded" style={{ background: "#1e293b", width: "70%" }} />
                  </div>

                  <div className="h-3 rounded mt-4" style={{ background: "#334155", width: "55%" }} />

                  <div className="space-y-2">
                    <div className="h-2.5 rounded" style={{ background: "#1e293b", width: "88%" }} />
                    <div className="h-2.5 rounded" style={{ background: "#1e293b", width: "82%" }} />
                    <div className="h-2.5 rounded" style={{ background: "#1e293b", width: "75%" }} />
                  </div>

                  {/* Status bar */}
                  <div
                    className="flex items-center gap-4 mt-4 pt-4"
                    style={{ borderTop: "1px solid #1e293b" }}
                  >
                    <span className="text-[11px] text-[#475569]">2,847 words</span>
                    <span className="text-[11px] text-[#475569]">&middot;</span>
                    <span className="text-[11px] text-[#475569]">
                      SEO Score:{" "}
                      <span className="text-[#22d3ee] font-bold">94</span>
                    </span>
                    <span
                      className="ml-auto px-2 py-1 rounded-full text-[11px] text-[#60a5fa]"
                      style={{ background: "#1e293b" }}
                    >
                      Generating...
                    </span>
                  </div>
                </div>

                {/* BorderBeam animation */}
                <BorderBeam size={120} duration={8} colorFrom="#3B82F6" colorTo="#8B5CF6" />
              </div>
            </div>
          </BlurFade>

        </div>
      </div>
    </section>
  );
}
