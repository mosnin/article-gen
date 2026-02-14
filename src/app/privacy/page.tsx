import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Article Sauce",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-12" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <Link href="/" className="text-sm font-medium" style={{ color: "var(--accent)" }}>
            ← Back to home
          </Link>
        </div>

        <h1 className="mb-4 text-3xl font-bold">Privacy Policy</h1>
        <p className="mb-8 text-sm" style={{ color: "var(--muted)" }}>
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <div className="space-y-6 text-sm leading-6" style={{ color: "var(--muted)" }}>
          <section>
            <h2 className="mb-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Information We Collect</h2>
            <p>
              We collect account details you provide (such as email), usage information needed to operate the product,
              and payment-related metadata required for billing.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>How We Use Information</h2>
            <p>
              We use data to authenticate users, provide content generation features, improve product quality,
              process subscriptions, and keep the service secure.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Data Sharing</h2>
            <p>
              We do not sell personal information. We may share information with trusted service providers
              (e.g., hosting, auth, payments) strictly to run the service.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Your Choices</h2>
            <p>
              You can update account details in-app, request password reset, and contact us for account deletion requests.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Contact</h2>
            <p>
              For privacy questions, contact support through the email associated with your account.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
