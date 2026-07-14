import type { Metadata } from "next";
import Link from "next/link";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";

export const metadata: Metadata = {
  title: "Integrations – ArticleGen",
  description:
    "Connect ArticleGen to WordPress, Shopify, Ghost, Medium, Dev.to, Notion, Webflow, HubSpot, and more.",
};

interface Integration {
  name: string;
  icon: string;
  iconBg: string;
  description: string;
  status: "Live" | "Coming Soon";
}

const cmsPlatforms: Integration[] = [
  {
    name: "WordPress",
    icon: "W",
    iconBg: "#21759b",
    description: "Blog & CMS publishing via REST API",
    status: "Live",
  },
  {
    name: "Shopify",
    icon: "S",
    iconBg: "#5b8c3d",
    description: "Product blog & content hub",
    status: "Live",
  },
  {
    name: "Ghost",
    icon: "G",
    iconBg: "#15212a",
    description: "Creator platform publishing",
    status: "Live",
  },
  {
    name: "Webflow",
    icon: "WF",
    iconBg: "#146ef5",
    description: "Website CMS via API",
    status: "Live",
  },
];

const creatorPlatforms: Integration[] = [
  {
    name: "Medium",
    icon: "M",
    iconBg: "#000",
    description: "Thought leadership & personal brand",
    status: "Live",
  },
  {
    name: "Dev.to",
    icon: "D",
    iconBg: "#3b49df",
    description: "Technical articles for developers",
    status: "Live",
  },
  {
    name: "Notion",
    icon: "N",
    iconBg: "#000",
    description: "Internal knowledge base & docs",
    status: "Live",
  },
  {
    name: "HubSpot",
    icon: "H",
    iconBg: "#ff7a59",
    description: "Marketing hub & blog",
    status: "Coming Soon",
  },
];

const analyticsIntegrations: Integration[] = [
  {
    name: "Google Search Console",
    icon: "GSC",
    iconBg: "#4285f4",
    description: "Keyword rankings & traffic data",
    status: "Live",
  },
  {
    name: "Ahrefs",
    icon: "A",
    iconBg: "#ff7c00",
    description: "Backlink & keyword research",
    status: "Coming Soon",
  },
  {
    name: "SEMrush",
    icon: "S",
    iconBg: "#ff642d",
    description: "Competitive SEO analysis",
    status: "Coming Soon",
  },
];

function IntegrationCard({ integration }: { integration: Integration }) {
  return (
    <MagicCard gradientColor="#3B82F610" className="rounded-xl">
      <div className="p-6 text-center">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-[16px] font-bold mx-auto mb-4"
          style={{ backgroundColor: integration.iconBg }}
        >
          {integration.icon}
        </div>
        <p className="text-[16px] font-bold text-[#111827]">{integration.name}</p>
        <p className="text-[13px] text-[#6B7280] mt-1">{integration.description}</p>
        {integration.status === "Live" ? (
          <span className="bg-green-100 text-green-700 text-[11px] px-2 py-0.5 rounded-full mt-3 inline-block">
            Live
          </span>
        ) : (
          <span className="bg-gray-100 text-gray-500 text-[11px] px-2 py-0.5 rounded-full mt-3 inline-block">
            Coming Soon
          </span>
        )}
      </div>
    </MagicCard>
  );
}

export default function IntegrationsPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-white text-center">
        <div className="max-w-[800px] mx-auto px-6">
          <BlurFade inView delay={0}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] mb-4">
              Integrations
            </p>
            <h1
              className="font-bold text-[#111827] mb-6"
              style={{ fontSize: "36px", lineHeight: "1.2" }}
            >
              Connect to your entire content stack
            </h1>
            <p className="text-[18px] text-[#6B7280] max-w-[560px] mx-auto leading-[1.7]">
              ArticleGen plugs into the tools your team already uses. Set up once, publish
              everywhere.
            </p>
          </BlurFade>
        </div>
      </section>

      {/* Integration categories */}
      <section className="py-16 bg-[#F8F9FA]">
        <div className="max-w-[1200px] mx-auto px-6">
          {/* CMS Platforms */}
          <BlurFade inView delay={0.05}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] mb-6">
              CMS Platforms
            </p>
          </BlurFade>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {cmsPlatforms.map((integration, i) => (
              <BlurFade key={integration.name} inView delay={0.1 + i * 0.05}>
                <IntegrationCard integration={integration} />
              </BlurFade>
            ))}
          </div>

          {/* Creator Platforms */}
          <BlurFade inView delay={0.1}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] mb-6">
              Creator Platforms
            </p>
          </BlurFade>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {creatorPlatforms.map((integration, i) => (
              <BlurFade key={integration.name} inView delay={0.15 + i * 0.05}>
                <IntegrationCard integration={integration} />
              </BlurFade>
            ))}
          </div>

          {/* Analytics & SEO */}
          <BlurFade inView delay={0.1}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] mb-6">
              Analytics &amp; SEO
            </p>
          </BlurFade>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {analyticsIntegrations.map((integration, i) => (
              <BlurFade key={integration.name} inView delay={0.15 + i * 0.05}>
                <IntegrationCard integration={integration} />
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* Webhook callout */}
      <section className="py-12 bg-[#F0F4FF] text-center">
        <div className="max-w-[600px] mx-auto px-6">
          <BlurFade inView delay={0}>
            <h2 className="text-[22px] font-bold text-[#111827]">
              Don&apos;t see your platform?
            </h2>
            <p className="text-[16px] text-[#6B7280] mt-2">
              We support any platform via our Webhook API. Send articles anywhere.
            </p>
            <div className="flex items-center justify-center gap-4 mt-8 flex-wrap">
              <Link
                href="/trial"
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[15px] px-6 py-3 rounded-lg transition-colors"
              >
                Start Your Trial
              </Link>
              <a
                href="mailto:hello@articlesauce.com"
                className="border border-[#E5E7EB] bg-white hover:bg-[#F8F9FA] text-[#111827] font-semibold text-[15px] px-6 py-3 rounded-lg transition-colors"
              >
                Contact us
              </a>
            </div>
          </BlurFade>
        </div>
      </section>
    </>
  );
}
