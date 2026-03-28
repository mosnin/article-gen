import type { Metadata } from "next";
import Link from "next/link";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";

export const metadata: Metadata = {
  title: "Blog – ArticleGen",
  description:
    "Content marketing tips, SEO strategies, and product updates from the ArticleGen team.",
};

interface BlogPost {
  category: string;
  title: string;
  excerpt: string;
  gradientFrom: string;
  gradientTo: string;
  date: string;
  readTime: string;
}

const posts: BlogPost[] = [
  {
    category: "SEO Strategy",
    title: "How to Build Topical Authority with AI-Generated Content",
    excerpt:
      "Topical authority is now the #1 ranking factor for blogs. Here's how to build it in 90 days using content clusters and AI generation.",
    gradientFrom: "#2563EB",
    gradientTo: "#7C3AED",
    date: "Mar 28, 2026",
    readTime: "5 min read",
  },
  {
    category: "Product Update",
    title: "Introducing Autopilot: Your 30-Day Content Plan, Automated",
    excerpt:
      "ArticleGen now generates a complete 30-day content calendar at signup, pre-mapped to your niche and ready to approve.",
    gradientFrom: "#059669",
    gradientTo: "#0284C7",
    date: "Mar 28, 2026",
    readTime: "5 min read",
  },
  {
    category: "Content Marketing",
    title: "The Truth About AI Content and Google's Helpful Content Update",
    excerpt:
      "Does AI content get penalized? We analyzed 500 AI-generated articles and their rankings. The answer might surprise you.",
    gradientFrom: "#D97706",
    gradientTo: "#DC2626",
    date: "Mar 28, 2026",
    readTime: "5 min read",
  },
  {
    category: "Tutorial",
    title: "How to Connect WordPress to ArticleGen in 5 Minutes",
    excerpt:
      "A step-by-step walkthrough of the WordPress REST API integration — from generating your app password to publishing your first article.",
    gradientFrom: "#7C3AED",
    gradientTo: "#2563EB",
    date: "Mar 28, 2026",
    readTime: "5 min read",
  },
  {
    category: "SEO Strategy",
    title: "Internal Linking at Scale: How AI Can Build Your Link Architecture",
    excerpt:
      "Internal links are a massive ranking signal most bloggers ignore. ArticleGen's linking config makes it automatic.",
    gradientFrom: "#0284C7",
    gradientTo: "#059669",
    date: "Mar 28, 2026",
    readTime: "5 min read",
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
            </p>
          </BlurFade>
        </div>
      </section>

      {/* Posts grid */}
      <section className="py-16 bg-[#F8F9FA]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {posts.map((post, i) => (
              <BlurFade key={post.title} inView delay={0.1 + i * 0.07}>
                <MagicCard gradientColor="#3B82F610" className="rounded-xl overflow-hidden h-full">
                  <div
                    className="w-full aspect-video"
                    style={{
                      background: `linear-gradient(to bottom right, ${post.gradientFrom}, ${post.gradientTo})`,
                    }}
                  />
                  <div className="p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#3B82F6] mb-2">
                      {post.category}
                    </p>
                    <h2 className="text-[17px] font-bold text-[#111827] leading-snug mb-2">
                      {post.title}
                    </h2>
                    <p className="text-[13px] text-[#6B7280] leading-[1.5] line-clamp-2">
                      {post.excerpt}
                    </p>
                    <p className="text-[12px] text-[#9CA3AF] mt-3">
                      {post.date} · {post.readTime}
                    </p>
                  </div>
                </MagicCard>
              </BlurFade>
            ))}
          </div>
          <p className="text-[14px] text-[#9CA3AF] text-center mt-10">More posts coming soon.</p>
        </div>
      </section>
    </>
  );
}
