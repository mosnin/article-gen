"use client";

import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { BlurFade } from "@/components/ui/blur-fade";
import { StarButtonInner } from "@/components/ui/star-button";
import Link from "next/link";

export function CtaBanner() {
  return (
    <section
      style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" }}
      className="bg-[#F0F4FF] py-16 w-full"
    >
      <div className="max-w-[800px] mx-auto px-6 text-center">
        <BlurFade inView>
          {/* Badge */}
          <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 mb-6">
            <AnimatedShinyText className="text-[12px] font-semibold text-blue-600">
              ✦ Join 2,400+ content teams
            </AnimatedShinyText>
          </div>

          {/* Headline */}
          <h2 className="text-[28px] lg:text-[36px] font-bold text-[#111827] leading-[1.2]">
            Start publishing better content today
          </h2>

          {/* Subheadline */}
          <p className="text-[18px] text-[#6B7280] mt-3">
            Generate SEO-optimized articles and publish to all your platforms automatically.
          </p>

          {/* CTA */}
          <div className="flex justify-center mt-8">
            <Link href="/trial" className="inline-flex">
              <StarButtonInner
                lightColor="#ffffff"
                backgroundColor="#000000"
                borderWidth={1}
                className="h-[52px] px-8 text-base font-semibold"
              >
                Start Your Trial
              </StarButtonInner>
            </Link>
          </div>

          {/* Trust line */}
          <p className="mt-3 text-[14px] text-[#9CA3AF]">No credit card required</p>
        </BlurFade>
      </div>
    </section>
  );
}
