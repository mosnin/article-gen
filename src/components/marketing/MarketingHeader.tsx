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
    icon: <PenLine className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
    title: "AI Article Generation",
    description: "Produce publish-ready articles in seconds with GPT-4.",
    href: "/features/ai-generation",
  },
  {
    icon: <Share2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
    title: "Multi-Platform Publishing",
    description: "Push content to WordPress, Ghost, Webflow & more.",
    href: "/features/publishing",
  },
  {
    icon: <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
    title: "SEO & Analytics",
    description: "Built-in keyword scoring and SERP performance tracking.",
    href: "/features/seo-analytics",
  },
  {
    icon: <Bot className="w-5 h-5 text-violet-600 dark:text-violet-400" />,
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
      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 shadow-sm">
        <Sparkles className="w-4 h-4 text-white" />
      </span>
      <span className="font-bold text-[17px] tracking-tight text-gray-900 dark:text-white">
        ArticleGen
      </span>
    </Link>
  );
}

// ─── Features mega menu ───────────────────────────────────────────────────────

function FeaturesMenu({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[520px] rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-700/60 shadow-xl shadow-gray-900/10 dark:shadow-black/40 p-4 z-50"
      onMouseLeave={onClose}
    >
      {/* Arrow pointer */}
      <div className="absolute -top-[6px] left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-white dark:bg-gray-900 border-l border-t border-gray-200/80 dark:border-gray-700/60" />

      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3 px-1">
        Platform Features
      </p>

      <div className="grid grid-cols-2 gap-2">
        {featureCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            onClick={onClose}
            className="group flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150"
          >
            <span className="mt-0.5 flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 group-hover:bg-white dark:group-hover:bg-gray-700 border border-gray-200/60 dark:border-gray-700/60 shrink-0 transition-colors duration-150">
              {card.icon}
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                {card.title}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                {card.description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between px-1">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Explore the full platform
        </p>
        <Link
          href="/features"
          onClick={onClose}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        >
          View all features →
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

  // Lock body scroll when drawer is open
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-sm h-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <Logo />
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-1">
          {/* Features accordion */}
          <button
            onClick={() => setFeaturesOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[15px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Features
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${featuresOpen ? "rotate-180" : ""}`}
            />
          </button>

          {featuresOpen && (
            <div className="ml-3 mt-1 space-y-1 border-l-2 border-gray-100 dark:border-gray-800 pl-4">
              {featureCards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  onClick={onClose}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 dark:bg-gray-800 shrink-0">
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
              className="block px-3 py-2.5 rounded-lg text-[15px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* CTA area */}
        <div className="px-4 pb-6 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
          <Link
            href="/login"
            onClick={onClose}
            className="block text-center px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            onClick={onClose}
            className="block text-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
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
  const featuresRef = useRef<HTMLDivElement>(null);
  const featuresButtonRef = useRef<HTMLButtonElement>(null);

  // Track scroll
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close features menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        featuresRef.current &&
        !featuresRef.current.contains(e.target as Node) &&
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
      <header className="fixed top-3 left-0 right-0 z-50 px-4">
        <div
          className={`
            max-w-[1200px] mx-auto rounded-3xl border px-5 transition-all duration-300
            ${
              scrolled
                ? "bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl shadow-xl shadow-gray-900/10 dark:shadow-black/40 border-gray-200/80 dark:border-gray-700/60"
                : "bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-lg shadow-gray-900/[0.06] dark:shadow-black/30 border-gray-200/60 dark:border-gray-700/40"
            }
          `}
          style={{ height: 64 }}
        >
          <div className="flex items-center justify-between h-full gap-6">
            {/* Logo */}
            <Logo />

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
              {/* Features with mega menu */}
              <div className="relative" ref={featuresRef}>
                <button
                  ref={featuresButtonRef}
                  onMouseEnter={() => setFeaturesOpen(true)}
                  onClick={() => setFeaturesOpen((v) => !v)}
                  className={`
                    flex items-center gap-1 px-3 py-2 rounded-xl text-[15px] font-medium transition-colors duration-150
                    ${featuresOpen ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40" : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/60 dark:hover:bg-gray-800/60"}
                  `}
                  aria-expanded={featuresOpen}
                  aria-haspopup="true"
                >
                  Features
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${featuresOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {featuresOpen && (
                  <div ref={featuresRef}>
                    <FeaturesMenu onClose={() => setFeaturesOpen(false)} />
                  </div>
                )}
              </div>

              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-2 rounded-xl text-[15px] font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/60 dark:hover:bg-gray-800/60 transition-colors duration-150"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right: CTA */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <Link
                href="/login"
                className="px-3 py-2 text-[15px] font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-150"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white transition-colors duration-150 shadow-sm shadow-blue-600/20"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100/60 dark:hover:bg-gray-800/60 transition-colors"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
