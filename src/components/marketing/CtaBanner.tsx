"use client";

import { useEffect, useRef, useState } from "react";

export function CtaBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" }}
      className={`w-full bg-[#F0F4FF] py-16 px-4 transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-[28px] lg:text-[36px] font-bold text-[#111827] leading-[1.2]">
          Start publishing better content today
        </h2>

        <p className="text-[20px] text-[#6B7280] mt-2 leading-[1.5]">
          Join 2,400+ teams generating SEO-optimized articles with AI.
        </p>

        <div className="mt-6 flex justify-center">
          <a
            href="#"
            className="inline-flex items-center justify-center h-[52px] px-8 text-base font-semibold rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors"
          >
            Start Free Trial
          </a>
        </div>

        <p className="mt-3 text-[14px] text-[#9CA3AF]">
          No credit card required
        </p>
      </div>
    </section>
  );
}
