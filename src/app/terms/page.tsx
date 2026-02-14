import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Article Sauce",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-12" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <Link href="/" className="text-sm font-medium" style={{ color: "var(--accent)" }}>
            ← Back to home
          </Link>
        </div>

        <h1 className="mb-4 text-3xl font-bold">Terms of Service</h1>
        <p className="mb-8 text-sm" style={{ color: "var(--muted)" }}>
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <div className="space-y-6 text-sm leading-6" style={{ color: "var(--muted)" }}>
          <section>
            <h2 className="mb-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Use of Service</h2>
            <p>
              You may use Article Sauce only for lawful purposes and in compliance with all applicable platform policies.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Accounts</h2>
            <p>
              You are responsible for maintaining account security and for all activity under your account.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Billing</h2>
            <p>
              Paid plans renew according to your selected subscription. You can manage your plan from the billing page.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Content Responsibility</h2>
            <p>
              You are responsible for reviewing generated outputs and ensuring published content meets legal and editorial standards.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Changes</h2>
            <p>
              We may update these terms from time to time. Continued use of the service after updates means acceptance of the revised terms.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
