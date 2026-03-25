"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function TrialCheckoutPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const start = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/trial");
        return;
      }

      try {
        const res = await fetch("/api/stripe/trial", { method: "POST" });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else if (data.error === "Already on a paid plan") {
          router.replace("/app/onboarding");
        } else {
          setError(data.error || "Failed to start trial");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    };

    start();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--background)" }}>
      {error ? (
        <div className="text-center space-y-4">
          <p className="text-sm font-medium" style={{ color: "var(--error, #ef4444)" }}>{error}</p>
          <button
            onClick={() => router.push("/trial")}
            className="text-sm underline"
            style={{ color: "var(--accent)" }}
          >
            Go back
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm" style={{ color: "var(--text-secondary, #6b7280)" }}>
            Setting up your trial…
          </p>
        </div>
      )}
    </div>
  );
}
