"use client";

import { Marquee } from "@/components/ui/marquee";
import { MagicCard } from "@/components/ui/magic-card";
import { BlurFade } from "@/components/ui/blur-fade";

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  company: string;
  initials: string;
}

const row1: Testimonial[] = [
  {
    quote:
      "We went from 2 articles/month to 20. ArticleGen does in 20 minutes what used to take a full day.",
    name: "Alex Kim",
    role: "SEO Manager",
    company: "CloudSync",
    initials: "AK",
  },
  {
    quote:
      "The GSC integration alone is worth it. I see exactly which articles to update for quick traffic wins.",
    name: "Emma Torres",
    role: "Content Lead",
    company: "Growthly",
    initials: "ET",
  },
  {
    quote:
      "Finally an AI writer that doesn't sound like AI. Our readers can't tell the difference.",
    name: "James Park",
    role: "Founder",
    company: "NicheStack",
    initials: "JP",
  },
  {
    quote:
      "Multi-platform publishing is a game changer. I write once, it goes to WordPress, Medium, and Ghost simultaneously.",
    name: "Layla Hassan",
    role: "Content Strategist",
    company: "Pivotal",
    initials: "LH",
  },
  {
    quote:
      "The content clusters feature helped us build topical authority in 3 months. Page 1 rankings across the board.",
    name: "Diego Reyes",
    role: "Head of SEO",
    company: "ScaleHQ",
    initials: "DR",
  },
  {
    quote:
      "ArticleGen paid for itself in the first week. We cancelled three freelancer contracts.",
    name: "Sofia Chen",
    role: "Marketing Director",
    company: "Buildbase",
    initials: "SC",
  },
];

const row2: Testimonial[] = [
  {
    quote:
      "Our domain authority jumped 14 points in three months just from the volume ArticleGen gave us.",
    name: "Mia Torres",
    role: "Editor",
    company: "Ranker Weekly",
    initials: "MT",
  },
  {
    quote:
      "We onboarded 12 new clients in Q1 because ArticleGen let us scale delivery without hiring more writers.",
    name: "Priya Nair",
    role: "Ops Lead",
    company: "Velocity Agency",
    initials: "PN",
  },
  {
    quote:
      "Retainer margins improved 35% after switching to ArticleGen for first drafts. Editors spend time on strategy now.",
    name: "Tom Bradley",
    role: "Founder",
    company: "ContentScale",
    initials: "TB",
  },
  {
    quote:
      "Product blog traffic now drives 22% of our store visits. ArticleGen writes product guides that convert.",
    name: "Marcus Webb",
    role: "Marketing Dir.",
    company: "Stackify",
    initials: "MW",
  },
  {
    quote:
      "We tripled organic traffic in 90 days by publishing two cluster articles per week.",
    name: "Ryan Foster",
    role: "Head of Marketing",
    company: "Lateral Inc.",
    initials: "RF",
  },
  {
    quote:
      "What used to take a full day of research now takes a coffee break — with better SEO scores.",
    name: "Leila Park",
    role: "Head of Growth",
    company: "BoldCart",
    initials: "LP",
  },
];

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <MagicCard
      className="w-[320px] md:w-[360px] rounded-xl cursor-default"
      gradientColor="#3B82F615"
    >
      <div className="p-6 flex flex-col gap-4">
        <p className="text-[16px] text-[#111827] italic leading-[1.6]">"{t.quote}"</p>
        <div className="flex items-center gap-3 mt-auto">
          <div className="w-10 h-10 rounded-full bg-[#111827] flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0">
            {t.initials}
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#111827]">{t.name}</p>
            <p className="text-[14px] text-[#6B7280]">{t.role}, {t.company}</p>
          </div>
        </div>
      </div>
    </MagicCard>
  );
}

export function TestimonialMarquee() {
  return (
    <section
      style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" }}
      className="bg-[#F8F9FA] py-20"
    >
      {/* Section heading */}
      <BlurFade inView delay={0.1}>
        <div className="text-center mb-12 px-6">
          <h2 className="text-[28px] lg:text-[36px] font-bold text-[#111827] leading-[1.2]">
            Loved by content teams
          </h2>
          <p className="text-[16px] text-[#6B7280] mt-3 leading-[1.6]">
            Trusted by 2,400+ teams to write faster and rank higher.
          </p>
        </div>
      </BlurFade>

      {/* Row 1 — scrolls left at 45s */}
      <div className="overflow-hidden relative mb-4">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10 bg-gradient-to-r from-[#F8F9FA] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10 bg-gradient-to-l from-[#F8F9FA] to-transparent" />
        <Marquee pauseOnHover className="[--duration:45s]">
          {row1.map((t) => (
            <TestimonialCard key={t.name} t={t} />
          ))}
        </Marquee>
      </div>

      {/* Row 2 — scrolls right at 35s */}
      <div className="overflow-hidden relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10 bg-gradient-to-r from-[#F8F9FA] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10 bg-gradient-to-l from-[#F8F9FA] to-transparent" />
        <Marquee reverse pauseOnHover className="[--duration:35s]">
          {row2.map((t) => (
            <TestimonialCard key={t.name} t={t} />
          ))}
        </Marquee>
      </div>
    </section>
  );
}
