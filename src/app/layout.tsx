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
      <body className="antialiased">{children}</body>
    </html>
  );
}
