import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Article Sauce - AI-Powered SEO Article Generator",
  description:
    "Generate comprehensive, SEO-optimized articles with metadata, keywords, image prompts, and JSON-LD schema.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.classList.toggle('dark',t==='dark')})()` }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
