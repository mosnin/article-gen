"use client";

import { useEffect, useRef, useState } from "react";

function useVisible(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, visible };
}

const stats = [
  { number: "2,400+", label: "Teams publishing daily" },
  { number: "94 avg", label: "SEO score per article" },
  { number: "<20 min", label: "From topic to published" },
  { number: "8+", label: "Publishing integrations" },
];

export function ProblemSolutionSection() {
  const { ref, visible } = useVisible(0.1);

  return (
    <section className="w-full bg-[#F1F3F5] py-12">
      <div
        ref={ref}
        className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 transition-opacity duration-[600ms] ease-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Mobile: 2-col grid. sm+: flex row centered with dividers */}
        <div className="grid grid-cols-2 gap-8 sm:flex sm:flex-row sm:justify-center sm:items-center sm:gap-0">
          {stats.map((stat, i) => (
            <div key={i} className="contents sm:flex sm:items-center">
              <div className="text-center sm:px-8">
                <p className="text-[36px] md:text-[48px] font-bold text-[#111827] leading-[1.1]">
                  {stat.number}
                </p>
                <p className="text-[14px] text-[#6B7280] mt-1">{stat.label}</p>
              </div>
              {i < stats.length - 1 && (
                <div className="hidden sm:block w-px h-10 bg-[#E5E7EB] self-center flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
