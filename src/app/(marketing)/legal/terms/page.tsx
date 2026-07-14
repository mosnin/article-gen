import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service – ArticleGen",
  description: "The terms that govern your use of ArticleGen.",
};

const sections: { heading: string; body: string }[] = [
  {
    heading: "1. Acceptance of terms",
    body: "By creating an account or using ArticleGen you agree to these Terms of Service. If you do not agree, do not use the service.",
  },
  {
    heading: "2. The service",
    body: "ArticleGen provides AI-assisted content generation, SEO research, scheduling, and publishing tools. Generated content is provided as-is; you are responsible for reviewing it before publication and for how you use it.",
  },
  {
    heading: "3. Accounts and acceptable use",
    body: "You are responsible for safeguarding your credentials and API keys. You may not use the service to produce unlawful, infringing, or deceptive content, to spam, or to interfere with the service's operation.",
  },
  {
    heading: "4. Subscriptions and billing",
    body: "Paid plans renew monthly through Stripe until cancelled. Credits reset each billing cycle and do not roll over. You can cancel at any time from the billing page; access continues until the end of the paid period.",
  },
  {
    heading: "5. Your content and connections",
    body: "You retain all rights to content you generate. Platform credentials you connect (for example WordPress or Ghost) are encrypted at rest and used solely to publish on your behalf.",
  },
  {
    heading: "6. Disclaimers and liability",
    body: "The service is provided without warranties of any kind. To the maximum extent permitted by law, our liability is limited to the amount you paid in the twelve months preceding the claim.",
  },
  {
    heading: "7. Changes",
    body: "We may update these terms from time to time. Material changes will be announced in the app; continued use after a change constitutes acceptance.",
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Terms of Service</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Last updated: July 2026</p>
      <div className="mt-10 space-y-8">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{s.heading}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">{s.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
