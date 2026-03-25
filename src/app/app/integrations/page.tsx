"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  available: boolean;
  comingSoon?: boolean;
}

function WordPressIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10" fill="#21759b">
      <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 1.5c1.872 0 3.6.576 5.018 1.551L4.051 17.018A8.466 8.466 0 013.5 12c0-4.687 3.813-8.5 8.5-8.5zm0 17c-1.872 0-3.6-.576-5.018-1.551l12.967-11.967A8.466 8.466 0 0120.5 12c0 4.687-3.813 8.5-8.5 8.5z" />
    </svg>
  );
}

function NotionIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.24c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  );
}

function WebflowIcon() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4353FF] text-white font-bold text-lg">
      W
    </div>
  );
}

function ShopifyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10" fill="#95BF47">
      <path d="M15.337 23.979l7.453-1.738S19.954 5.869 19.936 5.718c-.019-.15-.15-.254-.28-.254-.132 0-2.5-.046-2.5-.046s-1.669-1.615-1.837-1.782c-.169-.168-.506-.117-.637-.078l-.922.285s-.551-1.594-1.504-2.43C11.288.257 9.768.47 9.19.588L9.1.613S8.78.525 8.35.433C7.643.28 7.052.364 6.553.692c-1.448.96-2.14 3.03-2.37 4.624-.614.19-1.209.375-1.757.544C1.9 6.16 1.87 6.19 1.827 6.71L0 22.77l15.337 1.209zm-4.133-16.23c-.654.202-1.374.425-2.104.652.202-.77.597-1.537 1.213-2.07.253.448.659 1.019.891 1.418zm-1.803-2.637c.13 0 .253.042.37.124-.924.436-1.916 1.536-2.338 3.74l-1.767.546c.49-1.668 1.643-4.41 3.735-4.41zm-.647 10.303c.073 1.143 3.08 1.396 3.248 4.085.128 2.113-1.119 3.558-2.922 3.667-2.17.136-3.362-1.144-3.362-1.144l.459-1.954s1.2.907 2.16.849c.626-.04.851-.548.826-.901-.094-1.49-2.543-1.404-2.696-3.86-.13-2.068 1.226-4.16 4.22-4.346 1.157-.073 1.748.222 1.748.222l-.681 2.573s-.77-.354-1.683-.297c-1.333.084-1.347.934-1.317 1.106zm4.082-10.93c.73.835 1.222 2.013 1.372 3.627-1.05.324-2.196.68-3.35 1.036.39-1.498 1.27-2.957 1.978-4.663z" />
    </svg>
  );
}

function WixIcon() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black">
      <span className="text-white text-xs font-black tracking-tight">WIX</span>
    </div>
  );
}

function WPComIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10" fill="#21759b">
      <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm-1.5 14.5L7.25 9h2l2.25 5.25L13.75 9h2l-3.25 7.5h-2zm6.5 0h-2V9h2v7.5z" />
    </svg>
  );
}

function WebhookIcon() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6 text-[var(--text-secondary)]">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function FramerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10" fill="#0055FF">
      <path d="M4 0h16v8h-8zM4 8h8l8 8H4zM4 16h8v8z" />
    </svg>
  );
}

function GhostIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10" fill="#15171A">
      <path d="M12.5 0C5.596 0 0 5.372 0 12s5.596 12 12.5 12S25 18.628 25 12 19.404 0 12.5 0zm0 2.4C18.09 2.4 22.6 6.724 22.6 12S18.09 21.6 12.5 21.6 2.4 17.276 2.4 12 6.91 2.4 12.5 2.4zm0 2.4c-2.757 0-5.1 2.275-5.1 5.11 0 2.835 2.343 5.11 5.1 5.11 1.59 0 3.01-.718 3.98-1.85l2.04 3.24c-.34.39-.34.39-.34.39H6.82v-2.4h9.36c-.99 1.08-2.4 1.76-3.98 1.76a5.11 5.11 0 110-10.22z" />
    </svg>
  );
}

function FeatherIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-10 w-10 text-[var(--text-secondary)]">
      <path d="M20.24 12.24a6 6 0 00-8.49-8.49L5 10.5V19h8.5z" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="16" y1="8" x2="2" y2="22" strokeLinecap="round" />
      <line x1="17.5" y1="15" x2="9" y2="15" strokeLinecap="round" />
    </svg>
  );
}

export default function IntegrationsPage() {
  const router = useRouter();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const integrations: Integration[] = [
    {
      id: "wordpress",
      name: "WordPress",
      description: "Publish directly to your self-hosted WordPress site",
      icon: <WordPressIcon />,
      href: "/app/settings?section=wordpress",
      available: true,
    },
    {
      id: "notion",
      name: "Notion",
      description: "Send articles to a Notion database",
      icon: <NotionIcon />,
      href: "/app/settings?section=notion",
      available: true,
    },
    {
      id: "webflow",
      name: "Webflow",
      description: "Publish articles to your Webflow CMS",
      icon: <WebflowIcon />,
      href: "/app/settings?section=webflow",
      available: true,
    },
    {
      id: "shopify",
      name: "Shopify",
      description: "Post articles to your Shopify blog",
      icon: <ShopifyIcon />,
      href: "/app/settings?section=shopify",
      available: true,
    },
    {
      id: "wix",
      name: "Wix",
      description: "Connect your Wix site blog",
      icon: <WixIcon />,
      href: "/app/settings?section=wix",
      available: false,
      comingSoon: true,
    },
    {
      id: "wpcom",
      name: "WordPress.com",
      description: "Publish to WordPress.com hosted blogs",
      icon: <WPComIcon />,
      href: "/app/settings?section=wpcom",
      available: false,
      comingSoon: true,
    },
    {
      id: "webhook",
      name: "API Webhook",
      description: "Send articles to any endpoint via HTTP webhook",
      icon: <WebhookIcon />,
      href: "/app/settings?section=webhook",
      available: true,
    },
    {
      id: "framer",
      name: "Framer",
      description: "Publish to Framer CMS collections",
      icon: <FramerIcon />,
      href: "/app/settings?section=framer",
      available: false,
      comingSoon: true,
    },
    {
      id: "ghost",
      name: "Ghost",
      description: "Publish articles to your Ghost publication",
      icon: <GhostIcon />,
      href: "/app/settings?section=ghost",
      available: true,
    },
    {
      id: "feather",
      name: "Feather",
      description: "Connect your Feather blog",
      icon: <FeatherIcon />,
      href: "/app/settings?section=feather",
      available: false,
      comingSoon: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Add New Integration</h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)]">Connect your website to automatically publish articles</p>
      </div>

      <div className="mx-auto max-w-3xl">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {integrations.map((integration) => (
            <button
              key={integration.id}
              onMouseEnter={() => setHoveredId(integration.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => integration.available && router.push(integration.href)}
              className={cn(
                "group relative flex flex-col items-center gap-3 rounded-xl border p-6 text-center transition-all duration-150",
                integration.available
                  ? "cursor-pointer border-[var(--border-default)] bg-[var(--surface-base)] hover:border-[var(--accent)] hover:shadow-md"
                  : "cursor-default border-[var(--border-default)] bg-[var(--surface-sunken)] opacity-70"
              )}
            >
              {integration.comingSoon && (
                <span className="absolute right-2 top-2 rounded-full bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  Soon
                </span>
              )}
              <div className={cn(
                "transition-transform duration-150",
                hoveredId === integration.id && integration.available && "scale-110"
              )}>
                {integration.icon}
              </div>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {integration.name}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-[var(--text-tertiary)]">
          Need a different integration?{" "}
          <a href="mailto:support@articlegen.ai" className="text-[var(--accent)] hover:underline">
            Request it here
          </a>
        </p>
      </div>
    </div>
  );
}
