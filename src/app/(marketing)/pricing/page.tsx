import type { Metadata } from "next";
import Link from "next/link";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";

export const metadata: Metadata = {
  title: "Pricing – ArticleGen",
  description: "Simple, transparent pricing for content teams of all sizes.",
};

interface PricingTier {
  name: string;
  price: number;
  description: string;
  features: string[];
  isPopular?: boolean;
}

const tiers: PricingTier[] = [
  {
    name: "Starter",
    price: 29,
    description: "Perfect for solo bloggers and small sites getting started with AI content.",
    features: [
      "50 credits per month",
      "All publishing integrations",
      "SEO scoring",
      "Basic analytics",
    ],
  },
  {
    name: "Growth",
    price: 50,
    description: "For growing content teams that need volume, quality, and automation.",
    features: [
      "120 credits per month",
      "Autopilot content scheduling",
      "GSC integration",
      "Topic clustering",
      "Priority support",
    ],
    isPopular: true,
  },
  {
    name: "Pro",
    price: 99,
    description: "For agencies and power users publishing at scale.",
    features: [
      "300 credits per month",
      "Everything in Growth",
      "Agent & MCP API access",
      "Premium quality generation",
      "Dedicated support",
    ],
  },
];

const faqs = [
  {
    question: "Is there a free trial?",
    answer:
      "Yes — start with a 3-day trial for a one-time $1 verification fee. Cancel before the trial ends and you pay nothing more.",
  },
  {
    question: "Can I change plans?",
    answer: "Yes, upgrade or downgrade anytime. Billing is prorated automatically.",
  },
  {
    question: "What counts as one credit?",
    answer:
      "One credit is one standard article generation — typically 2,000 words with SEO metadata and schema. Premium (4,000-word) generations use 3 credits, and adding AI images uses 1 extra credit.",
  },
];

function Checkmark() {
  return (
    <svg
      className="w-4 h-4 text-[#2563EB] flex-shrink-0"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13.5 4.5L6.5 11.5L3 8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-12 bg-white text-center">
        <div className="max-w-[800px] mx-auto px-6">
          <BlurFade inView delay={0}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] mb-4">
              Pricing
            </p>
            <h1
              className="font-bold text-[#111827] mb-6"
              style={{ fontSize: "36px", lineHeight: "1.2" }}
            >
              Simple pricing that scales with you
            </h1>
            <p className="text-[18px] text-[#6B7280] max-w-[520px] mx-auto leading-[1.7]">
              Start free, upgrade when you need to. No hidden fees, no long-term contracts.
            </p>
          </BlurFade>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="py-8 pb-20 bg-white">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tiers.map((tier, i) => (
              <BlurFade key={tier.name} inView delay={0.1 + i * 0.07}>
                <MagicCard
                  gradientColor={tier.isPopular ? "#2563EB12" : "#3B82F610"}
                  className={`rounded-2xl h-full${tier.isPopular ? " border-2 border-[#2563EB]" : ""}`}
                >
                  <div className="p-8">
                    {tier.isPopular && (
                      <span className="bg-[#EFF6FF] text-[#2563EB] text-[11px] font-semibold px-3 py-1 rounded-full inline-block">
                        Most Popular
                      </span>
                    )}
                    <h3
                      className={`text-[20px] font-bold text-[#111827]${tier.isPopular ? " mt-2" : ""}`}
                    >
                      {tier.name}
                    </h3>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-[48px] font-bold text-[#111827] leading-none">
                        ${tier.price}
                      </span>
                      <span className="text-[16px] text-[#6B7280]">/mo</span>
                    </div>
                    <p className="text-[14px] text-[#6B7280] mt-2 mb-6">{tier.description}</p>
                    <Link
                      href="/trial"
                      className={
                        tier.isPopular
                          ? "block w-full text-center bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[15px] px-6 py-3 rounded-lg transition-colors"
                          : "block w-full text-center border border-[#E5E7EB] bg-white hover:bg-[#F8F9FA] text-[#111827] font-semibold text-[15px] px-6 py-3 rounded-lg transition-colors"
                      }
                    >
                      Start Your Trial
                    </Link>
                    <ul className="mt-6 space-y-3">
                      {tier.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-center gap-2 text-[14px] text-[#374151]"
                        >
                          <Checkmark />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </MagicCard>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-[#F8F9FA]">
        <div className="max-w-[720px] mx-auto px-6">
          <BlurFade inView delay={0}>
            <h2 className="text-[24px] font-bold text-[#111827] text-center mb-8">
              Pricing questions
            </h2>
          </BlurFade>
          <div>
            {faqs.map((faq, i) => (
              <BlurFade key={faq.question} inView delay={0.1 + i * 0.07}>
                <div className="border-b border-[#E5E7EB] py-5">
                  <p className="text-[15px] font-semibold text-[#111827]">{faq.question}</p>
                  <p className="text-[14px] text-[#6B7280] mt-1">{faq.answer}</p>
                </div>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[#F0F4FF] text-center">
        <div className="max-w-[600px] mx-auto px-6">
          <BlurFade inView delay={0}>
            <h2
              className="font-bold text-[#111827] mb-8"
              style={{ fontSize: "36px", lineHeight: "1.2" }}
            >
              Try ArticleGen for 3 days for $1
            </h2>
            <Link
              href="/trial"
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[15px] px-8 py-3 rounded-lg transition-colors inline-block"
            >
              Start Your Trial
            </Link>
          </BlurFade>
        </div>
      </section>
    </>
  );
}
