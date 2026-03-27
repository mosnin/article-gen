"use client";

import { useEffect, useRef, useState } from "react";

export function CtaBanner() {
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
    <section className="py-16 px-4">
      <div
        ref={ref}
        className={`relative mx-auto max-w-5xl rounded-3xl overflow-hidden transition-all duration-700 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
        style={{
          background: "linear-gradient(135deg, #2563eb 0%, #4338ca 100%)",
        }}
      >
        {/* Dot pattern overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Soft glow blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white opacity-[0.05] blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-indigo-300 opacity-[0.08] blur-3xl"
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center py-16 px-6 sm:px-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight mb-4 max-w-2xl">
            Start generating articles that rank today
          </h2>
          <p className="text-base sm:text-lg text-blue-100 mb-8 max-w-lg">
            Join 2,400+ content teams. First 3 articles free. No credit card.
          </p>

          {/* Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="#"
              className="inline-flex items-center justify-center h-[52px] px-8 rounded-xl bg-white text-blue-700 font-semibold text-base shadow-lg hover:bg-blue-50 transition-colors"
            >
              Start writing free →
            </a>
            <a
              href="#"
              className="inline-flex items-center justify-center h-[52px] px-8 rounded-xl border-2 border-white/40 text-white font-semibold text-base hover:bg-white/10 transition-colors"
            >
              See pricing
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
