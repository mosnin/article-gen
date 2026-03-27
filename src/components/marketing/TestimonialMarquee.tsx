"use client";

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  company: string;
  initials: string;
  avatarColor: string;
}

const testimonials: Testimonial[] = [
  {
    quote:
      "We went from publishing 2 articles/month to 20. ArticleGen does in 20 minutes what used to take us a full day.",
    name: "Alex Kim",
    role: "SEO Manager",
    company: "CloudSync",
    initials: "AK",
    avatarColor: "bg-blue-500",
  },
  {
    quote:
      "The GSC integration alone is worth it. I can see exactly which articles to update for quick traffic wins.",
    name: "Emma Torres",
    role: "Content Lead",
    company: "Growthly",
    initials: "ET",
    avatarColor: "bg-violet-500",
  },
  {
    quote:
      "Finally an AI writer that doesn't sound like AI. Our readers can't tell the difference.",
    name: "James Park",
    role: "Founder",
    company: "NicheStack",
    initials: "JP",
    avatarColor: "bg-emerald-500",
  },
  {
    quote:
      "Multi-platform publishing is a game changer. I write once, it goes to WordPress, Medium, and Ghost simultaneously.",
    name: "Layla Hassan",
    role: "Content Strategist",
    company: "Pivotal",
    initials: "LH",
    avatarColor: "bg-rose-500",
  },
  {
    quote:
      "The content clusters feature helped us build topical authority in 3 months. Page 1 rankings across the board.",
    name: "Diego Reyes",
    role: "Head of SEO",
    company: "ScaleHQ",
    initials: "DR",
    avatarColor: "bg-amber-500",
  },
  {
    quote:
      "ArticleGen paid for itself in the first week. We cancelled three freelancer contracts.",
    name: "Sofia Chen",
    role: "Marketing Director",
    company: "Buildbase",
    initials: "SC",
    avatarColor: "bg-pink-500",
  },
  {
    quote:
      "I use the autopilot to keep content publishing while I focus on strategy. It's like having a full content team.",
    name: "Ravi Patel",
    role: "Solo Founder",
    company: "AppTrackr",
    initials: "RP",
    avatarColor: "bg-cyan-500",
  },
  {
    quote:
      "The brand voice feature means every article sounds like us, not like generic AI output.",
    name: "Naomi Wright",
    role: "Brand Lead",
    company: "Folio",
    initials: "NW",
    avatarColor: "bg-indigo-500",
  },
];

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div className="w-[340px] sm:w-[360px] flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-6 py-5 shadow-sm mx-3">
      <p className="text-sm italic text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
        &ldquo;{t.quote}&rdquo;
      </p>
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-full ${t.avatarColor} flex items-center justify-center flex-shrink-0`}
        >
          <span className="text-xs font-bold text-white">{t.initials}</span>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{t.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t.role}, {t.company}
          </p>
        </div>
      </div>
    </div>
  );
}

const row1 = testimonials.slice(0, 4);
const row2 = testimonials.slice(4, 8);

export function TestimonialMarquee() {
  return (
    <section className="py-20 bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-12 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
          Loved by content teams
        </h2>
        <p className="mt-3 text-base text-gray-500 dark:text-gray-400">
          Trusted by 2,400+ teams to write faster and rank higher.
        </p>
      </div>

      {/* Animated rows — hidden for reduced motion */}
      <div className="motion-safe:block hidden space-y-6">
        {/* Row 1 — scroll left, 45s */}
        <div className="relative flex overflow-hidden">
          {/* Fade edges */}
          <div className="pointer-events-none absolute left-0 top-0 h-full w-24 z-10 bg-gradient-to-r from-gray-50 dark:from-gray-900 to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-24 z-10 bg-gradient-to-l from-gray-50 dark:from-gray-900 to-transparent" />

          <div className="flex animate-marquee">
            {[...row1, ...row1, ...row1].map((t, i) => (
              <TestimonialCard key={`r1-${i}`} t={t} />
            ))}
          </div>
        </div>

        {/* Row 2 — scroll right, 30s */}
        <div className="relative flex overflow-hidden">
          <div className="pointer-events-none absolute left-0 top-0 h-full w-24 z-10 bg-gradient-to-r from-gray-50 dark:from-gray-900 to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-24 z-10 bg-gradient-to-l from-gray-50 dark:from-gray-900 to-transparent" />

          <div className="flex animate-marquee-reverse">
            {[...row2, ...row2, ...row2].map((t, i) => (
              <TestimonialCard key={`r2-${i}`} t={t} />
            ))}
          </div>
        </div>
      </div>

      {/* Static fallback for reduced-motion */}
      <div className="motion-safe:hidden max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 gap-4">
          {testimonials.map((t, i) => (
            <TestimonialCard key={i} t={t} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        @keyframes marquee-reverse {
          0%   { transform: translateX(-33.333%); }
          100% { transform: translateX(0); }
        }
        .animate-marquee {
          animation: marquee 45s linear infinite;
        }
        .animate-marquee-reverse {
          animation: marquee-reverse 30s linear infinite;
        }
      `}</style>
    </section>
  );
}
