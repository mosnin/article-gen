"use client";

import { useState } from "react";

const tabs = ["Bloggers", "eCommerce", "Agencies", "SaaS"] as const;
type Tab = (typeof tabs)[number];

type CardEntry = {
  logo: string;
  quote: string;
  metric: string;
  metricLabel: string;
  name: string;
  role: string;
};

const testimonials: Record<Tab, CardEntry[]> = {
  Bloggers: [
    {
      logo: "The Content Lab",
      quote:
        "ArticleGen turned our once-a-week blog into a daily content machine. We now rank for keywords we never even targeted before.",
      metric: "3x traffic",
      metricLabel: "in 90 days",
      name: "Sarah Chen",
      role: "Founder, The Content Lab",
    },
    {
      logo: "NicheSite Pro",
      quote:
        "I went from spending 6 hours per article to 20 minutes. The quality is indistinguishable from what I was writing myself.",
      metric: "18x",
      metricLabel: "output increase",
      name: "James Holloway",
      role: "Solo Blogger, NicheSite Pro",
    },
    {
      logo: "Ranker Weekly",
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
      logo: "Shopify Store",
      quote:
        "Product blog traffic now drives 22% of our store visits. ArticleGen writes product guides that actually convert.",
      metric: "22%",
      metricLabel: "traffic from blog",
      name: "Marcus Webb",
      role: "Marketing Dir., Stackify",
    },
    {
      logo: "BoldCart",
      quote:
        "We cut our content acquisition cost by 47% while publishing five times as many articles every month.",
      metric: "47%",
      metricLabel: "lower cost",
      name: "Leila Park",
      role: "Head of Growth, BoldCart",
    },
    {
      logo: "TrueGoods",
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
      logo: "Velocity Agency",
      quote:
        "We onboarded 12 new clients in Q1 because ArticleGen let us scale delivery without hiring more writers.",
      metric: "12",
      metricLabel: "new clients in Q1",
      name: "Priya Nair",
      role: "Ops Lead, Velocity Agency",
    },
    {
      logo: "ContentScale",
      quote:
        "Our retainer margins improved 35% after switching to ArticleGen for first drafts. Editors spend time on strategy now.",
      metric: "+35%",
      metricLabel: "margin improvement",
      name: "Tom Bradley",
      role: "Founder, ContentScale",
    },
    {
      logo: "Ink & Rank",
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
      logo: "Lateral Inc.",
      quote:
        "We tripled organic traffic in 90 days by publishing two cluster articles per week with ArticleGen's topic clustering.",
      metric: "3x traffic",
      metricLabel: "in 90 days",
      name: "Ryan Foster",
      role: "Head of Marketing, Lateral Inc.",
    },
    {
      logo: "Vesper",
      quote:
        "What used to take a full day of research now takes a coffee break — with better SEO scores than our old process.",
      metric: "20 min",
      metricLabel: "per article",
      name: "Priya Nair",
      role: "SEO Lead, Vesper",
    },
    {
      logo: "Stackify",
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
  return (
    <div className="flex flex-col gap-6 rounded-2xl p-7 bg-gradient-to-br from-[#0f2044] to-[#0a1628] border border-white/10">
      {/* Logo / company name */}
      <div className="inline-flex">
        <span className="text-xs font-bold tracking-widest text-white/40 uppercase">
          {card.logo}
        </span>
      </div>

      {/* Quote */}
      <p className="text-base leading-relaxed text-white/80 flex-1">
        &ldquo;{card.quote}&rdquo;
      </p>

      {/* Metric */}
      <div className="border-t border-white/10 pt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-extrabold tracking-tight text-white">
            {card.metric}
          </p>
          <p className="text-xs text-white/40 mt-0.5">{card.metricLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-white">{card.name}</p>
          <p className="text-xs text-white/40">{card.role}</p>
        </div>
      </div>
    </div>
  );
}

export function SocialProofCards() {
  const [activeTab, setActiveTab] = useState<Tab>("Bloggers");

  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-4">
            Real results from content teams
          </h2>
          <p className="text-base text-gray-400">
            See what teams are publishing with ArticleGen
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-6 py-3 text-sm font-semibold transition-colors ${
                  activeTab === tab
                    ? "text-gray-900"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {testimonials[activeTab].map((card) => (
            <TestimonialCard key={card.name + card.logo} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}
