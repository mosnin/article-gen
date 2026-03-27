"use client";

import { useEffect, useRef, useState } from "react";

export function HeroSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-white dark:bg-gray-950 pt-24 pb-20 lg:pt-32 lg:pb-28"
    >
      {/* Background radial gradient blob */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-32 w-[700px] h-[700px] rounded-full bg-blue-500 opacity-[0.07] blur-3xl dark:opacity-[0.12]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-40 left-1/3 w-[400px] h-[400px] rounded-full bg-indigo-400 opacity-[0.06] blur-3xl dark:opacity-[0.10]"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* LEFT: Copy */}
          <div
            className={`transition-all duration-700 ease-out ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            {/* Overline */}
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
              AI-Powered Content Engine
            </p>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-[64px] font-bold leading-[1.08] tracking-tight text-gray-900 dark:text-white mb-6">
              Write once.
              <br />
              <span className="text-blue-600 dark:text-blue-400">
                Rank everywhere.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-[18px] leading-relaxed text-gray-500 dark:text-gray-400 mb-8 max-w-lg">
              ArticleGen generates SEO-optimized long-form articles and publishes
              them to your entire content stack — automatically.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-3 mb-6">
              <a
                href="#"
                className="inline-flex items-center justify-center h-[52px] px-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold transition-colors shadow-sm"
              >
                Start writing free
              </a>
              <a
                href="#"
                className="inline-flex items-center justify-center h-[52px] px-8 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-base font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Watch 2-min demo
              </a>
            </div>

            {/* Trust microcopy */}
            <p className="text-sm text-gray-400 dark:text-gray-500 flex flex-wrap gap-4">
              <span>✓ No credit card required</span>
              <span>✓ First 3 articles free</span>
            </p>
          </div>

          {/* RIGHT: Product UI Mockup */}
          <div
            className={`transition-all duration-700 ease-out delay-200 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div
              className="relative mx-auto max-w-md lg:max-w-full"
              style={{ animation: "heroFloat 4s ease-in-out infinite" }}
            >
              {/* Card shadow glow */}
              <div
                aria-hidden="true"
                className="absolute inset-0 rounded-2xl bg-blue-500 opacity-10 blur-2xl scale-105"
              />

              {/* Main card */}
              <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                {/* Card top bar */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60">
                  <div className="flex items-center gap-2">
                    {/* Logo hex */}
                    <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                      A
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      ArticleGen
                    </span>
                  </div>
                  <button className="text-xs font-semibold px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                    Generate
                  </button>
                </div>

                <div className="px-5 py-5 space-y-5">
                  {/* Topic input */}
                  <div>
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-wide">
                      Topic
                    </p>
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2.5 border border-gray-200 dark:border-gray-700">
                      &ldquo;Best CRM for startups&rdquo;
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400 dark:text-gray-500">Generating article...</span>
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">87%</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                        style={{ width: "87%" }}
                      />
                    </div>
                  </div>

                  {/* Article preview card */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 space-y-2">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                      ## Best CRM for Startups
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Published to:</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                        WP
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        Medium
                      </span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                        <span>✓</span> 2,847 words
                      </span>
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                        <span>✓</span> SEO 94
                      </span>
                    </div>
                  </div>

                  {/* Platform icons row */}
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                      Platforms
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                        WP
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
                        Ghost
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-100 dark:border-yellow-800">
                        Dev.to
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-800">
                        Shopify
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                        +3
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes heroFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </section>
  );
}
