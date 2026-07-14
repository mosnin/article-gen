import type { Metadata } from "next";
import Link from "next/link";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";

export const metadata: Metadata = {
  title: "Content Automation – ArticleGen",
  description:
    "ArticleGen generates a 30-day content plan the moment you finish onboarding — you just approve and publish. Full content pipeline on autopilot.",
};

const steps = [
  {
    number: "01",
    title: "Onboard",
    description:
      "Tell ArticleGen your niche, audience, and competitors. We generate a 30-day plan of unique, keyword-targeted articles instantly.",
  },
  {
    number: "02",
    title: "Approve",
    description:
      "Review each article slot — topic, keyword, content type. Edit anything, reject what doesn't fit, approve what does.",
  },
  {
    number: "03",
    title: "Publish on schedule",
    description:
      "Approved slots are generated and published automatically on their scheduled date. Your blog stays active even when you're not.",
  },
];

const callouts = [
  {
    title: "30-Day Content Plan",
    description:
      "Auto-generated from your niche at signup. 30 unique article ideas, keyword-mapped and ready to approve.",
  },
  {
    title: "Autopilot Mode",
    description:
      "Enable Autopilot and ArticleGen generates and publishes approved articles without you lifting a finger.",
  },
  {
    title: "Full Control",
    description:
      "Edit any slot, change the topic, swap the keyword. You're always in control of what goes out.",
  },
];

export default function AutomationPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-white text-center">
        <div className="max-w-[720px] mx-auto px-6">
          <BlurFade inView delay={0.1}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] mb-3">
              Content Automation
            </p>
            <h1 className="text-[32px] md:text-[44px] font-bold text-[#111827] leading-[1.15]">
              Your content pipeline on autopilot
            </h1>
            <p className="text-[20px] text-[#6B7280] mt-3 max-w-[560px] mx-auto">
              ArticleGen generates a 30-day content plan the moment you finish
              onboarding — you just approve and publish.
            </p>
          </BlurFade>
        </div>
      </section>

      {/* How it works — vertical timeline */}
      <section className="py-16 bg-[#F8F9FA]">
        <div className="max-w-[720px] mx-auto px-6">
          <BlurFade inView delay={0.1}>
            <h2 className="text-[28px] font-bold text-[#111827] mb-10 text-center">
              How it works
            </h2>
          </BlurFade>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-[#E5E7EB]" />

            <div className="space-y-0">
              {steps.map((step, i) => (
                <BlurFade key={step.number} inView delay={0.15 + i * 0.08}>
                  <div className="relative flex gap-6 pb-10 last:pb-0">
                    {/* Step circle */}
                    <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-[#EFF6FF] border-2 border-[#BFDBFE] flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                      <span className="text-[12px] font-bold text-[#2563EB]">
                        {step.number}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="pt-1.5">
                      <h3 className="text-[18px] font-semibold text-[#111827] mb-1.5">
                        {step.title}
                      </h3>
                      <p className="text-[15px] text-[#6B7280] leading-[1.6]">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </BlurFade>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Key feature callouts */}
      <section className="py-16 bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <BlurFade inView delay={0.1}>
            <h2 className="text-[28px] font-bold text-[#111827] text-center mb-10">
              Built for hands-off publishing
            </h2>
          </BlurFade>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {callouts.map((callout, i) => (
              <BlurFade key={callout.title} inView delay={0.1 + i * 0.06}>
                <MagicCard gradientColor="#3B82F615" className="rounded-xl h-full">
                  <div className="p-7">
                    {/* Icon dot */}
                    <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center mb-5">
                      <svg
                        className="w-5 h-5 text-[#3B82F6]"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <h3 className="text-[18px] font-bold text-[#111827] mb-3">
                      {callout.title}
                    </h3>
                    <p className="text-[15px] text-[#6B7280] leading-[1.6]">
                      {callout.description}
                    </p>
                  </div>
                </MagicCard>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[#F0F4FF] text-center">
        <div className="max-w-[720px] mx-auto px-6">
          <BlurFade inView delay={0.1}>
            <h2 className="text-[28px] font-bold text-[#111827]">
              Ready to start?
            </h2>
            <p className="text-[18px] text-[#6B7280] mt-2">
              Start your 3-day trial for $1 today.
            </p>
            <Link
              href="/trial"
              className="h-[52px] px-8 text-base font-semibold rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white mt-6 inline-flex items-center transition-colors"
            >
              Start your trial
            </Link>
          </BlurFade>
        </div>
      </section>
    </>
  );
}
