"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { HeroSection } from "@/components/ui/hero-4";
import FeatureSection from "@/components/ui/feature-section";
import { createClient } from "@/lib/supabase-browser";

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

export default function LandingPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="flex items-center gap-3">
          <svg className="progress-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
          <span className="text-sm" style={{ color: "var(--muted)" }}>Loading...</span>
        </div>
      </div>
    }>
      <LandingPage />
    </Suspense>
  );
}

function LandingPage() {
  const avatarData = [
    {
      src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80",
      alt: "User 1",
      fallback: "U1",
    },
    {
      src: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80",
      alt: "User 2",
      fallback: "U2",
    },
    {
      src: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&q=80",
      alt: "User 3",
      fallback: "U3",
    },
  ];

  const articles = useCountUp(4000, 2000);
  const words = useCountUp(16, 2000, "M+");
  const prompts = useCountUp(4, 1200);
  const keywords = useCountUp(6, 1500);

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [authModal, setAuthModal] = useState<"login" | "signup" | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.replace("/app");
        return;
      }
      setCheckingAuth(false);
      const authParam = searchParams.get("auth");
      if (authParam === "login") setAuthModal("login");
    };
    checkUser();
  }, [router, searchParams, supabase.auth]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");

    if (authModal === "signup") {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setAuthError(error.message);
      } else {
        router.push("/app");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) {
        setAuthError(error.message);
      } else {
        router.push("/app");
      }
    }
    setAuthLoading(false);
  };

  const handleOAuth = async (provider: "google" | "github") => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const openAuth = (mode: "login" | "signup") => {
    setAuthModal(mode);
    setAuthEmail("");
    setAuthPassword("");
    setAuthError("");
    setAuthMessage("");
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="flex items-center gap-3">
          <svg className="progress-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
          <span className="text-sm" style={{ color: "var(--muted)" }}>Loading...</span>
        </div>
      </div>
    );
  }

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
          <div className="flex items-center gap-6">
            <a
              href="#how-it-works"
              className="text-sm font-medium transition-colors"
              style={{ color: "var(--muted)" }}
            >
              How it Works
            </a>
            <a
              href="#pricing"
              className="text-sm font-medium transition-colors"
              style={{ color: "var(--muted)" }}
            >
              Pricing
            </a>
            <button
              onClick={() => openAuth("login")}
              className="rounded-full px-5 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ background: "var(--accent)" }}
            >
              Login
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <HeroSection
          title={<>SEO articles that</>}
          animatedTexts={["write themselves.", "rank and convert.", "ship in one click."]}
          subtitle="Generate comprehensive, SEO-optimized articles with metadata, image prompts, JSON-LD schema, and everything you need to publish. One click. No templates. No filler."
          infoBadgeText="Powered by GPT-4.1"
          ctaButtonText="Start Generating"
          socialProofText="Trusted by 100,000+ marketers and founders"
          avatars={avatarData}
          ctaButtonProps={{ onClick: () => openAuth("signup") }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.03]"
          style={{
            background:
              "radial-gradient(circle, #1d1d1f 0%, transparent 70%)",
          }}
        />
      </div>


      <FeatureSection />

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

      {/* Pricing */}
      <section id="pricing" className="px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <div className="mb-4 text-center">
              <span
                className="inline-block rounded-full px-3 py-1 text-xs font-medium tracking-wide"
                style={{
                  background: "var(--card)",
                  color: "var(--muted)",
                  border: "1px solid var(--card-border)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Pricing
              </span>
            </div>
            <h2
              className="mb-3 text-center text-3xl font-bold tracking-tight md:text-4xl"
              style={{ letterSpacing: "-0.02em" }}
            >
              Simple, transparent pricing
            </h2>
            <p
              className="mx-auto mb-12 max-w-lg text-center text-base"
              style={{ color: "var(--muted)" }}
            >
              Start free and scale as you grow. Every credit generates one full SEO article.
            </p>
          </FadeIn>
          <div className="grid gap-5 md:grid-cols-4">
            {[
              {
                name: "Free",
                price: "$0",
                period: "",
                credits: "10",
                features: ["10 articles/month", "Standard & premium quality", "Image prompts", "JSON-LD schema", "Email support"],
                cta: "Get Started",
                featured: false,
              },
              {
                name: "Starter",
                price: "$29",
                period: "/mo",
                credits: "50",
                features: ["50 articles/month", "Standard & premium quality", "Topic clusters", "Batch generation", "Priority support"],
                cta: "Subscribe",
                featured: false,
              },
              {
                name: "Growth",
                price: "$50",
                period: "/mo",
                credits: "120",
                features: ["120 articles/month", "Standard & premium quality", "Topic clusters", "Batch generation", "Priority support"],
                cta: "Subscribe",
                featured: true,
              },
              {
                name: "Pro",
                price: "$99",
                period: "/mo",
                credits: "300",
                features: ["300 articles/month", "Standard & premium quality", "Topic clusters", "Batch generation", "Dedicated support"],
                cta: "Subscribe",
                featured: false,
              },
            ].map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 0.08}>
                <div
                  className="relative flex h-full flex-col rounded-2xl p-6"
                  style={{
                    background: plan.featured ? "#1d1d1f" : "var(--card)",
                    border: plan.featured ? "none" : "1px solid var(--card-border)",
                    color: plan.featured ? "#fff" : "var(--foreground)",
                  }}
                >
                  {plan.featured && (
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold"
                      style={{ background: "var(--success)", color: "#fff" }}
                    >
                      Most Popular
                    </div>
                  )}
                  <div className="mb-1 text-sm font-semibold" style={{ color: plan.featured ? "rgba(255,255,255,0.7)" : "var(--muted)" }}>
                    {plan.name}
                  </div>
                  <div className="mb-1 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold">{plan.price}</span>
                    {plan.period && (
                      <span className="text-sm font-medium" style={{ color: plan.featured ? "rgba(255,255,255,0.5)" : "var(--muted)" }}>
                        {plan.period}
                      </span>
                    )}
                  </div>
                  <div
                    className="mb-5 text-sm"
                    style={{ color: plan.featured ? "rgba(255,255,255,0.5)" : "var(--muted)" }}
                  >
                    {plan.credits} credits/month
                  </div>
                  <ul className="mb-6 flex flex-1 flex-col gap-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={plan.featured ? "#34c759" : "var(--success)"} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                        <span style={{ color: plan.featured ? "rgba(255,255,255,0.8)" : "var(--foreground)" }}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => openAuth("signup")}
                    className="w-full rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: plan.featured ? "#fff" : "var(--accent)",
                      color: plan.featured ? "#1d1d1f" : "#fff",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {plan.cta}
                  </button>
                </div>
              </FadeIn>
            ))}
          </div>
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
              <button
                onClick={() => openAuth("signup")}
                className="inline-block rounded-full bg-white px-8 py-3.5 text-base font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  color: "#1d1d1f",
                  boxShadow: "0 4px 14px rgba(255,255,255,0.15)",
                }}
              >
                Start Generating
              </button>
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

      {/* Auth Modal */}
      {authModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setAuthModal(null); }}
        >
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)" }} />
          <div
            className="relative mx-4 w-full max-w-sm rounded-2xl border shadow-2xl"
            style={{ background: "var(--background)", borderColor: "var(--card-border)", animation: "modal-enter 0.25s cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            <div className="px-6 pt-6 pb-2 text-center">
              <Image src="/logo.png" alt="Article Sauce" width={40} height={40} className="mx-auto mb-3 rounded-lg" />
              <h3 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                {authModal === "login" ? "Welcome back" : "Create your account"}
              </h3>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                {authModal === "login" ? "Sign in to your account" : "Start generating SEO articles"}
              </p>
            </div>

            <div className="px-6 py-4">
              {/* OAuth buttons */}
              <div className="mb-4 flex gap-3">
                <button
                  onClick={() => handleOAuth("google")}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors"
                  style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--card)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Google
                </button>
                <button
                  onClick={() => handleOAuth("github")}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors"
                  style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--card)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                  GitHub
                </button>
              </div>

              <div className="mb-4 flex items-center gap-3">
                <div className="flex-1 border-t" style={{ borderColor: "var(--card-border)" }} />
                <span className="text-xs" style={{ color: "var(--muted)" }}>or</span>
                <div className="flex-1 border-t" style={{ borderColor: "var(--card-border)" }} />
              </div>

              <form onSubmit={handleAuth} className="space-y-3">
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  className="w-full rounded-xl border px-4 py-3 text-sm transition-colors focus:outline-none"
                  style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
                  onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--accent)"; }}
                  onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--card-border)"; }}
                />
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Password"
                  required
                  minLength={6}
                  className="w-full rounded-xl border px-4 py-3 text-sm transition-colors focus:outline-none"
                  style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
                  onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--accent)"; }}
                  onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--card-border)"; }}
                />

                {authError && (
                  <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.1)", color: "var(--error)" }}>
                    {authError}
                  </p>
                )}
                {authMessage && (
                  <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(52,199,89,0.1)", color: "var(--success)" }}>
                    {authMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50"
                  style={{ background: "var(--accent)" }}
                >
                  {authLoading ? (
                    <>
                      <svg className="progress-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                      {authModal === "login" ? "Signing in..." : "Creating account..."}
                    </>
                  ) : (
                    authModal === "login" ? "Sign In" : "Create Account"
                  )}
                </button>
              </form>
            </div>

            <div className="border-t px-6 py-4 text-center" style={{ borderColor: "var(--card-border)" }}>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {authModal === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  onClick={() => openAuth(authModal === "login" ? "signup" : "login")}
                  className="font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  {authModal === "login" ? "Sign up" : "Sign in"}
                </button>
              </p>
            </div>

            <button
              onClick={() => setAuthModal(null)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
              style={{ color: "var(--muted)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--card)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
