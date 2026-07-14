import type { Metadata } from "next";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";

export const metadata: Metadata = {
  title: "Blog – ArticleGen",
  description:
    "Content marketing tips, SEO strategies, and product updates from the ArticleGen team.",
};

interface PlannedPost {
  category: string;
  title: string;
  excerpt: string;
  gradientFrom: string;
  gradientTo: string;
}

// Topics in the writing pipeline — rendered as previews until the posts ship.
const plannedPosts: PlannedPost[] = [
  {
    category: "SEO Strategy",
    title: "How to Build Topical Authority with AI-Generated Content",
    excerpt:
      "How content clusters and AI generation work together to build topical authority for your blog.",
    gradientFrom: "#2563EB",
    gradientTo: "#7C3AED",
  },
  {
    category: "Product Update",
    title: "Introducing Autopilot: Your 30-Day Content Plan, Automated",
    excerpt:
      "ArticleGen generates a complete 30-day content calendar at signup, pre-mapped to your niche and ready to approve.",
    gradientFrom: "#059669",
    gradientTo: "#0284C7",
  },
  {
    category: "Tutorial",
    title: "How to Connect WordPress to ArticleGen in 5 Minutes",
    excerpt:
      "A step-by-step walkthrough of the WordPress REST API integration, from generating your app password to publishing your first article.",
    gradientFrom: "#7C3AED",
    gradientTo: "#2563EB",
  },
  {
    category: "SEO Strategy",
    title: "Internal Linking at Scale: How AI Can Build Your Link Architecture",
    excerpt:
      "Internal links are a ranking signal most bloggers ignore. ArticleGen's linking config makes them automatic.",
    gradientFrom: "#0284C7",
    gradientTo: "#059669",
  },
];

export default function BlogPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-white text-center">
        <div className="max-w-[800px] mx-auto px-6">
          <BlurFade inView delay={0}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] mb-4">
              Blog
            </p>
            <h1
              className="font-bold text-[#111827] mb-6"
              style={{ fontSize: "36px", lineHeight: "1.2" }}
            >
              Content marketing insights
            </h1>
            <p className="text-[18px] text-[#6B7280] max-w-[560px] mx-auto leading-[1.7]">
              SEO strategies, AI writing tips, and platform updates from the ArticleGen team.
              First posts are on the way.
            </p>
          </BlurFade>
        </div>
      </section>

      {/* Planned posts grid */}
      <section className="py-16 bg-[#F8F9FA]">
        <div className="max-w-[1200px] mx-auto px-6">
          <BlurFade inView delay={0}>
            <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] text-center mb-8">
              What we&apos;re writing
            </p>
          </BlurFade>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[900px] mx-auto">
            {plannedPosts.map((post, i) => (
              <BlurFade key={post.title} inView delay={0.1 + i * 0.07}>
                <MagicCard gradientColor="#3B82F610" className="rounded-xl overflow-hidden h-full">
                  <div
                    className="w-full h-2"
                    style={{
                      background: `linear-gradient(to right, ${post.gradientFrom}, ${post.gradientTo})`,
                    }}
                  />
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#3B82F6]">
                        {post.category}
                      </p>
                      <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-semibold text-[#2563EB]">
                        Coming soon
                      </span>
                    </div>
                    <h2 className="text-[17px] font-bold text-[#111827] leading-snug mb-2">
                      {post.title}
                    </h2>
                    <p className="text-[13px] text-[#6B7280] leading-[1.5]">{post.excerpt}</p>
                  </div>
                </MagicCard>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
