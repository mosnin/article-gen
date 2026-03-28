"use client";

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
    <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl p-6 flex-shrink-0 w-[360px] flex flex-col">
      <p className="text-[18px] text-[#111827] italic leading-[1.6] flex-1">
        &ldquo;{t.quote}&rdquo;
      </p>
      <div className="mt-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#111827] flex items-center justify-center flex-shrink-0">
          <span className="text-[12px] font-semibold text-white select-none">
            {t.initials}
          </span>
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[#111827] leading-tight">
            {t.name}
          </p>
          <p className="text-[14px] text-[#6B7280] leading-snug">
            {t.role}, {t.company}
          </p>
        </div>
      </div>
    </div>
  );
}

export function TestimonialMarquee() {
  return (
    <section
      style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" }}
      className="bg-[#F8F9FA] py-20 overflow-hidden"
    >
      <style>{`
        @keyframes marquee-left {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          from { transform: translateX(-50%); }
          to   { transform: translateX(0); }
        }
        .animate-marquee-left {
          animation: marquee-left 45s linear infinite;
        }
        .animate-marquee-right {
          animation: marquee-right 30s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-marquee-left,
          .animate-marquee-right {
            animation-play-state: paused;
          }
        }
      `}</style>

      {/* Section heading */}
      <div className="text-center mb-12 px-6">
        <h2 className="text-[28px] lg:text-[36px] font-bold text-[#111827] leading-[1.2]">
          Loved by content teams
        </h2>
        <p className="text-[16px] text-[#6B7280] mt-3 leading-[1.6]">
          Trusted by 2,400+ teams to write faster and rank higher.
        </p>
      </div>

      {/* Row 1 — scrolls left at 45s */}
      <div className="overflow-hidden mb-4" aria-hidden="true">
        <div className="flex items-stretch gap-4 w-max animate-marquee-left">
          {row1.map((t, i) => (
            <TestimonialCard key={`r1a-${i}`} t={t} />
          ))}
          {row1.map((t, i) => (
            <TestimonialCard key={`r1b-${i}`} t={t} />
          ))}
        </div>
      </div>

      {/* Row 2 — scrolls right at 30s */}
      <div className="overflow-hidden" aria-hidden="true">
        <div className="flex items-stretch gap-4 w-max animate-marquee-right">
          {row2.map((t, i) => (
            <TestimonialCard key={`r2a-${i}`} t={t} />
          ))}
          {row2.map((t, i) => (
            <TestimonialCard key={`r2b-${i}`} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
}
