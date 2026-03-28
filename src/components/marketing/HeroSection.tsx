"use client";

import { useEffect, useRef, useState } from "react";

export function HeroSection() {
  const textRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const [textVisible, setTextVisible] = useState(false);
  const [visualVisible, setVisualVisible] = useState(false);

  useEffect(() => {
    const textEl = textRef.current;
    const visualEl = visualRef.current;

    const textObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTextVisible(true);
          textObserver.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    const visualObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisualVisible(true), 200);
          visualObserver.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (textEl) textObserver.observe(textEl);
    if (visualEl) visualObserver.observe(visualEl);

    return () => {
      textObserver.disconnect();
      visualObserver.disconnect();
    };
  }, []);

  return (
    <section className="bg-[#FFFFFF] pt-32 pb-24 lg:pt-40 lg:pb-32">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-12">

          {/* LEFT COLUMN — 55% */}
          <div
            ref={textRef}
            className={`lg:w-[55%] transition-all duration-500 ease-out ${
              textVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] mb-4">
              AI Content Platform
            </p>

            <h1 className="text-[36px] md:text-[56px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#111827]">
              Write once. Rank everywhere.
            </h1>

            <p className="text-[18px] text-[#6B7280] leading-[1.6] max-w-[520px] mt-4">
              ArticleGen generates SEO-optimized articles and publishes them to
              your entire content stack &mdash; automatically.
            </p>

            <div className="mt-8 flex items-center flex-wrap gap-3">
              <a
                href="/trial"
                className="inline-flex items-center justify-center h-[52px] px-8 text-base font-semibold rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors"
              >
                Start Free Trial
              </a>
              <a
                href="#features"
                className="inline-flex items-center justify-center h-[52px] px-8 text-base font-semibold rounded-xl border border-[#E5E7EB] text-[#111827] hover:bg-[#F8F9FA] transition-colors"
              >
                See how it works
              </a>
            </div>

            <p className="mt-3 text-[14px] text-[#9CA3AF]">
              No credit card required &middot; Cancel anytime
            </p>
          </div>

          {/* RIGHT COLUMN — 45% */}
          <div
            ref={visualRef}
            className={`lg:w-[45%] mt-8 lg:mt-0 flex justify-center lg:justify-end transition-all duration-500 ease-out ${
              visualVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <div
              className="w-full max-w-[500px] rounded-2xl overflow-hidden"
              style={{
                background: "#0f172a",
                border: "1px solid #1e293b",
                boxShadow:
                  "0 25px 50px -12px rgba(0,0,0,0.5)",
              }}
            >
              {/* Header bar */}
              <div
                className="px-4 py-3 flex items-center gap-2"
                style={{ borderBottom: "1px solid #1e293b" }}
              >
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-[13px] text-[#64748b] ml-2">
                  ArticleGen &mdash; ai-seo-practices-2025.md
                </span>
              </div>

              {/* Content area */}
              <div className="p-5 space-y-4">
                <p className="text-[12px] font-mono text-[#94a3b8]">
                  # Best SEO Practices for 2025
                </p>

                <div className="space-y-2">
                  <div
                    className="h-2.5 rounded"
                    style={{ background: "#1e293b", width: "92%" }}
                  />
                  <div
                    className="h-2.5 rounded"
                    style={{ background: "#1e293b", width: "85%" }}
                  />
                  <div
                    className="h-2.5 rounded"
                    style={{ background: "#1e293b", width: "78%" }}
                  />
                  <div
                    className="h-2.5 rounded"
                    style={{ background: "#1e293b", width: "96%" }}
                  />
                  <div
                    className="h-2.5 rounded"
                    style={{ background: "#1e293b", width: "70%" }}
                  />
                </div>

                <div
                  className="h-3 rounded mt-4"
                  style={{ background: "#334155", width: "55%" }}
                />

                <div className="space-y-2">
                  <div
                    className="h-2.5 rounded"
                    style={{ background: "#1e293b", width: "88%" }}
                  />
                  <div
                    className="h-2.5 rounded"
                    style={{ background: "#1e293b", width: "82%" }}
                  />
                  <div
                    className="h-2.5 rounded"
                    style={{ background: "#1e293b", width: "75%" }}
                  />
                </div>

                {/* Status bar */}
                <div
                  className="flex items-center gap-4 mt-4 pt-4"
                  style={{ borderTop: "1px solid #1e293b" }}
                >
                  <span className="text-[11px] text-[#475569]">2,847 words</span>
                  <span className="text-[11px] text-[#475569]">&middot;</span>
                  <span className="text-[11px] text-[#475569]">
                    SEO Score:{" "}
                    <span className="text-[#22d3ee] font-bold">94</span>
                  </span>
                  <span
                    className="ml-auto px-2 py-1 rounded-full text-[11px] text-[#60a5fa]"
                    style={{ background: "#1e293b" }}
                  >
                    Generating...
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
