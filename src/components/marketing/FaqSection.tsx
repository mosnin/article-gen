"use client";

import { useState } from "react";
import { BlurFade } from "@/components/ui/blur-fade";

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: "How does the free trial work?",
    answer:
      "Start your 14-day free trial with full access — no credit card required. After the trial, choose the plan that fits your team.",
  },
  {
    question: "What platforms can I publish to?",
    answer:
      "ArticleGen connects to WordPress, Shopify, Ghost, Medium, Dev.to, Notion, Webflow, and HubSpot. More integrations are added regularly.",
  },
  {
    question: "How is ArticleGen different from ChatGPT?",
    answer:
      "ArticleGen is purpose-built for SEO content. It researches keywords, structures articles for search engines, scores content against SEO benchmarks, and publishes directly to your platforms — ChatGPT does none of this.",
  },
  {
    question: "Will Google penalize AI-generated content?",
    answer:
      "Google rewards helpful, accurate content regardless of how it was produced. ArticleGen generates factual, well-structured articles with proper citations, headings, and keyword integration that aligns with Google's helpful content guidelines.",
  },
  {
    question: "Can I edit articles before publishing?",
    answer:
      "Yes. Every article goes through a review step before publishing. You can edit, rewrite sections, or adjust the outline at any point in the workflow.",
  },
  {
    question: "Do you offer agency or team plans?",
    answer:
      "Yes. Our Agency plan supports multiple clients with separate workspaces, custom branding, and white-label reporting. Contact us for volume pricing.",
  },
  {
    question: "How do I connect Google Search Console?",
    answer:
      "Go to Settings > Integrations and click Connect GSC. We use OAuth — no API keys needed. Once connected, keyword data flows directly into your generation workflow.",
  },
];

function FaqAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-[#E5E7EB]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-4 py-4 text-left cursor-pointer bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-1 rounded-sm"
      >
        <span className="text-[16px] font-medium text-[#111827] leading-[1.5]">
          {item.question}
        </span>
        <span
          aria-hidden="true"
          className="flex-shrink-0 text-[#9CA3AF] text-[20px] leading-none select-none w-5 text-center"
        >
          {isOpen ? "\u2212" : "+"}
        </span>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <p className="text-[16px] text-[#6B7280] leading-[1.6] pb-4 pr-9">
          {item.answer}
        </p>
      </div>
    </div>
  );
}

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (i: number) => {
    setOpenIndex((prev) => (prev === i ? null : i));
  };

  return (
    <section
      style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" }}
      className="bg-[#FFFFFF] py-16 lg:py-20"
    >
      <div className="max-w-[720px] mx-auto px-6">
        <BlurFade inView delay={0.1}>
          <h2 className="text-center text-[28px] lg:text-[36px] font-bold text-[#111827] leading-[1.2] mb-12">
            Frequently asked questions
          </h2>
        </BlurFade>

        <BlurFade inView delay={0.2}>
          <div>
            {faqs.map((item, i) => (
              <FaqAccordionItem
                key={i}
                item={item}
                isOpen={openIndex === i}
                onToggle={() => toggle(i)}
              />
            ))}
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
