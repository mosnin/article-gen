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
      className="relative overflow-hidden bg-white pt-32 pb-24 lg:pt-40 lg:pb-32"
    >
      {/* ── Abstract decorative art — LEFT ─────────────────────────────────── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-[480px]">
        {/* Main fluid blob */}
        <div
          className="absolute -top-20 -left-24 w-[420px] h-[420px] rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at 40% 40%, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.12) 35%, rgba(59,130,246,0.08) 60%, transparent 80%)",
            filter: "blur(32px)",
          }}
        />
        {/* Secondary accent blob */}
        <div
          className="absolute top-32 -left-8 w-[260px] h-[260px] rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(168,85,247,0.14) 0%, rgba(99,102,241,0.08) 50%, transparent 75%)",
            filter: "blur(24px)",
          }}
        />
        {/* Pixelated / digital texture grid — top-left quadrant */}
        <div
          className="absolute top-8 left-8 w-[280px] h-[280px] opacity-[0.22]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 18px, rgba(99,102,241,0.35) 18px, rgba(99,102,241,0.35) 19px), repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(99,102,241,0.35) 18px, rgba(99,102,241,0.35) 19px)",
          }}
        />
        {/* Pixelated scatter — small bright squares */}
        <div
          className="absolute top-12 left-12 w-[200px] h-[200px] opacity-[0.15]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 35px, rgba(139,92,246,0.6) 35px, rgba(139,92,246,0.6) 37px), repeating-linear-gradient(90deg, transparent, transparent 35px, rgba(139,92,246,0.6) 35px, rgba(139,92,246,0.6) 37px)",
          }}
        />
        {/* Fade mask — blends art into white center */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, transparent 0%, transparent 55%, white 100%)",
          }}
        />
      </div>

      {/* ── Abstract decorative art — RIGHT ────────────────────────────────── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-[480px]">
        {/* Main fluid blob */}
        <div
          className="absolute -top-20 -right-24 w-[420px] h-[420px] rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at 60% 40%, rgba(59,130,246,0.18) 0%, rgba(99,102,241,0.12) 35%, rgba(139,92,246,0.08) 60%, transparent 80%)",
            filter: "blur(32px)",
          }}
        />
        {/* Secondary accent blob */}
        <div
          className="absolute top-32 -right-8 w-[260px] h-[260px] rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.14) 0%, rgba(168,85,247,0.08) 50%, transparent 75%)",
            filter: "blur(24px)",
          }}
        />
        {/* Pixelated / digital texture grid — top-right quadrant */}
        <div
          className="absolute top-8 right-8 w-[280px] h-[280px] opacity-[0.22]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 18px, rgba(59,130,246,0.35) 18px, rgba(59,130,246,0.35) 19px), repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(59,130,246,0.35) 18px, rgba(59,130,246,0.35) 19px)",
          }}
        />
        {/* Pixelated scatter — small bright squares */}
        <div
          className="absolute top-12 right-12 w-[200px] h-[200px] opacity-[0.15]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 35px, rgba(99,102,241,0.6) 35px, rgba(99,102,241,0.6) 37px), repeating-linear-gradient(90deg, transparent, transparent 35px, rgba(99,102,241,0.6) 35px, rgba(99,102,241,0.6) 37px)",
          }}
        />
        {/* Fade mask — blends art into white center */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to left, transparent 0%, transparent 55%, white 100%)",
          }}
        />
      </div>

      {/* ── Hero content — centered ─────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <div
          className={`transition-all duration-700 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {/* Overline label */}
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
            AI Content Platform
          </p>

          {/* Display headline */}
          <h1
            className="font-serif font-bold tracking-tight text-gray-900 leading-[1.06] mb-6"
            style={{ fontSize: "clamp(3rem, 6vw, 5rem)", fontDisplay: "swap" } as React.CSSProperties}
          >
            Write once.{" "}
            <span className="block">Rank everywhere.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg leading-relaxed text-gray-500 mb-10 max-w-xl mx-auto">
            ArticleGen generates SEO-optimized long-form articles and publishes
            them to your entire content stack — automatically.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            <a
              href="/trial"
              className="inline-flex items-center justify-center h-12 px-7 rounded-md bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold transition-colors"
            >
              Start Free Trial
            </a>
            <a
              href="#demo"
              className="inline-flex items-center justify-center h-12 px-7 rounded-md bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold border border-gray-300 transition-colors"
            >
              See how it works
            </a>
          </div>

          {/* Trust line */}
          <p className="text-sm text-gray-400">
            No credit card required · Cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
}
