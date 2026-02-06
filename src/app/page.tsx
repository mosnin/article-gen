"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

function useCountUp(end: number, duration: number, suffix = "", prefix = "") {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();
          const step = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * end));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return {
    ref,
    display: `${prefix}${value.toLocaleString()}${suffix}`,
  };
}

function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  const articles = useCountUp(4000, 2000);
  const words = useCountUp(16, 2000, "M+");
  const prompts = useCountUp(4, 1200);
  const keywords = useCountUp(6, 1500);

  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      {/* Nav */}
      <nav
        className="fixed left-0 right-0 top-0 z-50 border-b backdrop-blur-xl"
        style={{
          background: "rgba(255,255,255,0.8)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Article Sauce"
              width={32}
              height={32}
              className="rounded"
            />
            <span className="text-lg font-bold tracking-tight">
              Article Sauce
            </span>
          </Link>
          <Link
            href="/app"
            className="rounded-full px-5 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ background: "var(--accent)" }}
          >
            Login
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-24 pt-32">
        <div className="mx-auto max-w-4xl text-center">
          <FadeIn>
            <div
              className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium"
              style={{
                borderColor: "var(--card-border)",
                color: "var(--muted)",
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--success)" }}
              />
              Powered by GPT-4.1
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h1
              className="mb-6 text-5xl font-bold leading-tight tracking-tight md:text-7xl"
              style={{ letterSpacing: "-0.03em" }}
            >
              SEO articles that
              <br />
              <span
                style={{
                  background:
                    "linear-gradient(135deg, #1d1d1f 0%, #86868b 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                write themselves.
              </span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p
              className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed md:text-xl"
              style={{ color: "var(--muted)" }}
            >
              Generate comprehensive, SEO-optimized articles with metadata,
              image prompts, JSON-LD schema, and everything you need to publish.
              One click. No templates. No filler.
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/app"
                className="rounded-full px-8 py-3.5 text-base font-semibold text-white transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  background: "var(--accent)",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                }}
              >
                Start Generating
              </Link>
              <a
                href="#how-it-works"
                className="rounded-full border px-8 py-3.5 text-base font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  borderColor: "var(--card-border)",
                  color: "var(--foreground)",
                }}
              >
                How It Works
              </a>
            </div>
          </FadeIn>
        </div>

        {/* Gradient orb */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.03]"
          style={{
            background:
              "radial-gradient(circle, #1d1d1f 0%, transparent 70%)",
          }}
        />
      </section>

      {/* Stats */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          <div
            className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border md:grid-cols-4"
            style={{ borderColor: "var(--card-border)" }}
          >
            {[
              {
                ...articles,
                label: "Words per article",
                sublabel: "Premium quality",
              },
              {
                ...words,
                label: "Words generated",
                sublabel: "And counting",
              },
              {
                ...prompts,
                label: "Image prompts",
                sublabel: "Per article",
              },
              {
                ...keywords,
                label: "SEO keywords",
                sublabel: "Per article",
              },
            ].map((stat, i) => (
              <div
                key={i}
                ref={stat.ref}
                className="p-6 text-center md:p-8"
                style={{ background: "var(--card)" }}
              >
                <div
                  className="mb-1 text-3xl font-bold tabular-nums tracking-tight md:text-4xl"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {stat.display}
                </div>
                <div
                  className="text-sm font-medium"
                  style={{ color: "var(--foreground)" }}
                >
                  {stat.label}
                </div>
                <div
                  className="text-xs"
                  style={{ color: "var(--muted)" }}
                >
                  {stat.sublabel}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <div className="mb-16 text-center">
              <h2
                className="mb-3 text-3xl font-bold tracking-tight md:text-4xl"
                style={{ letterSpacing: "-0.02em" }}
              >
                Three steps. One article.
              </h2>
              <p
                className="mx-auto max-w-xl text-lg"
                style={{ color: "var(--muted)" }}
              >
                Every article goes through a rigorous three-stage pipeline that
                mirrors how expert content teams work.
              </p>
            </div>
          </FadeIn>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Research & Context",
                description:
                  "AI analyzes your topic, gathers factual context, identifies key angles, and builds an article structure grounded in real information.",
                icon: (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                ),
              },
              {
                step: "02",
                title: "SEO Metadata",
                description:
                  "Generates an optimized title, meta description, URL slug from your focus keyword, and 5 high-intent supporting keywords.",
                icon: (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="4 7 4 4 20 4 20 7" />
                    <line x1="9" y1="20" x2="15" y2="20" />
                    <line x1="12" y1="4" x2="12" y2="20" />
                  </svg>
                ),
              },
              {
                step: "03",
                title: "Article + Assets",
                description:
                  "Writes the full article with E-E-A-T principles, generates 4 photorealistic image prompts, and creates JSON-LD schema for rich snippets.",
                icon: (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                ),
              },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 0.15}>
                <div
                  className="h-full rounded-2xl border p-8 transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--card-border)",
                  }}
                >
                  <div
                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{
                      background: "var(--background)",
                      color: "var(--foreground)",
                    }}
                  >
                    {item.icon}
                  </div>
                  <div
                    className="mb-2 text-xs font-bold uppercase tracking-widest"
                    style={{ color: "var(--muted)" }}
                  >
                    Step {item.step}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--muted)" }}
                  >
                    {item.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <div className="mb-16 text-center">
              <h2
                className="mb-3 text-3xl font-bold tracking-tight md:text-4xl"
                style={{ letterSpacing: "-0.02em" }}
              >
                Everything you need to publish.
              </h2>
              <p
                className="mx-auto max-w-xl text-lg"
                style={{ color: "var(--muted)" }}
              >
                Each article comes with every asset a content team would
                normally spend hours producing.
              </p>
            </div>
          </FadeIn>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                title: "Batch Generation",
                description:
                  "Generate up to 25 articles at once. Upload a JSON file or paste your article list, choose quality tier, and let it run.",
              },
              {
                title: "Photorealistic Image Prompts",
                description:
                  "4 cinematic photography prompts per article with SEO-optimized alt texts containing your exact focus keyword.",
              },
              {
                title: "JSON-LD Schema",
                description:
                  "Auto-generated Article + FAQPage structured data optimized for Google rich snippets, with your site and author details.",
              },
              {
                title: "E-E-A-T Optimized",
                description:
                  "Every article follows Google's Experience, Expertise, Authoritativeness, and Trustworthiness guidelines with real citations.",
              },
              {
                title: "Dashboard & Tracking",
                description:
                  "Track which articles are posted and which still need publishing. Mark articles as posted and manage your content pipeline.",
              },
              {
                title: "Markdown + Preview",
                description:
                  "Get raw markdown for WordPress, or use the preview tab to copy formatted text or HTML for any blog platform.",
              },
            ].map((feature, i) => (
              <FadeIn key={i} delay={(i % 2) * 0.1}>
                <div
                  className="h-full rounded-2xl border p-6"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--card-border)",
                  }}
                >
                  <h3 className="mb-2 text-base font-semibold">
                    {feature.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--muted)" }}
                  >
                    {feature.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Output showcase */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <div className="mb-12 text-center">
              <h2
                className="mb-3 text-3xl font-bold tracking-tight md:text-4xl"
                style={{ letterSpacing: "-0.02em" }}
              >
                What you get.
              </h2>
              <p
                className="mx-auto max-w-xl text-lg"
                style={{ color: "var(--muted)" }}
              >
                Every generated article includes all of this, ready to copy and
                publish.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div
              className="overflow-hidden rounded-2xl border"
              style={{
                background: "var(--card)",
                borderColor: "var(--card-border)",
              }}
            >
              <div className="grid gap-px md:grid-cols-3" style={{ background: "var(--card-border)" }}>
                {[
                  "SEO Title (50-60 chars)",
                  "Meta Description (150-160 chars)",
                  "URL Slug (from focus keyword)",
                  "Focus Keyword",
                  "5 Supporting Keywords",
                  "Full Article (2,000-4,000 words)",
                  "4 Image Prompts + Alt Texts",
                  "JSON-LD Schema (Article + FAQ)",
                  "Blog Preview + HTML Export",
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-5 py-4"
                    style={{ background: "var(--card)" }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--success)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="text-sm font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <div
              className="rounded-3xl p-12 text-center md:p-16"
              style={{
                background: "#1d1d1f",
              }}
            >
              <h2
                className="mb-4 text-3xl font-bold tracking-tight text-white md:text-4xl"
                style={{ letterSpacing: "-0.02em" }}
              >
                Ready to generate?
              </h2>
              <p
                className="mx-auto mb-8 max-w-md text-base"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                Start creating SEO-optimized articles in seconds. No setup
                required.
              </p>
              <Link
                href="/app"
                className="inline-block rounded-full bg-white px-8 py-3.5 text-base font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  color: "#1d1d1f",
                  boxShadow: "0 4px 14px rgba(255,255,255,0.15)",
                }}
              >
                Start Generating
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="border-t px-6 py-8"
        style={{ borderColor: "var(--card-border)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Article Sauce"
              width={20}
              height={20}
              className="rounded"
            />
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              Article Sauce
            </span>
          </div>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            AI-Powered SEO Content
          </span>
        </div>
      </footer>
    </div>
  );
}
