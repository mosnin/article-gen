"use client";

import { useState } from "react";

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: "Is there a free tier?",
    answer:
      "Yes. You get 3 free article credits when you sign up — no credit card required. After that, plans start at $29/month.",
  },
  {
    question: "How is ArticleGen different from ChatGPT or Jasper?",
    answer:
      "ArticleGen is purpose-built for SEO content: it integrates with Google Search Console, generates full articles with proper structure and keyword density, and publishes directly to your CMS. ChatGPT doesn't publish. Jasper doesn't optimize for search.",
  },
  {
    question: "Does it work with WordPress multisites and multiple blogs?",
    answer:
      "Yes. You can connect up to 3 WordPress blogs on Starter, unlimited on Growth and Pro. Each article can be published to a specific blog.",
  },
  {
    question: "Will Google penalize AI-generated content?",
    answer:
      "Not if it's high-quality and genuinely helpful. ArticleGen follows Google's E-E-A-T guidelines and generates content that reads like an expert wrote it. Our customers rank on Page 1 consistently.",
  },
  {
    question: "How does the Google Search Console integration work?",
    answer:
      "Connect your GSC account with one click. ArticleGen imports your top queries — keywords where you already have impressions but low CTR — and helps you create articles targeting those exact opportunities.",
  },
  {
    question: "Can I export my articles or cancel anytime?",
    answer:
      "Yes to both. Your articles are yours — export to markdown, HTML, or via API at any time. Cancel anytime from your billing settings, no questions asked.",
  },
  {
    question: "What platforms can I publish to?",
    answer:
      "WordPress, Shopify, Ghost, Medium, Dev.to, Notion, Webflow, and any custom endpoint via webhook. We add new platforms regularly.",
  },
  {
    question: "How does billing work?",
    answer:
      "Credit-based: each article generation costs 1 credit. Credits reset monthly with your plan. Unused credits don't roll over, but you can buy add-on packs. No surprise charges.",
  },
];

function PlusMinusIcon({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-400 text-xl leading-none select-none"
    >
      {open ? "−" : "+"}
    </span>
  );
}

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
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 py-5 text-left"
        aria-expanded={isOpen}
      >
        <span className="text-base font-semibold text-gray-900">
          {item.question}
        </span>
        <PlusMinusIcon open={isOpen} />
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <p className="pb-5 text-sm leading-relaxed text-gray-500">
          {item.answer}
        </p>
      </div>
    </div>
  );
}

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIndex((prev) => (prev === i ? null : i));
  };

  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Common questions
          </h2>
          <p className="mt-3 text-base text-gray-500">
            Everything you need to know about ArticleGen.
          </p>
        </div>

        <div className="border-t border-gray-200">
          {faqs.map((item, i) => (
            <FaqAccordionItem
              key={i}
              item={item}
              isOpen={openIndex === i}
              onToggle={() => toggle(i)}
            />
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-gray-500">
          Still have questions?{" "}
          <a
            href="#"
            className="font-semibold text-gray-900 hover:underline"
          >
            Talk to us →
          </a>
        </p>
      </div>
    </section>
  );
}
