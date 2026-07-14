import type { Metadata } from "next";
import Link from "next/link";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";

export const metadata: Metadata = {
  title: "Multi-Platform Publishing – ArticleGen",
  description:
    "Connect your platforms once and publish to WordPress, Shopify, Ghost, Medium, Dev.to, Notion, Webflow, and HubSpot simultaneously — no reformatting required.",
};

const platforms = [
  {
    name: "WordPress",
    description: "Blog & CMS",
  },
  {
    name: "Shopify",
    description: "eCommerce",
  },
  {
    name: "Ghost",
    description: "Creator publishing",
  },
  {
    name: "Medium",
    description: "Thought leadership",
  },
  {
    name: "Dev.to",
    description: "Developer content",
  },
  {
    name: "Notion",
    description: "Knowledge base",
  },
  {
    name: "Webflow",
    description: "Website CMS",
  },
  {
    name: "HubSpot",
    description: "Marketing hub",
  },
];

const benefits = [
  {
    title: "Connect once",
    description:
      "Authenticate each platform a single time with OAuth. No API keys, no webhooks to configure — just click to connect.",
  },
  {
    title: "Publish in one click",
    description:
      "Select your target platforms, hit publish, and ArticleGen handles formatting, image upload, and metadata for each.",
  },
  {
    title: "Schedule ahead",
    description:
      "Pick a date and time and ArticleGen queues the article for every selected platform simultaneously.",
  },
  {
    title: "Per-platform settings",
    description:
      "Override categories, tags, authors, and slugs on a platform-by-platform basis without touching the source article.",
  },
];

export default function PublishingPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-white text-center">
        <div className="max-w-[720px] mx-auto px-6">
          <BlurFade inView delay={0.1}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] mb-3">
              Multi-Platform Publishing
            </p>
            <h1 className="text-[32px] md:text-[44px] font-bold text-[#111827] leading-[1.15]">
              Publish everywhere with one click
            </h1>
            <p className="text-[20px] text-[#6B7280] mt-3 max-w-[560px] mx-auto">
              Connect your platforms once. Then reach WordPress, Shopify, Ghost,
              Medium, Dev.to, Notion, Webflow, and HubSpot simultaneously — no
              reformatting.
            </p>
          </BlurFade>
        </div>
      </section>

      {/* Platforms grid */}
      <section className="py-16 bg-[#F8F9FA]">
        <div className="max-w-[1200px] mx-auto px-6">
          <BlurFade inView delay={0.1}>
            <h2 className="text-[28px] font-bold text-[#111827] text-center mb-10">
              Supported platforms
            </h2>
          </BlurFade>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {platforms.map((platform, i) => (
              <BlurFade key={platform.name} inView delay={0.1 + i * 0.04}>
                <MagicCard gradientColor="#3B82F615" className="rounded-xl">
                  <div className="bg-white p-6 rounded-xl text-center">
                    <p className="text-[16px] font-bold text-[#111827]">
                      {platform.name}
                    </p>
                    <p className="text-[13px] text-[#6B7280] mt-2">
                      {platform.description}
                    </p>
                  </div>
                </MagicCard>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <BlurFade inView delay={0.1}>
            <h2 className="text-[28px] font-bold text-[#111827] text-center mb-10">
              Why teams love our publishing
            </h2>
          </BlurFade>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {benefits.map((benefit, i) => (
              <BlurFade key={benefit.title} inView delay={0.1 + i * 0.05}>
                <div className="p-7 rounded-2xl border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.06)] bg-white">
                  <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center mb-4">
                    <svg
                      className="w-4 h-4 text-[#3B82F6]"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <h3 className="text-[17px] font-semibold text-[#111827] mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-[15px] text-[#6B7280] leading-[1.6]">
                    {benefit.description}
                  </p>
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
