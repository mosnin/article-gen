"use client";

const logos = [
  "WordPress",
  "Shopify",
  "Ghost",
  "Medium",
  "Dev.to",
  "Notion",
  "Webflow",
  "HubSpot",
  "Ahrefs",
  "SEMrush",
];

export function LogoMarquee() {
  return (
    <section className="py-12 bg-white border-y border-[#E5E7EB] overflow-hidden">
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .marquee-track {
          animation: marquee 30s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track {
            animation: none;
          }
        }
      `}</style>

      <p className="text-[12px] text-[#9CA3AF] text-center mb-8 uppercase tracking-[0.06em]">
        Integrates with your existing stack
      </p>

      <div className="overflow-hidden">
        <div className="marquee-track flex items-center gap-12 w-max">
          {[...logos, ...logos].map((logo, i) => (
            <span
              key={i}
              className="text-[15px] font-semibold text-[#111827] whitespace-nowrap"
              style={{ opacity: 0.5 }}
            >
              {logo}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
