"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Suspense } from "react";

const TESTIMONIALS = [
  {
    name: "Marcus Chen",
    title: "Founder of ContentFlow",
    avatar: "MC",
    color: "#6366f1",
    quote: [
      { text: "I'm genuinely " },
      { text: "blown away by the quality", bold: true },
      { text: " of the articles this generates. It's the first AI writing tool I've used where I don't feel like I need to rewrite everything from scratch." },
    ],
    extra: "The SEO rankings speak for themselves — we're ranking #1 for 12 new keywords this month.",
  },
  {
    name: "Sarah Williams",
    title: "Head of Growth at ScaleUp",
    avatar: "SW",
    color: "#10b981",
    quote: [
      { text: "We went from publishing " },
      { text: "2 articles a month to 40", bold: true },
      { text: " without hiring anyone new. The calendar feature alone saves us hours of planning every week." },
    ],
    extra: "Our organic traffic is up 340% in 90 days.",
  },
  {
    name: "David Park",
    title: "SEO Director at GrowthLab",
    avatar: "DP",
    color: "#f59e0b",
    quote: [
      { text: "Finally an AI writer that " },
      { text: "actually understands SEO", bold: true },
      { text: ". The keyword research and competitor analysis tools are genuinely useful, not just marketing fluff." },
    ],
    extra: "It's replaced 3 separate tools in our stack.",
  },
];

function TrialPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  const supabase = createClient();

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.replace("/app/trial-checkout");
        return;
      }
      setCheckingAuth(false);

      if (searchParams.get("canceled") === "1") {
        setError("Trial setup was canceled. You can try again anytime.");
      }
    };
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rotate testimonials every 6s
  useEffect(() => {
    const t = setInterval(() => {
      setTestimonialIndex((i) => (i + 1) % TESTIMONIALS.length);
    }, 6000);
    return () => clearInterval(t);
  }, []);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");

    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/app/trial-checkout`,
      },
    });

    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setOauthLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/app/trial-checkout`,
      },
    });
  };

  const testimonial = TESTIMONIALS[testimonialIndex];

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f8fa]">
        <svg className="animate-spin h-5 w-5 text-[#7c3aed]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8f8fa]">
      {/* Left — sign up form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          {/* Heading */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-2">
              Welcome to{" "}
              <span style={{ color: "#7c3aed" }}>ArticleSauce</span>
            </h1>
            <p className="text-base text-gray-500">
              Outrank your competitors on auto-pilot
            </p>
          </div>

          {/* Social proof row */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="flex -space-x-2">
              {["#7c3aed", "#10b981", "#f59e0b", "#3b82f6", "#ef4444"].map((c, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: c, zIndex: 5 - i }}
                >
                  {["M", "S", "D", "A", "R"][i]}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex">
                {[1,2,3,4,5].map((s) => (
                  <svg key={s} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                ))}
              </div>
              <span className="text-sm font-medium text-gray-600">750k+ Articles Created</span>
            </div>
          </div>

          {/* Trial badge */}
          <div className="flex items-center justify-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
              3-day free trial · $1 to start
            </span>
          </div>

          {/* Google button */}
          <button
            onClick={handleGoogle}
            disabled={oauthLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border-2 bg-white font-semibold text-gray-800 text-sm transition-all hover:bg-gray-50 mb-4 disabled:opacity-60"
            style={{ borderColor: "#7c3aed" }}
          >
            {oauthLoading ? (
              <svg className="animate-spin h-4 w-4 text-[#7c3aed]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-medium text-gray-400 tracking-wider">OR CONTINUE WITH EMAIL</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Magic link form */}
          {!sent ? (
            <form onSubmit={handleMagicLink} className="space-y-3">
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all disabled:opacity-60"
              />
              {error && (
                <p className="text-xs text-red-500 text-center">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-60"
                style={{ background: "#7c3aed" }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending…
                  </>
                ) : (
                  <>
                    Send Magic Link
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-6 space-y-2">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="font-semibold text-gray-900">Check your inbox</p>
              <p className="text-sm text-gray-500">
                We sent a magic link to <strong>{email}</strong>.<br />
                Click it to continue to your trial.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-sm underline text-purple-600 mt-2"
              >
                Use a different email
              </button>
            </div>
          )}

          {/* Terms */}
          <p className="mt-5 text-center text-xs text-gray-400">
            By signing up you agree to our{" "}
            <a href="/legal/terms" className="underline hover:text-gray-600">Terms</a>
            {" & "}
            <a href="/legal/privacy" className="underline hover:text-gray-600">Privacy Policy</a>.
            {" "}$1 trial charge · cancel anytime.
          </p>

          {/* Login link */}
          <p className="mt-3 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <a href="/?auth=login" className="font-medium text-purple-600 hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </div>

      {/* Right — social proof (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center px-12 py-12 bg-[#f0effe]">
        <div className="w-full max-w-[440px]">
          {/* Big quote mark */}
          <div className="text-[64px] leading-none font-serif mb-4" style={{ color: "#c4b5fd" }}>&ldquo;</div>

          {/* Testimonial card */}
          <div className="bg-white rounded-2xl shadow-lg p-7 transition-all duration-500">
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ background: testimonial.color }}
              >
                {testimonial.avatar}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{testimonial.name}</p>
                <p className="text-xs text-gray-500">{testimonial.title}</p>
              </div>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              {testimonial.quote.map((chunk, i) =>
                chunk.bold ? (
                  <strong key={i}>{chunk.text}</strong>
                ) : (
                  <span key={i}>{chunk.text}</span>
                )
              )}
            </p>
            <p className="text-gray-500 text-sm leading-relaxed">{testimonial.extra}</p>
          </div>

          {/* Testimonial dots */}
          <div className="flex items-center justify-center gap-2 mt-5">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setTestimonialIndex(i)}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === testimonialIndex ? 24 : 8,
                  height: 8,
                  background: i === testimonialIndex ? "#7c3aed" : "#c4b5fd",
                }}
              />
            ))}
          </div>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-3 gap-4 text-center">
            {[
              { value: "750k+", label: "Articles created" },
              { value: "12k+", label: "Active users" },
              { value: "4.9★", label: "Average rating" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TrialPage() {
  return (
    <Suspense>
      <TrialPageContent />
    </Suspense>
  );
}
