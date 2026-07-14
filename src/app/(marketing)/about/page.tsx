import type { Metadata } from "next";
import Link from "next/link";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";

export const metadata: Metadata = {
  title: "About – ArticleGen",
  description:
    "ArticleGen started because great content was taking too long. We built the tool we wished existed.",
};

const values = [
  {
    number: "01",
    heading: "Quality over volume",
    body: "One great article beats ten mediocre ones. We built ArticleGen to produce content that actually helps readers, not content that games algorithms.",
  },
  {
    number: "02",
    heading: "Speed without compromise",
    body: "20 minutes per article shouldn't mean lower quality. We invested heavily in the research and structure layer so the output meets the bar.",
  },
  {
    number: "03",
    heading: "You stay in control",
    body: "AI does the heavy lifting but you make the calls. Every article goes through your review before it goes anywhere.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-white text-center">
        <div className="max-w-[800px] mx-auto px-6">
          <BlurFade inView delay={0}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] mb-4">
              About ArticleGen
            </p>
            <h1
              className="font-bold text-[#111827] mb-6"
              style={{ fontSize: "36px", lineHeight: "1.2" }}
            >
              We&apos;re building the future of content creation
            </h1>
            <p className="text-[18px] text-[#6B7280] max-w-[560px] mx-auto leading-[1.7]">
              ArticleGen started because great content was taking too long. We built the tool we
              wished existed.
            </p>
          </BlurFade>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 bg-[#F8F9FA]">
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <BlurFade inView delay={0}>
            <h2 className="text-[28px] font-bold text-[#111827] mb-6">Our mission</h2>
            <p className="text-[17px] text-[#374151] leading-[1.8] max-w-[640px] mx-auto">
              Content marketing works — but the process is broken. Writing one article takes 6+
              hours of research, drafting, and editing. Publishing to multiple platforms means hours
              more of reformatting. And most AI tools produce generic, penalty-prone content that
              hurts more than helps.
              <br />
              <br />
              We built ArticleGen to change that. Not another generic AI writer, but a full content
              workflow: research, write, score, and publish — with the quality to rank and the speed
              to scale.
            </p>
          </BlurFade>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-white">
        <div className="max-w-[1100px] mx-auto px-6">
          <BlurFade inView delay={0}>
            <h2 className="text-[28px] font-bold text-[#111827] text-center mb-10">
              What we believe
            </h2>
          </BlurFade>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {values.map((value, i) => (
              <BlurFade key={value.number} inView delay={0.1 + i * 0.07}>
                <MagicCard gradientColor="#3B82F610" className="rounded-2xl h-full">
                  <div className="p-8">
                    <p className="text-[48px] font-bold text-[#E5E7EB] mb-4 leading-none">
                      {value.number}
                    </p>
                    <h3 className="text-[18px] font-bold text-[#111827] mb-3">{value.heading}</h3>
                    <p className="text-[15px] text-[#6B7280] leading-[1.6]">{value.body}</p>
                  </div>
                </MagicCard>
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
