"use client";

import { Marquee } from "@/components/ui/marquee";

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
    <section className="py-12 bg-white border-y border-[#E5E7EB]">
      <p className="text-center text-[12px] text-[#9CA3AF] uppercase tracking-[0.06em] mb-8">
        Integrates with your existing stack
      </p>
      <div className="relative">
        <Marquee pauseOnHover className="[--duration:30s]">
          {logos.map((logo) => (
            <div
              key={logo}
              className="mx-8 text-[15px] font-semibold text-[#111827] opacity-40 hover:opacity-70 transition-opacity whitespace-nowrap select-none"
            >
              {logo}
            </div>
          ))}
        </Marquee>
        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-white to-transparent" />
      </div>
    </section>
  );
}
