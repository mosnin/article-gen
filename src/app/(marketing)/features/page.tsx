import type { Metadata } from "next";
import Link from "next/link";
import { PenLine, Share2, BarChart3, Bot } from "lucide-react";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";

export const metadata: Metadata = {
  title: "Features – ArticleGen",
  description:
    "Explore every feature ArticleGen offers — AI article generation, multi-platform publishing, SEO analytics, and full content automation.",
};

const features = [
  {
    icon: PenLine,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
    label: "AI Generation",
    title: "AI Article Generation",
    description:
      "Generate publish-ready, SEO-optimized articles in under 2 minutes. ArticleGen researches your topic, builds a structured outline, and writes a full long-form article complete with headings, internal links, and metadata.",
    bullets: [
      "2,000–4,000 word articles",
      "Built-in keyword research",
      "SEO score of 90+ guaranteed",
      "Structured data & meta tags included",
    ],
    href: "/features/ai-generation",
    cta: "Learn more",
    delay: 0.1,
  },
  {
    icon: Share2,
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-50",
    label: "Publishing",
    title: "Multi-Platform Publishing",
    description:
      "Connect once, publish everywhere. Push your articles to WordPress, Shopify, Ghost, Medium, Dev.to, Notion, Webflow, and HubSpot simultaneously with one click.",
    bullets: [
      "8+ platform integrations",
      "No copy-pasting or reformatting",
      "Schedule or publish instantly",
      "Per-platform custom settings",
    ],
    href: "/features/publishing",
    cta: "Learn more",
    delay: 0.15,
  },
  {
    icon: BarChart3,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
    label: "Analytics",
    title: "SEO & Analytics",
    description:
      "Connect Google Search Console and surface exactly which articles are ranking, which are dropping, and where to focus your next piece. Turn data into content strategy.",
    bullets: [
      "GSC integration built-in",
      "Keyword position tracking",
      "Article update recommendations",
      "SERP performance history",
    ],
    href: "/features/seo-analytics",
    cta: "Learn more",
    delay: 0.2,
  },
  {
    icon: Bot,
    iconColor: "text-violet-600",
    iconBg: "bg-violet-50",
    label: "Automation",
    title: "Content Automation",
    description:
      "Set your content schedule and let ArticleGen run it. Autopilot generates a 30-day content plan, approves articles on your schedule, and publishes them automatically.",
    bullets: [
      "30-day plan auto-generated at signup",
      "Approve, edit, or reject any slot",
      "Automated generation & publishing",
      "Niche-specific keyword targeting",
    ],
    href: "/features/automation",
    cta: "Learn more",
    delay: 0.25,
  },
];

export default function FeaturesPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-white text-center">
        <div className="max-w-[720px] mx-auto px-6">
          <BlurFade inView delay={0.1}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] mb-3">
              Platform Features
            </p>
            <h1 className="text-[32px] md:text-[44px] font-bold text-[#111827] leading-[1.15]">
              Everything you need to grow with content
            </h1>
            <p className="text-[20px] text-[#6B7280] mt-3 max-w-[560px] mx-auto">
              ArticleGen handles every step of the content lifecycle — from
              research to publication.
            </p>
          </BlurFade>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 bg-[#F8F9FA]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature) => (
              <BlurFade key={feature.title} inView delay={feature.delay}>
                <MagicCard gradientColor="#3B82F615" className="rounded-xl">
                  <div className="p-8">
                    <div
                      className={`inline-flex w-12 h-12 rounded-xl ${feature.iconBg} items-center justify-center mb-5`}
                    >
                      <feature.icon
                        className={`w-6 h-6 ${feature.iconColor}`}
                      />
                    </div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#3B82F6] mb-2">
                      {feature.label}
                    </p>
                    <h2 className="text-[22px] font-bold text-[#111827] mb-3">
                      {feature.title}
                    </h2>
                    <p className="text-[15px] text-[#6B7280] leading-[1.6] mb-5">
                      {feature.description}
                    </p>
                    <ul className="space-y-2 mb-6">
                      {feature.bullets.map((b) => (
                        <li
                          key={b}
                          className="flex items-center gap-2 text-[14px] text-[#6B7280]"
                        >
                          <svg
                            className="w-4 h-4 text-[#3B82F6] flex-shrink-0"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {b}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={feature.href}
                      className="text-[15px] font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                    >
                      {feature.cta} →
                    </Link>
                  </div>
                </MagicCard>
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
