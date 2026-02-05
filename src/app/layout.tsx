import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Article Gen - AI-Powered SEO Article Generator",
  description:
    "Generate comprehensive, SEO-optimized 4000-word articles with metadata, keywords, and Midjourney image prompts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
