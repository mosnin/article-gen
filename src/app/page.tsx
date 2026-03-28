import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { HeroSection } from "@/components/marketing/HeroSection";
import { LogoMarquee } from "@/components/marketing/LogoMarquee";
import { SocialProofCards } from "@/components/marketing/SocialProofCards";
import { ProblemSolutionSection } from "@/components/marketing/ProblemSolutionSection";
import { FeatureSections } from "@/components/marketing/FeatureSections";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { TestimonialMarquee } from "@/components/marketing/TestimonialMarquee";
import { FaqSection } from "@/components/marketing/FaqSection";
import { FinalCtaSection } from "@/components/marketing/FinalCtaSection";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 font-sans antialiased">
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>

      {/* Sticky pill header with mega menu */}
      <MarketingHeader />

      <main id="main-content">
        {/* Hero — what it does, for whom, why it matters */}
        <HeroSection />

        {/* Logo marquee — integrations trust strip */}
        <LogoMarquee />

        {/* Social proof cards — real customer outcomes */}
        <SocialProofCards />

        {/* Problem & solution — frame the pain, present the fix */}
        <ProblemSolutionSection />

        {/* Alternating feature sections with custom diagrams */}
        <FeatureSections />

        {/* Mid-page CTA banner */}
        <CtaBanner />

        {/* Animated dual-row testimonial marquee */}
        <TestimonialMarquee />

        {/* FAQ accordion — resolve objections */}
        <FaqSection />

        {/* Final CTA — closing conversion */}
        <FinalCtaSection />
      </main>

      {/* Pill-style footer */}
      <MarketingFooter />
    </div>
  );
}
