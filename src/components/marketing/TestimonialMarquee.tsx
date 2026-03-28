"use client";

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  company: string;
  initials: string;
}

const testimonials: Testimonial[] = [
  {
    quote:
      "We went from publishing 2 articles/month to 20. ArticleGen does in 20 minutes what used to take us a full day.",
    name: "Alex Kim",
    role: "SEO Manager",
    company: "CloudSync",
    initials: "AK",
  },
  {
    quote:
      "The GSC integration alone is worth it. I can see exactly which articles to update for quick traffic wins.",
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

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div className="flex flex-col justify-between bg-white border border-gray-200 rounded-lg p-6">
      <p className="text-sm text-gray-800 leading-relaxed mb-6">
        &ldquo;{t.quote}&rdquo;
      </p>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-semibold text-white">{t.initials}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 leading-tight">{t.name}</p>
          <p className="text-xs text-gray-500">
            {t.role}, {t.company}
          </p>
        </div>
      </div>
    </div>
  );
}

export function TestimonialMarquee() {
  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Loved by content teams
          </h2>
          <p className="mt-3 text-base text-gray-500">
            Trusted by 2,400+ teams to write faster and rank higher.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <TestimonialCard key={i} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
}
