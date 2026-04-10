"use client";

import { useState } from "react";
import { MagicCard } from "@/components/ui/magic-card";
import { BlurFade } from "@/components/ui/blur-fade";

const tabs = ["Bloggers", "eCommerce", "Agencies", "SaaS"] as const;
type Tab = (typeof tabs)[number];

type CardEntry = {
  quote: string;
  metric: string;
  metricLabel: string;
  name: string;
  role: string;
  logo?: string;
};

const testimonials: Record<Tab, CardEntry[]> = {
  Bloggers: [
    {
      quote:
        "ArticleGen turned our once-a-week blog into a daily content machine. We now rank for keywords we never even targeted before.",
      metric: "3x traffic",
      metricLabel: "in 90 days",
      name: "Sarah Chen",
      role: "Founder, The Content Lab",
      logo: "The Content Lab",
    },
    {
      quote:
        "I went from spending 6 hours per article to 20 minutes. The quality is indistinguishable from what I was writing myself.",
      metric: "18x",
      metricLabel: "output increase",
      name: "James Holloway",
      role: "Solo Blogger, NicheSite Pro",
      logo: "NicheSite Pro",
    },
    {
      quote:
        "Our domain authority jumped 14 points in three months just from the volume and consistency ArticleGen gave us.",
      metric: "+14 DA",
      metricLabel: "in 3 months",
      name: "Mia Torres",
      role: "Editor, Ranker Weekly",
      logo: "Ranker Weekly",
    },
  ],
  eCommerce: [
    {
      quote:
        "Product blog traffic now drives 22% of our store visits. ArticleGen writes product guides that actually convert.",
      metric: "22%",
      metricLabel: "traffic from blog",
      name: "Marcus Webb",
      role: "Marketing Dir., Stackify",
      logo: "Stackify",
    },
    {
      quote:
        "We cut our content acquisition cost by 47% while publishing five times as many articles every month.",
      metric: "47%",
      metricLabel: "lower cost",
      name: "Leila Park",
      role: "Head of Growth, BoldCart",
      logo: "BoldCart",
    },
    {
      quote:
        "ArticleGen's SEO scores consistently beat our old agency's work. And it delivers in minutes, not weeks.",
      metric: "94 avg",
      metricLabel: "SEO score",
      name: "David Kim",
      role: "CEO, TrueGoods",
      logo: "TrueGoods",
    },
  ],
  Agencies: [
    {
      quote:
        "We onboarded 12 new clients in Q1 because ArticleGen let us scale delivery without hiring more writers.",
      metric: "12",
      metricLabel: "new clients in Q1",
      name: "Priya Nair",
      role: "Ops Lead, Velocity Agency",
      logo: "Velocity Agency",
    },
    {
      quote:
        "Our retainer margins improved 35% after switching to ArticleGen for first drafts. Editors spend time on strategy now.",
      metric: "+35%",
      metricLabel: "margin improvement",
      name: "Tom Bradley",
      role: "Founder, ContentScale",
      logo: "ContentScale",
    },
    {
      quote:
        "Client reporting got a lot easier when every article has built-in SEO metadata and keyword density scores.",
      metric: "100%",
      metricLabel: "client retention",
      name: "Nina Shaw",
      role: "Account Dir., Ink & Rank",
      logo: "Ink & Rank",
    },
  ],
  SaaS: [
    {
      quote:
        "We tripled organic traffic in 90 days by publishing two cluster articles per week with ArticleGen's topic clustering.",
      metric: "3x traffic",
      metricLabel: "in 90 days",
      name: "Ryan Foster",
      role: "Head of Marketing, Lateral Inc.",
      logo: "Lateral Inc.",
    },
    {
      quote:
        "What used to take a full day of research now takes a coffee break — with better SEO scores than our old process.",
      metric: "20 min",
      metricLabel: "per article",
      name: "Priya Nair",
      role: "SEO Lead, Vesper",
      logo: "Vesper",
    },
    {
      quote:
        "ArticleGen's Autopilot keeps our blog active during product sprints when the team has no bandwidth for content.",
      metric: "5x",
      metricLabel: "more articles/month",
      name: "Marcus Webb",
      role: "Marketing Dir., Stackify",
      logo: "Stackify",
    },
  ],
};

function TestimonialCard({ card }: { card: CardEntry }) {
  return (
    <MagicCard
      className="rounded-xl cursor-default h-full"
      gradientColor="#2563EB12"
    >
      <div className="p-6 flex flex-col h-full gap-4">
        {/* Metric badge top-right */}
        <div className="flex items-start justify-between gap-4">
          <span className="text-[11px] font-bold tracking-widest text-[#9CA3AF] uppercase">{card.logo}</span>
          <div className="text-right flex-shrink-0">
            <p className="text-[24px] font-bold text-[#111827] leading-none">{card.metric}</p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">{card.metricLabel}</p>
          </div>
        </div>
        <p className="text-[15px] leading-relaxed text-[#374151] italic flex-1">"{card.quote}"</p>
        <div className="border-t border-[#E5E7EB] pt-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#111827] flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0">
            {card.name.split(' ').map((n: string) => n[0]).join('')}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#111827]">{card.name}</p>
            <p className="text-[11px] text-[#6B7280]">{card.role}</p>
          </div>
        </div>
      </div>
    </MagicCard>
  );
}

export function SocialProofCards() {
  const [activeTab, setActiveTab] = useState<Tab>("Bloggers");

  return (
    <section className="bg-[#F8F9FA] py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section headline */}
        <BlurFade inView delay={0.1}>
          <div className="text-center mb-12">
            <h2 className="text-[28px] lg:text-[36px] font-bold text-[#111827] leading-[1.2]">
              Real results from content teams
            </h2>
            <p className="text-[16px] text-[#6B7280] mt-3">
              See what teams are publishing with ArticleGen
            </p>
          </div>
        </BlurFade>

        {/* Tab bar */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex border-b border-[#E5E7EB]">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-6 py-3 text-[14px] font-semibold transition-colors ${
                  activeTab === tab
                    ? "text-[#111827]"
                    : "text-[#6B7280] hover:text-[#111827]"
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563EB] rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Cards grid */}
        <BlurFade inView delay={0.15}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {testimonials[activeTab].map((card) => (
              <TestimonialCard key={card.name + card.role} card={card} />
            ))}
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
