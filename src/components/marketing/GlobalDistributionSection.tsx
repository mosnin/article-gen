"use client";

import { GlobePulse } from "@/components/ui/cobe-globe-pulse";
import { BlurFade } from "@/components/ui/blur-fade";
import { StarButtonInner } from "@/components/ui/star-button";
import Link from "next/link";

const stats = [
  { value: "150+", label: "Countries reached" },
  { value: "40+", label: "Platform integrations" },
  { value: "2.4k+", label: "Active publishers" },
];

const destinations = [
  { name: "WordPress", region: "Global CMS" },
  { name: "Ghost", region: "Publishing" },
  { name: "Webflow", region: "Web Builder" },
  { name: "Shopify", region: "E-Commerce" },
  { name: "Medium", region: "Editorial" },
  { name: "LinkedIn", region: "Professional" },
  { name: "Substack", region: "Newsletter" },
  { name: "Webhook", region: "Custom" },
];

export function GlobalDistributionSection() {
  return (
    <section
      className="relative overflow-hidden bg-[#060810] py-24 lg:py-32"
      style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" }}
    >
      {/* Subtle radial glow behind globe */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 65% 50%, rgba(37,99,235,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="relative max-w-[1200px] mx-auto px-6 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

        {/* ── Left: text ── */}
        <div className="order-2 lg:order-1">
          <BlurFade inView delay={0.05}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#2563EB] mb-4">
              Global Distribution
            </p>
          </BlurFade>

          <BlurFade inView delay={0.1}>
            <h2 className="text-[36px] lg:text-[48px] font-bold text-white leading-[1.1] tracking-tight">
              Distribute content{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                worldwide
              </span>
            </h2>
          </BlurFade>

          <BlurFade inView delay={0.18}>
            <p className="mt-5 text-[18px] text-gray-400 leading-relaxed max-w-[480px]">
              Publish once, reach everywhere. ArticleGen pushes your content to
              every platform, CMS, and channel simultaneously — from a single
              dashboard.
            </p>
          </BlurFade>

          {/* Stats row */}
          <BlurFade inView delay={0.25}>
            <div className="mt-10 flex flex-wrap gap-8">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="text-[28px] font-bold text-white">{s.value}</p>
                  <p className="text-[13px] text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </BlurFade>

          {/* Destination pills */}
          <BlurFade inView delay={0.32}>
            <div className="mt-8 flex flex-wrap gap-2">
              {destinations.map((d) => (
                <span
                  key={d.name}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#d1d5db",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                    style={{ boxShadow: "0 0 6px #22d3ee" }}
                  />
                  {d.name}
                  <span className="text-gray-600">&middot; {d.region}</span>
                </span>
              ))}
            </div>
          </BlurFade>

          {/* CTA */}
          <BlurFade inView delay={0.4}>
            <div className="mt-10 flex items-center gap-4">
              <Link href="/trial" className="inline-flex">
                <StarButtonInner
                  lightColor="#22d3ee"
                  backgroundColor="#000000"
                  borderWidth={1}
                  className="h-[48px] px-7 text-[15px] font-semibold"
                >
                  Start distributing
                </StarButtonInner>
              </Link>
              <Link
                href="/integrations"
                className="text-[15px] font-medium text-gray-400 hover:text-white transition-colors"
              >
                View all integrations &rarr;
              </Link>
            </div>
          </BlurFade>
        </div>

        {/* ── Right: interactive globe ── */}
        <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
          <BlurFade inView delay={0.1}>
            <div className="relative w-full max-w-[500px]">
              {/* Glow ring */}
              <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  boxShadow:
                    "0 0 80px 20px rgba(34,211,238,0.08), 0 0 160px 40px rgba(37,99,235,0.06)",
                }}
              />
              <GlobePulse speed={0.004} />
              {/* Drag hint */}
              <p className="mt-3 text-center text-[12px] text-gray-600 select-none">
                Drag to explore
              </p>
            </div>
          </BlurFade>
        </div>

      </div>
    </section>
  );
}
