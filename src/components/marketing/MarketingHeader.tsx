"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  PenLine,
  Share2,
  BarChart3,
  Bot,
  Menu,
  X,
  ChevronDown,
  Sparkles,
} from "lucide-react";

// ─── Mega menu feature cards ────────────────────────────────────────────────

interface FeatureCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}

const featureCards: FeatureCard[] = [
  {
    icon: <PenLine className="w-5 h-5 text-blue-600" />,
    title: "AI Article Generation",
    description: "Produce publish-ready articles in seconds with GPT-4.",
    href: "/features/ai-generation",
  },
  {
    icon: <Share2 className="w-5 h-5 text-indigo-600" />,
    title: "Multi-Platform Publishing",
    description: "Push content to WordPress, Ghost, Webflow & more.",
    href: "/features/publishing",
  },
  {
    icon: <BarChart3 className="w-5 h-5 text-emerald-600" />,
    title: "SEO & Analytics",
    description: "Built-in keyword scoring and SERP performance tracking.",
    href: "/features/seo-analytics",
  },
  {
    icon: <Bot className="w-5 h-5 text-violet-600" />,
    title: "Content Automation",
    description: "Schedule, batch, and automate your entire content pipeline.",
    href: "/features/automation",
  },
];

// ─── Nav links ────────────────────────────────────────────────────────────────

const navLinks = [
  { label: "Integrations", href: "/integrations" },
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
];

// ─── Logo ─────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0 select-none">
      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#111827]">
        <Sparkles className="w-4 h-4 text-white" />
      </span>
      <span className="font-bold text-[17px] tracking-tight text-[#111827]">
        ArticleGen
      </span>
    </Link>
  );
}

// ─── Features mega menu ───────────────────────────────────────────────────────

function FeaturesMenu({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[520px] rounded-xl bg-white border border-[#E5E7EB] p-4 z-50"
      style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
      onMouseLeave={onClose}
    >
      <div className="absolute -top-[6px] left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-white border-l border-t border-[#E5E7EB]" />

      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-3 px-1">
        Platform Features
      </p>

      <div className="grid grid-cols-2 gap-2">
        {featureCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            onClick={onClose}
            className="group flex items-start gap-3 p-3 rounded-lg hover:bg-[#F8F9FA] transition-colors duration-150"
          >
            <span className="mt-0.5 flex items-center justify-center w-9 h-9 rounded-lg bg-[#F1F3F5] group-hover:bg-white border border-[#E5E7EB] shrink-0 transition-colors duration-150">
              {card.icon}
            </span>
            <div>
              <p className="text-sm font-semibold text-[#111827] leading-snug">
                {card.title}
              </p>
              <p className="text-xs text-[#6B7280] mt-0.5 leading-snug">
                {card.description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex items-center justify-between px-1">
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

// ─── Mobile drawer ────────────────────────────────────────────────────────────

function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [featuresOpen, setFeaturesOpen] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative ml-auto w-full max-w-sm h-full bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <Logo />
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F1F3F5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-1">
          <button
            onClick={() => setFeaturesOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[15px] font-medium text-[#111827] hover:bg-[#F8F9FA] transition-colors"
          >
            Features
            <ChevronDown
              className={`w-4 h-4 text-[#9CA3AF] transition-transform duration-200 ${featuresOpen ? "rotate-180" : ""}`}
            />
          </button>

          {featuresOpen && (
            <div className="ml-3 mt-1 space-y-1 border-l-2 border-[#E5E7EB] pl-4">
              {featureCards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  onClick={onClose}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-[#6B7280] hover:text-[#111827] hover:bg-[#F8F9FA] transition-colors"
                >
                  <span className="flex items-center justify-center w-7 h-7 rounded-md bg-[#F1F3F5] shrink-0">
                    {card.icon}
                  </span>
                  {card.title}
                </Link>
              ))}
            </div>
          )}

          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="block px-3 py-2.5 rounded-lg text-[15px] font-medium text-[#111827] hover:bg-[#F8F9FA] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="px-4 pb-6 pt-4 border-t border-[#E5E7EB] space-y-3">
          <Link
            href="/login"
            onClick={onClose}
            className="block text-center h-11 px-6 flex items-center justify-center rounded-lg text-[15px] font-medium text-[#111827] border border-[#E5E7EB] hover:bg-[#F8F9FA] transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/trial"
            onClick={onClose}
            className="block text-center h-11 px-6 flex items-center justify-center rounded-lg text-[15px] font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors"
          >
            Start Free Trial
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MarketingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const featuresWrapperRef = useRef<HTMLDivElement>(null);
  const featuresButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        featuresWrapperRef.current &&
        !featuresWrapperRef.current.contains(e.target as Node) &&
        featuresButtonRef.current &&
        !featuresButtonRef.current.contains(e.target as Node)
      ) {
        setFeaturesOpen(false);
      }
    }
    if (featuresOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [featuresOpen]);

  return (
    <>
      <div className="fixed top-3 inset-x-0 z-50 mx-auto w-full max-w-[1200px] px-6 pointer-events-none">
        <header
          className="pointer-events-auto w-full h-16 flex items-center justify-between px-6 rounded-3xl transition-all duration-200"
          style={{
            background: "rgba(255,255,255,0.80)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: scrolled
              ? "0 8px 24px rgba(0,0,0,0.08)"
              : "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          {/* Logo */}
          <Logo />

          {/* Desktop nav — centered */}
          <nav className="hidden lg:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
            <div className="relative" ref={featuresWrapperRef}>
              <button
                ref={featuresButtonRef}
                onMouseEnter={() => setFeaturesOpen(true)}
                onClick={() => setFeaturesOpen((v) => !v)}
                className={`flex items-center gap-1 px-3 py-2 text-[15px] font-medium transition-colors duration-150 ${
                  featuresOpen
                    ? "text-[#111827]"
                    : "text-[#6B7280] hover:text-[#111827]"
                }`}
                aria-expanded={featuresOpen}
                aria-haspopup="true"
              >
                Features
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${featuresOpen ? "rotate-180" : ""}`}
                />
              </button>

              {featuresOpen && (
                <FeaturesMenu onClose={() => setFeaturesOpen(false)} />
              )}
            </div>

            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-[15px] font-medium text-[#6B7280] hover:text-[#111827] transition-colors duration-150"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right: CTAs */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <Link
              href="/login"
              className="px-3 py-2 text-[15px] font-medium text-[#6B7280] hover:text-[#111827] transition-colors duration-150"
            >
              Log in
            </Link>
            <Link
              href="/trial"
              className="inline-flex items-center justify-center h-11 px-6 text-[15px] font-semibold rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors duration-150"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 rounded-lg text-[#6B7280] hover:bg-[#F1F3F5] transition-colors"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>
      </div>

      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
