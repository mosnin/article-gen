"use client";

import { useEffect, useRef, useState } from "react";

export function FinalCtaSection() {
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
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="bg-gray-50 dark:bg-gray-900 py-24">
      <div
        ref={ref}
        className={`mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center transition-all duration-700 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        {/* Badge */}
        <div className="mb-6 inline-flex items-center justify-center">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-widest">
            Start Free Today
          </span>
        </div>

        {/* Headline */}
        <h2 className="text-4xl sm:text-5xl lg:text-[52px] font-bold leading-tight tracking-tight text-gray-900 dark:text-white mb-5">
          The content engine your competitors{" "}
          <span className="text-blue-600 dark:text-blue-400">
            haven&apos;t discovered yet
          </span>
        </h2>

        {/* Subtext */}
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-10 max-w-xl mx-auto">
          Join 2,400+ teams writing faster, ranking higher, and publishing
          everywhere.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
          <a
            href="#"
            className="inline-flex items-center justify-center h-[56px] px-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold shadow-lg shadow-blue-500/20 transition-colors"
          >
            Start writing free
          </a>
          <a
            href="#"
            className="inline-flex items-center justify-center h-[56px] px-10 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-base font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Talk to us
          </a>
        </div>

        {/* Trust row */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="text-green-500 font-bold">✓</span> No credit card
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-green-500 font-bold">✓</span> First 3 articles free
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-green-500 font-bold">✓</span> Cancel anytime
          </span>
        </div>
      </div>
    </section>
  );
}
