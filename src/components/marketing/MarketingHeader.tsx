"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  PenLine,
  Share2,
  BarChart3,
  Bot,
  ChevronDown,
  Sparkles,
  X,
} from "lucide-react";

// ─── Feature cards for mega menu ─────────────────────────────────────────────

interface FeatureCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}

const featureCards: FeatureCard[] = [
  {
    icon: <PenLine className="w-4 h-4 text-blue-600" />,
    title: "AI Article Generation",
    description: "Produce publish-ready articles in seconds.",
    href: "/features/ai-generation",
  },
  {
    icon: <Share2 className="w-4 h-4 text-indigo-600" />,
    title: "Multi-Platform Publishing",
    description: "Push to WordPress, Ghost, Webflow & more.",
    href: "/features/publishing",
  },
  {
    icon: <BarChart3 className="w-4 h-4 text-emerald-600" />,
    title: "SEO & Analytics",
    description: "Built-in keyword scoring and SERP tracking.",
    href: "/features/seo-analytics",
  },
  {
    icon: <Bot className="w-4 h-4 text-violet-600" />,
    title: "Content Automation",
    description: "Schedule, batch, and automate your pipeline.",
    href: "/features/automation",
  },
];

const navLinks = [
  { label: "Integrations", href: "/integrations" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
];

// ─── Animated nav link ────────────────────────────────────────────────────────

function AnimatedNavLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group relative inline-flex overflow-hidden h-5 items-start text-sm"
    >
      <div className="flex flex-col transition-transform duration-300 ease-out group-hover:-translate-y-1/2">
        <span className="h-5 flex items-center text-[#6B7280]">{children}</span>
        <span className="h-5 flex items-center text-[#111827]">{children}</span>
      </div>
    </Link>
  );
}

// ─── Features mega menu (light) ───────────────────────────────────────────────

function FeaturesMenu({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[480px] rounded-2xl p-4 z-50 bg-white"
      style={{
        border: "1px solid #E5E7EB",
        boxShadow: "0 16px 48px rgba(0,0,0,0.12)",
      }}
      onMouseLeave={onClose}
    >
      {/* Caret */}
      <div
        className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-white"
        style={{ border: "1px solid #E5E7EB", borderBottom: "none", borderRight: "none" }}
      />

      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9CA3AF] mb-3 px-1">
        Platform Features
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        {featureCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            onClick={onClose}
            className="group/card flex items-start gap-3 p-3 rounded-xl hover:bg-[#F8F9FA] transition-colors duration-150"
          >
            <span className="mt-0.5 flex items-center justify-center w-8 h-8 rounded-lg bg-[#F1F3F5] border border-[#E5E7EB] shrink-0">
              {card.icon}
            </span>
            <div>
              <p className="text-sm font-medium text-[#111827] leading-snug">
                {card.title}
              </p>
              <p className="text-xs text-[#6B7280] mt-0.5 leading-snug">
                {card.description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-[#F1F3F5] flex items-center justify-between px-1">
        <p className="text-xs text-[#9CA3AF]">Explore the full platform</p>
        <Link
          href="/features"
          onClick={onClose}
          className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
        >
          View all features &rarr;
        </Link>
      </div>
    </div>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0 select-none">
      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#111827]">
        <Sparkles className="w-4 h-4 text-white" />
      </span>
      <span className="font-bold text-[15px] tracking-tight text-[#111827]">
        ArticleGen
      </span>
    </Link>
  );
}

// ─── Main header ──────────────────────────────────────────────────────────────

export function MarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [mobileFeaturesOpen, setMobileFeaturesOpen] = useState(false);
  const [pillShape, setPillShape] = useState("rounded-full");
  const shapeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const featuresButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (shapeTimerRef.current) clearTimeout(shapeTimerRef.current);
    if (mobileOpen) {
      setPillShape("rounded-2xl");
    } else {
      shapeTimerRef.current = setTimeout(() => setPillShape("rounded-full"), 300);
    }
    return () => {
      if (shapeTimerRef.current) clearTimeout(shapeTimerRef.current);
    };
  }, [mobileOpen]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        featuresRef.current &&
        !featuresRef.current.contains(e.target as Node) &&
        featuresButtonRef.current &&
        !featuresButtonRef.current.contains(e.target as Node)
      ) {
        setFeaturesOpen(false);
      }
    }
    if (featuresOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [featuresOpen]);

  return (
    <header
      className={`fixed top-5 left-1/2 -translate-x-1/2 z-50
        flex flex-col items-center
        px-5 py-3
        border border-[#E5E7EB]
        w-[calc(100%-2rem)] sm:w-auto
        ${pillShape}
        transition-[border-radius] duration-300 ease-in-out`}
      style={{
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.8) inset",
      }}
    >
      {/* ── Top row ── */}
      <div className="flex items-center justify-between w-full gap-x-6 sm:gap-x-8">

        {/* Logo */}
        <Logo />

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-5">
          {/* Features with mega menu */}
          <div className="relative" ref={featuresRef}>
            <button
              ref={featuresButtonRef}
              onMouseEnter={() => setFeaturesOpen(true)}
              onClick={() => setFeaturesOpen((v) => !v)}
              aria-expanded={featuresOpen}
              aria-haspopup="true"
              className="group relative inline-flex overflow-hidden h-5 items-start gap-1 text-sm focus:outline-none"
            >
              <div className="flex flex-col transition-transform duration-300 ease-out group-hover:-translate-y-1/2">
                <span className="h-5 flex items-center gap-1 text-[#6B7280]">
                  Features
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${featuresOpen ? "rotate-180" : ""}`}
                  />
                </span>
                <span className="h-5 flex items-center gap-1 text-[#111827]">
                  Features
                  <ChevronDown className="w-3 h-3" />
                </span>
              </div>
            </button>

            {featuresOpen && (
              <FeaturesMenu onClose={() => setFeaturesOpen(false)} />
            )}
          </div>

          {navLinks.map((link) => (
            <AnimatedNavLink key={link.href} href={link.href}>
              {link.label}
            </AnimatedNavLink>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Log in */}
          <Link
            href="/trial"
            className="px-4 py-1.5 text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors duration-200"
          >
            Log in
          </Link>

          {/* Start Free Trial — solid dark */}
          <Link
            href="/trial"
            className="px-4 py-1.5 text-sm font-semibold text-white bg-[#111827] hover:bg-[#1f2937] rounded-full transition-colors duration-200"
          >
            Start Free Trial
          </Link>
        </div>

        {/* Mobile hamburger / close */}
        <button
          className="lg:hidden flex items-center justify-center w-8 h-8 text-[#6B7280] focus:outline-none"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Mobile expandable section ── */}
      <div
        className={`lg:hidden flex flex-col items-center w-full transition-all ease-in-out duration-300 overflow-hidden
          ${mobileOpen ? "max-h-[600px] opacity-100 pt-4" : "max-h-0 opacity-0 pt-0 pointer-events-none"}`}
      >
        <nav className="flex flex-col items-start w-full space-y-1">
          <button
            onClick={() => setMobileFeaturesOpen((v) => !v)}
            className="flex items-center justify-between w-full px-2 py-2 text-sm text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            Features
            <ChevronDown
              className={`w-4 h-4 text-[#9CA3AF] transition-transform duration-200 ${mobileFeaturesOpen ? "rotate-180" : ""}`}
            />
          </button>

          {mobileFeaturesOpen && (
            <div className="w-full pl-4 pb-1 space-y-1 border-l border-[#E5E7EB]">
              {featureCards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm text-[#6B7280] hover:text-[#111827] transition-colors"
                >
                  <span className="flex items-center justify-center w-6 h-6 rounded-md bg-[#F1F3F5] shrink-0">
                    {card.icon}
                  </span>
                  {card.title}
                </Link>
              ))}
              <Link
                href="/features"
                onClick={() => setMobileOpen(false)}
                className="block px-2 py-1 text-xs text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
              >
                View all features &rarr;
              </Link>
            </div>
          )}

          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block w-full px-2 py-2 text-sm text-[#6B7280] hover:text-[#111827] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col w-full gap-2 mt-4 pt-4 border-t border-[#F1F3F5]">
          <Link
            href="/trial"
            onClick={() => setMobileOpen(false)}
            className="w-full text-center px-4 py-2.5 text-sm font-medium text-[#6B7280] border border-[#E5E7EB] rounded-full hover:bg-[#F8F9FA] transition-colors duration-200"
          >
            Log in
          </Link>
          <Link
            href="/trial"
            onClick={() => setMobileOpen(false)}
            className="w-full text-center px-4 py-2.5 text-sm font-semibold text-white bg-[#111827] hover:bg-[#1f2937] rounded-full transition-colors duration-200"
          >
            Start Free Trial
          </Link>
        </div>
      </div>
    </header>
  );
}
