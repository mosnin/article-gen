import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy – ArticleGen",
  description: "How ArticleGen collects, uses, and protects your data.",
};

const sections: { heading: string; body: string }[] = [
  {
    heading: "1. What we collect",
    body: "Account details (email, name), content you create in the app, publishing connection credentials you provide, usage analytics, and billing information processed by Stripe. We never see your full card number.",
  },
  {
    heading: "2. How we use it",
    body: "To operate the service: generating content you request, publishing to platforms you connect, sending scheduled publications, and improving reliability. We do not sell your personal data.",
  },
  {
    heading: "3. AI processing",
    body: "Content generation requests are processed by third-party AI providers (such as OpenAI) under their API terms, which exclude use of API data for model training.",
  },
  {
    heading: "4. Security",
    body: "Platform credentials are encrypted at rest with AES-256-GCM. API keys are stored as one-way hashes. All data in transit is protected with TLS. Access to production data is restricted and audited.",
  },
  {
    heading: "5. Retention and deletion",
    body: "Your content stays in your account until you delete it. Deleting your account removes your personal data and stored credentials within 30 days, except where retention is required by law.",
  },
  {
    heading: "6. Your rights",
    body: "You can access, export, correct, or delete your data at any time from the app or by contacting support. Depending on your jurisdiction you may have additional rights under GDPR or CCPA.",
  },
  {
    heading: "7. Contact",
    body: "Questions about this policy can be sent to the support address listed on the pricing page.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Privacy Policy</h1>
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
