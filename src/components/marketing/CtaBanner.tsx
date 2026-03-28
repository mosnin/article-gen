"use client";

import { useEffect, useRef, useState } from "react";

export function CtaBanner() {
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
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className={`w-full bg-[#0a0a0a] py-20 px-4 transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-gray-400 mb-5">
          Get Started Free
        </p>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight mb-5">
          Start publishing better content today
        </h2>

        <p className="text-base text-gray-400 mb-10 max-w-md mx-auto">
          Join 2,400+ content teams. First 3 articles free. No credit card required.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="#"
            className="inline-flex items-center justify-center h-11 px-7 rounded-md bg-white text-black font-medium text-sm hover:bg-gray-100 transition-colors"
          >
            Start Free Trial
          </a>
          <a
            href="#"
            className="inline-flex items-center justify-center h-11 px-7 rounded-md border border-gray-600 text-gray-300 font-medium text-sm hover:border-gray-400 hover:text-white transition-colors"
          >
            View pricing
          </a>
        </div>
      </div>
    </section>
  );
}
