"use client";

import { NumberTicker } from "@/components/ui/number-ticker";
import { BlurFade } from "@/components/ui/blur-fade";

const stats = [
  { value: 2400, suffix: "+", label: "Teams publishing daily" },
  { value: 94, suffix: " avg", label: "SEO score per article" },
  { value: 20, prefix: "<", label: "Minutes from topic to published" },
  { value: 8, suffix: "+", label: "Publishing integrations" },
];

export function ProblemSolutionSection() {
  return (
    <section className="w-full bg-[#F1F3F5] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <BlurFade inView delay={0.1}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-0">
            {stats.map((stat, i) => (
              <div key={i} className="contents sm:flex sm:items-center">
                <div className="text-center sm:px-10 flex flex-col items-center">
                  <span className="text-[36px] md:text-[48px] font-bold text-[#111827] leading-[1.1] flex items-baseline gap-0.5">
                    {stat.prefix && <span>{stat.prefix}</span>}
                    <NumberTicker
                      value={stat.value}
                      className="text-[36px] md:text-[48px] font-bold text-[#111827]"
                    />
                    {stat.suffix && <span>{stat.suffix}</span>}
                  </span>
                  <p className="text-[14px] text-[#6B7280] mt-1">{stat.label}</p>
                </div>
                {i < stats.length - 1 && (
                  <div className="hidden sm:block w-px h-10 bg-[#E5E7EB] self-center flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
