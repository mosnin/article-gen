"use client";

export function FinalCtaSection() {
  return (
    <section
      style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" }}
      className="bg-[#FFFFFF] py-20 lg:py-24"
    >
      <div className="max-w-[600px] mx-auto px-6 flex flex-col items-center">
        <h2 className="text-[28px] lg:text-[36px] font-bold text-[#111827] leading-[1.2] text-center">
          Ready to grow your content?
        </h2>

        <p className="text-[20px] text-[#6B7280] mt-3 text-center leading-[1.5]">
          Start your free trial today. No credit card required.
        </p>

        <a
          href="#"
          className="mt-8 inline-flex items-center justify-center h-[52px] px-8 text-base font-semibold rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors"
        >
          Start Free Trial
        </a>

        <a
          href="#"
          className="mt-3 text-[15px] font-medium text-[#6B7280] hover:text-[#111827] transition-colors"
        >
          Talk to sales &rarr;
        </a>
      </div>
    </section>
  );
}
