"use client";

import { useEffect, useRef, useState } from "react";

function useVisible(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, visible };
}

const painPoints = [
  {
    icon: "⏰",
    title: "Writing takes forever",
    description:
      "Writing one article takes 6-8 hours of research, drafting, editing, and optimizing — time your team doesn't have.",
  },
  {
    icon: "📉",
    title: "Generic AI gets penalized",
    description:
      "Generic AI content gets penalized by Google's helpful content update. Fluffy, unresearched articles hurt more than help.",
  },
  {
    icon: "🔄",
    title: "Manual publishing is brutal",
    description:
      "Publishing the same article to 5+ platforms manually eats your whole week and leaves room for formatting errors.",
  },
];

const workflowSteps = [
  {
    step: "1",
    title: "Research",
    lines: ["GSC keywords", "+ Competitors"],
    color: "blue",
  },
  {
    step: "2",
    title: "Generate",
    lines: ["AI article", "+ Images"],
    color: "violet",
  },
  {
    step: "3",
    title: "Publish",
    lines: ["8 platforms", "in one click"],
    color: "emerald",
  },
];

const stepColors: Record<string, { bg: string; border: string; text: string; num: string }> = {
  blue: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-300",
    num: "bg-blue-600 text-white",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-900/20",
    border: "border-violet-200 dark:border-violet-800",
    text: "text-violet-700 dark:text-violet-300",
    num: "bg-violet-600 text-white",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-300",
    num: "bg-emerald-600 text-white",
  },
};

export function ProblemSolutionSection() {
  const problemBlock = useVisible(0.1);
  const solutionBlock = useVisible(0.1);

  return (
    <>
      {/* ── PROBLEM BLOCK ── */}
      <section className="bg-gray-50 dark:bg-gray-900 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            ref={problemBlock.ref}
            className={`transition-all duration-700 ease-out ${
              problemBlock.visible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            {/* Overline */}
            <p className="text-xs font-semibold uppercase tracking-widest text-red-500 dark:text-red-400 mb-4">
              The Problem
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-12 max-w-2xl">
              Great content takes forever.{" "}
              <span className="text-red-500 dark:text-red-400">
                Bad content doesn&apos;t rank.
              </span>
            </h2>

            {/* Pain point cards */}
            <div className="grid sm:grid-cols-3 gap-6">
              {painPoints.map((point, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm"
                >
                  <div className="text-3xl mb-3">{point.icon}</div>
                  <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-2">
                    {point.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    {point.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SOLUTION BLOCK ── */}
      <section className="bg-white dark:bg-gray-800 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            ref={solutionBlock.ref}
            className={`transition-all duration-700 ease-out ${
              solutionBlock.visible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            {/* Overline */}
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-4">
              The Solution
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-4 max-w-2xl">
              ArticleGen does the research, writing, and publishing for you.
            </h2>

            {/* Workflow diagram */}
            <div className="mt-10 mb-8">
              <div className="flex flex-col sm:flex-row items-center gap-0 sm:gap-0">
                {workflowSteps.map((step, i) => {
                  const colors = stepColors[step.color];
                  return (
                    <div
                      key={step.step}
                      className="flex flex-col sm:flex-row items-center w-full sm:w-auto"
                    >
                      {/* Step box */}
                      <div
                        className={`flex-shrink-0 w-full sm:w-44 ${colors.bg} border ${colors.border} rounded-2xl px-5 py-5 text-center`}
                      >
                        <div
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold mb-2 ${colors.num}`}
                        >
                          {step.step}
                        </div>
                        <p
                          className={`text-base font-bold mb-1.5 ${colors.text}`}
                        >
                          {step.title}
                        </p>
                        {step.lines.map((line, j) => (
                          <p
                            key={j}
                            className="text-xs text-gray-500 dark:text-gray-400 leading-snug"
                          >
                            {line}
                          </p>
                        ))}
                      </div>

                      {/* Arrow connector (not after last step) */}
                      {i < workflowSteps.length - 1 && (
                        <div className="flex items-center justify-center sm:mx-2 my-2 sm:my-0">
                          {/* Horizontal arrow on sm+ */}
                          <span className="hidden sm:flex items-center text-gray-300 dark:text-gray-600">
                            <span className="w-8 h-px border-t-2 border-dashed border-gray-300 dark:border-gray-600 block" />
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 10 10"
                              fill="none"
                              className="text-gray-300 dark:text-gray-600 -ml-px"
                            >
                              <path
                                d="M0 5H8M8 5L4 1M8 5L4 9"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                          {/* Vertical arrow on mobile */}
                          <span className="sm:hidden flex flex-col items-center text-gray-300 dark:text-gray-600">
                            <span className="h-6 w-px border-l-2 border-dashed border-gray-300 dark:border-gray-600 block" />
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 10 10"
                              fill="none"
                              className="text-gray-300 dark:text-gray-600 -mt-px rotate-90"
                            >
                              <path
                                d="M0 5H8M8 5L4 1M8 5L4 9"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <p className="text-base text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl mb-6">
              In 20 minutes: enter a topic, review the outline, generate the full
              article, and publish to WordPress, Shopify, Ghost, Medium, and more
              — simultaneously.
            </p>

            {/* CTA ghost link */}
            <a
              href="#"
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold text-sm hover:underline group"
            >
              See how it works
              <span className="group-hover:translate-x-1 transition-transform">
                →
              </span>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
