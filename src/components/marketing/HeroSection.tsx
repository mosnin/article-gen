"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

// ─── Hand-drawn SVG accents ───────────────────────────────────────────────────

const ArrowAccentLeft = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#a5f3fc", stroke: "currentColor", overflow: "visible" }}>
    <path d="M10,90 C 10,40 40,20 60,50 C 70,65 80,75 95,70" />
    <path d="M80,55 L95,70 L85,85" />
  </svg>
);

const ArrowAccentRight = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#a5f3fc", stroke: "currentColor", overflow: "visible" }}>
    <path d="M90,10 C 80,60 60,80 40,60 C 20,40 40,20 60,30" />
    <path d="M50,15 L60,30 L45,35" />
  </svg>
);

// ─── Circular spinning badge ──────────────────────────────────────────────────

const CircularBadge = () => (
  <div className="relative w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-xl rotate-12 hover:scale-105 transition-transform cursor-pointer border-[2px] border-white/20">
    <div className="absolute inset-1 animate-[spin_12s_linear_infinite]">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <path id="badgePath" d="M 50,50 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none" />
        <text fontSize="10" fontWeight="800" letterSpacing="2" fill="#111827">
          <textPath href="#badgePath" startOffset="0%">
            START FOR FREE • START FOR FREE •
          </textPath>
        </text>
      </svg>
    </div>
    <Sparkles className="w-6 h-6 text-[#111827]" />
  </div>
);

// ─── Article mockup card ──────────────────────────────────────────────────────

function ArticleCard({ rotate, title, score, words, tag }: {
  rotate: string;
  title: string;
  score: number;
  words: string;
  tag: string;
}) {
  return (
    <div
      className={`w-52 bg-white/15 backdrop-blur-md border border-white/30 rounded-[1.5rem] p-5 shadow-2xl ${rotate} hover:rotate-0 transition-transform duration-500`}
    >
      {/* Tag */}
      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white mb-3">
        {tag}
      </span>
      {/* Title */}
      <p className="text-sm font-bold text-white leading-snug mb-3 line-clamp-2">
        {title}
      </p>
      {/* SEO score bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-white/60">SEO Score</span>
          <span className="text-[11px] font-black text-cyan-300">{score}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-400"
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
      {/* Words */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/50">{words} words</span>
        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Published
        </span>
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

export function HeroSection() {
  return (
    <div className="min-h-screen bg-[#0F1629] flex flex-col font-sans selection:bg-cyan-400/30 relative overflow-hidden w-full">

      {/* Grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none z-0" />

      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(37,99,235,0.25) 0%, transparent 70%)",
        }}
      />

      {/* Spacer for fixed navbar */}
      <div className="h-28" />

      {/* ── Main hero content ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-24 md:pb-40">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[12px] font-semibold text-white/80 tracking-wide">AI-Powered Content Engine</span>
        </motion.div>

        {/* Stacked typography */}
        <div className="relative w-full max-w-5xl mx-auto flex flex-col items-center text-center z-10">

          {/* PUBLISH — offset left */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full flex justify-start pl-[8%] md:pl-[18%]"
          >
            <h1
              className="text-[clamp(3.5rem,10vw,130px)] font-black leading-[0.88] tracking-tighter text-cyan-300 m-0 p-0 uppercase select-none"
              style={{
                textShadow: "2px 2px 0 #0c2461, 4px 4px 0 #0c2461, 6px 6px 0 #0c2461, 8px 8px 0 #0c2461",
              }}
            >
              PUBLISH
            </h1>
          </motion.div>

          {/* CONTENT — center, largest */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.32 }}
            className="w-full flex justify-center"
          >
            <h1
              className="text-[clamp(4rem,14vw,190px)] font-black leading-[0.88] tracking-tighter text-white m-0 p-0 uppercase select-none"
              style={{
                textShadow: "2px 2px 0 #0c2461, 4px 4px 0 #0c2461, 6px 6px 0 #0c2461, 8px 8px 0 #0c2461, 10px 10px 0 #0c2461",
              }}
            >
              CONTENT
            </h1>
          </motion.div>

          {/* FASTER — offset right */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.44 }}
            className="w-full flex justify-end pr-[8%] md:pr-[18%]"
          >
            <h1
              className="text-[clamp(3.5rem,10vw,130px)] font-black leading-[0.88] tracking-tighter text-white m-0 p-0 uppercase select-none"
              style={{
                textShadow: "2px 2px 0 #0c2461, 4px 4px 0 #0c2461, 6px 6px 0 #0c2461, 8px 8px 0 #0c2461",
              }}
            >
              FASTER
            </h1>
          </motion.div>

          {/* ── Floating overlays ── */}
          <div className="absolute inset-0 w-full h-full pointer-events-none">

            {/* Article card — bottom left */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.6 }}
              className="absolute bottom-[-10%] left-[2%] md:left-[8%] z-30 pointer-events-auto"
              style={{ animation: "float1 5s ease-in-out infinite" }}
            >
              <ArticleCard
                rotate="-rotate-6"
                tag="SEO Article"
                title="10 Best SEO Practices for B2B SaaS in 2025"
                score={94}
                words="2,847"
              />
            </motion.div>

            {/* Article card — top right */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.75 }}
              className="absolute top-[5%] right-[2%] md:right-[8%] z-30 pointer-events-auto"
              style={{ animation: "float2 6s ease-in-out infinite" }}
            >
              <ArticleCard
                rotate="rotate-6"
                tag="Blog Post"
                title="How to Scale Content Without Hiring More Writers"
                score={88}
                words="1,640"
              />
            </motion.div>

            {/* Arrow left */}
            <div className="absolute bottom-[-5%] left-[0%] md:left-[2%] w-20 h-20 md:w-28 md:h-28 z-20">
              <ArrowAccentLeft />
            </div>

            {/* Arrow right */}
            <div className="absolute top-[2%] right-[0%] md:right-[2%] w-20 h-20 md:w-28 md:h-28 z-20">
              <ArrowAccentRight />
            </div>

            {/* Circular badge */}
            <div className="absolute bottom-[-18%] right-[2%] md:right-[12%] z-40 pointer-events-auto">
              <CircularBadge />
            </div>
          </div>
        </div>

        {/* Subheadline + CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.85 }}
          className="mt-16 md:mt-20 flex flex-col items-center gap-6 relative z-20"
        >
          <p className="text-[17px] text-white/60 max-w-[480px] text-center leading-relaxed">
            Generate SEO-optimized articles and auto-publish to every platform.
            Your 30-day content plan, built in seconds.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/trial"
              className="inline-flex items-center gap-2 h-12 px-7 text-[15px] font-bold text-[#111827] bg-white hover:bg-gray-100 rounded-full transition-colors shadow-lg shadow-white/10"
            >
              Start for free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 h-12 px-7 text-[15px] font-medium text-white/70 hover:text-white border border-white/15 hover:border-white/30 rounded-full transition-colors"
            >
              See how it works
            </a>
          </div>

          <p className="text-[13px] text-white/30">No credit card required · Cancel anytime</p>
        </motion.div>
      </main>

      {/* ── Bottom white feature cards ── */}
      <section
        id="features"
        className="bg-white text-[#111827] rounded-t-[2.5rem] md:rounded-t-[3rem] px-6 py-12 md:px-10 md:py-16 relative z-20 shadow-[0_-20px_60px_rgba(0,0,0,0.3)]"
      >
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Card 1 — Generate */}
          <div className="bg-[#F8F9FA] rounded-[1.75rem] p-8 flex flex-col h-64 border border-[#E5E7EB] relative overflow-hidden">
            <div className="w-10 h-10 rounded-2xl bg-[#EFF6FF] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-black uppercase leading-tight mb-1">Generate Articles</h3>
            <p className="text-[12px] text-[#6B7280] font-medium mb-auto">AI writes publish-ready, SEO-optimized content in seconds</p>
            {/* Mini mockup */}
            <div className="mt-4 flex items-center gap-2 bg-[#111827] rounded-2xl px-3 py-2">
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-3/4 rounded-full bg-blue-400 animate-pulse" />
              </div>
              <span className="text-[10px] font-bold text-blue-300 whitespace-nowrap">Generating…</span>
            </div>
          </div>

          {/* Card 2 — SEO */}
          <div className="bg-[#F8F9FA] rounded-[1.75rem] p-8 flex flex-col h-64 border border-[#E5E7EB] relative overflow-hidden">
            <div className="w-10 h-10 rounded-2xl bg-[#F0FDF4] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-black uppercase leading-tight mb-1">SEO Optimized</h3>
            <p className="text-[12px] text-[#6B7280] font-medium mb-auto">Built-in keyword scoring, SERP tracking, and competitor analysis</p>
            {/* Score display */}
            <div className="mt-4 flex items-center justify-between bg-[#111827] rounded-2xl px-4 py-2.5">
              <span className="text-[11px] text-white/50 font-medium">SEO Score</span>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-20 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full w-[94%] rounded-full bg-emerald-400" />
                </div>
                <span className="text-[13px] font-black text-emerald-300">94</span>
              </div>
            </div>
          </div>

          {/* Card 3 — Publish */}
          <div className="bg-[#F8F9FA] rounded-[1.75rem] p-8 flex flex-col h-64 border border-[#E5E7EB] relative overflow-hidden">
            <div className="w-10 h-10 rounded-2xl bg-[#F5F3FF] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-lg font-black uppercase leading-tight mb-1">Auto-Publish</h3>
            <p className="text-[12px] text-[#6B7280] font-medium mb-auto">Push to WordPress, Ghost, Webflow, Shopify & more automatically</p>
            {/* Platform pills */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {["WordPress", "Ghost", "Webflow"].map((p) => (
                <span key={p} className="px-2.5 py-1 rounded-full bg-[#111827] text-white text-[10px] font-bold">
                  {p}
                </span>
              ))}
              <span className="px-2.5 py-1 rounded-full bg-[#E5E7EB] text-[#6B7280] text-[10px] font-bold">
                +37 more
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* Float keyframes */}
      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translateY(0px) rotate(-6deg); }
          50% { transform: translateY(-14px) rotate(-6deg); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0px) rotate(6deg); }
          50% { transform: translateY(-18px) rotate(6deg); }
        }
      `}</style>
    </div>
  );
}
