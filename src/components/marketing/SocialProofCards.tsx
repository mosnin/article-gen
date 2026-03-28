"use client";

import { useState } from "react";

const tabs = ["Bloggers", "eCommerce", "Agencies", "SaaS"] as const;
type Tab = (typeof tabs)[number];

type CardEntry = {
  quote: string;
  metric: string;
  metricLabel: string;
  name: string;
  role: string;
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
    },
    {
      quote:
        "I went from spending 6 hours per article to 20 minutes. The quality is indistinguishable from what I was writing myself.",
      metric: "18x",
      metricLabel: "output increase",
      name: "James Holloway",
      role: "Solo Blogger, NicheSite Pro",
    },
    {
      quote:
        "Our domain authority jumped 14 points in three months just from the volume and consistency ArticleGen gave us.",
      metric: "+14 DA",
      metricLabel: "in 3 months",
      name: "Mia Torres",
      role: "Editor, Ranker Weekly",
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
    },
    {
      quote:
        "We cut our content acquisition cost by 47% while publishing five times as many articles every month.",
      metric: "47%",
      metricLabel: "lower cost",
      name: "Leila Park",
      role: "Head of Growth, BoldCart",
    },
    {
      quote:
        "ArticleGen's SEO scores consistently beat our old agency's work. And it delivers in minutes, not weeks.",
      metric: "94 avg",
      metricLabel: "SEO score",
      name: "David Kim",
      role: "CEO, TrueGoods",
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
    },
    {
      quote:
        "Our retainer margins improved 35% after switching to ArticleGen for first drafts. Editors spend time on strategy now.",
      metric: "+35%",
      metricLabel: "margin improvement",
      name: "Tom Bradley",
      role: "Founder, ContentScale",
    },
    {
      quote:
        "Client reporting got a lot easier when every article has built-in SEO metadata and keyword density scores.",
      metric: "100%",
      metricLabel: "client retention",
      name: "Nina Shaw",
      role: "Account Dir., Ink & Rank",
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
    },
    {
      quote:
        "What used to take a full day of research now takes a coffee break — with better SEO scores than our old process.",
      metric: "20 min",
      metricLabel: "per article",
      name: "Priya Nair",
      role: "SEO Lead, Vesper",
    },
    {
      quote:
        "ArticleGen's Autopilot keeps our blog active during product sprints when the team has no bandwidth for content.",
      metric: "5x",
      metricLabel: "more articles/month",
      name: "Marcus Webb",
      role: "Marketing Dir., Stackify",
    },
  ],
};

function TestimonialCard({ card }: { card: CardEntry }) {
  const initials = card.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <div className="relative bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl p-6 flex flex-col">
      {/* Metric badge — top right */}
      <div className="absolute top-5 right-5 text-right">
        <p className="text-[24px] font-bold text-[#111827] leading-none">
          {card.metric}
        </p>
        <p className="text-[12px] text-[#6B7280] mt-0.5">{card.metricLabel}</p>
      </div>

      {/* Quote */}
      <p className="text-[16px] text-[#111827] italic leading-[1.6] flex-1 pr-20">
        &ldquo;{card.quote}&rdquo;
      </p>

      {/* Attribution */}
      <div className="mt-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#111827] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[12px] font-semibold">{initials}</span>
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[#111827]">{card.name}</p>
          <p className="text-[14px] text-[#6B7280]">{card.role}</p>
        </div>
      </div>
    </div>
  );
}

export function SocialProofCards() {
  const [activeTab, setActiveTab] = useState<Tab>("Bloggers");

  return (
    <section className="bg-[#F8F9FA] py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section headline */}
        <div className="text-center mb-12">
          <h2 className="text-[28px] lg:text-[36px] font-bold text-[#111827] leading-[1.2]">
            Real results from content teams
          </h2>
          <p className="text-[16px] text-[#6B7280] mt-3">
            See what teams are publishing with ArticleGen
          </p>
        </div>

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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {testimonials[activeTab].map((card) => (
            <TestimonialCard key={card.name + card.role} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}
