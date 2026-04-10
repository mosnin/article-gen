"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { text: "5 Free Tools per month created on auto-pilot" },
  { text: "20,000 free LLM requests per month" },
  { text: "Unlimited AI Rebuilds" },
  { text: "Keyword Research made for you on auto-pilot" },
  { text: "Auto-generated sitemap for better SEO indexing" },
  { text: "Brand integration with your colors and logo" },
  { text: "Target low-competition keywords with high conversion intent" },
  { text: "Automatically hosted on Your Domain" },
  { text: "Home Page with all your tools beautifully organized" },
  { text: "Tools use AI under the hood to generate content and provide smart results" },
];

export default function FreeToolsPage() {
  const router = useRouter();

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">
          <span className="text-[var(--accent)]">SEO Tools</span> on Auto-Pilot
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Get traffic with automatic SEO-optimized tools
        </p>
      </div>

      {/* Pricing card */}
      <div className="mx-auto max-w-3xl rounded-2xl border-2 border-[var(--accent)] bg-gradient-to-br from-[var(--accent-light)]/30 to-[var(--accent-light)]/60 bg-[var(--surface-base)] p-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left: Pricing */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Free Tools Builder</h2>
              <span className="rounded-full bg-[var(--accent-light)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent)]">
                SEO Power
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-[var(--text-primary)]">$199</span>
              <div>
                <span className="text-base text-[var(--text-tertiary)] line-through">$800</span>
                <span className="ml-1 text-sm text-[var(--text-secondary)]">/monthly</span>
              </div>
            </div>

            <Button
              className="w-full rounded-full py-3 text-base font-semibold"
              onClick={() => router.push("/app/billing")}
            >
              Get Started Now →
            </Button>

            <div className="space-y-1 text-center text-xs text-[var(--text-tertiary)]">
              <p className="line-through">$99/month – 10 spots – sold out</p>
              <p className="font-medium text-[var(--text-secondary)]">$199/month - 20 spots</p>
              <p>$499/month - 100 spots</p>
              <p className="mt-2 font-medium text-[var(--text-primary)]">Cancel anytime. No questions asked!</p>
            </div>
          </div>

          {/* Right: Features */}
          <div>
            <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">What's included:</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {FEATURES.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs leading-tight text-[var(--text-secondary)]">{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* See It In Action */}
      <div className="text-center">
        <p className="mb-4 text-sm font-semibold text-[var(--text-secondary)]">See It In Action</p>
        <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-[var(--border-default)] bg-black">
          <div className="flex aspect-video items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-8 w-8 text-white">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm text-white/60">Demo video coming soon</p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="mx-auto max-w-2xl space-y-3">
        <h3 className="text-center text-base font-semibold text-[var(--text-primary)]">Frequently Asked Questions</h3>
        {[
          { q: "What are SEO free tools?", a: "Free tools are AI-powered utilities on your domain (e.g. calculators, generators, checkers) that attract organic traffic through high-intent, low-competition keywords." },
          { q: "How does the auto-pilot work?", a: "Our AI finds relevant keyword opportunities in your niche, builds and deploys SEO-optimized tools to your domain automatically, and keeps them updated." },
          { q: "Do I need to host the tools myself?", a: "No — tools are automatically hosted on a subdomain of your domain. We handle all infrastructure." },
        ].map((faq, i) => (
          <details key={i} className="group bg-[var(--surface-base)] border border-[var(--border-default)] rounded-xl">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-medium text-[var(--text-primary)]">
              {faq.q}
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform group-open:rotate-180">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </summary>
            <div className="border-t border-[var(--border-default)] px-5 py-3 text-sm text-[var(--text-secondary)]">
              {faq.a}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
