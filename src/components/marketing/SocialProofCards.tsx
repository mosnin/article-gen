"use client";

import { useEffect, useRef, useState } from "react";

const cards = [
  {
    stat: "3x",
    statColor: "text-blue-600 dark:text-blue-400",
    result: "more organic traffic in 90 days",
    story:
      "A SaaS startup published 2 cluster articles/week and tripled organic traffic in 90 days using ArticleGen's topic clustering.",
    initials: "SC",
    avatarBg: "bg-blue-500",
    name: "Sarah Chen",
    role: "Head of Content, Lateral Inc.",
  },
  {
    stat: "47%",
    statColor: "text-emerald-600 dark:text-emerald-400",
    result: "lower content acquisition cost",
    story:
      "By replacing freelance writers with ArticleGen, they cut content costs dramatically while publishing 5x more articles per month.",
    initials: "MW",
    avatarBg: "bg-emerald-500",
    name: "Marcus Webb",
    role: "Marketing Dir., Stackify",
  },
  {
    stat: "20min",
    statColor: "text-violet-600 dark:text-violet-400",
    result: "from topic to published article",
    story:
      "What used to take a full day of research and writing now takes a coffee break — with better SEO scores than their old process.",
    initials: "PN",
    avatarBg: "bg-violet-500",
    name: "Priya Nair",
    role: "SEO Lead, Vesper",
  },
];

function Card({
  card,
  delay,
}: {
  card: (typeof cards)[number];
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col gap-4 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      } transition-all duration-600 ease-out`}
    >
      {/* Stat */}
      <div>
        <p className={`text-5xl font-extrabold tracking-tight ${card.statColor}`}>
          {card.stat}
        </p>
        <p className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-300">
          {card.result}
        </p>
      </div>

      {/* Story */}
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed flex-1">
        {card.story}
      </p>

      {/* Persona footer */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
        <div
          className={`w-9 h-9 rounded-full ${card.avatarBg} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
        >
          {card.initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {card.name}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{card.role}</p>
        </div>
      </div>
    </div>
  );
}

export function SocialProofCards() {
  const headingRef = useRef<HTMLDivElement>(null);
  const [headingVisible, setHeadingVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHeadingVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (headingRef.current) observer.observe(headingRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="bg-gray-50 dark:bg-gray-900 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <div
          ref={headingRef}
          className={`text-center mb-14 transition-all duration-700 ease-out ${
            headingVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-3">
            Real results from content teams
          </h2>
          <p className="text-base text-gray-500 dark:text-gray-400">
            See what teams are publishing with ArticleGen
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card, i) => (
            <Card key={card.name} card={card} delay={i * 150} />
          ))}
        </div>
      </div>
    </section>
  );
}
