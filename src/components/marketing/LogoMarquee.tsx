"use client";

const logos = [
  { label: "WordPress", className: "text-blue-600 dark:text-blue-400" },
  { label: "Shopify", className: "text-green-600 dark:text-green-400" },
  { label: "Ghost", className: "text-yellow-600 dark:text-yellow-400" },
  { label: "Medium", className: "text-gray-900 dark:text-gray-100" },
  { label: "Dev.to", className: "text-red-600 dark:text-red-400" },
  { label: "Notion", className: "text-gray-800 dark:text-gray-200" },
  { label: "Webflow", className: "text-indigo-600 dark:text-indigo-400" },
  { label: "Google", isGoogle: true },
] as const;

function GoogleLogo() {
  return (
    <span className="text-sm font-bold tracking-tight">
      <span className="text-blue-600 dark:text-blue-400">G</span>
      <span className="text-red-500 dark:text-red-400">o</span>
      <span className="text-yellow-500 dark:text-yellow-400">o</span>
      <span className="text-blue-600 dark:text-blue-400">g</span>
      <span className="text-green-600 dark:text-green-400">l</span>
      <span className="text-red-500 dark:text-red-400">e</span>
    </span>
  );
}

function LogoItem({ logo }: { logo: (typeof logos)[number] }) {
  return (
    <div className="flex-shrink-0 px-6 py-2 rounded-full bg-gray-100 dark:bg-gray-800 mx-6 flex items-center">
      {"isGoogle" in logo && logo.isGoogle ? (
        <GoogleLogo />
      ) : (
        <span className={`text-sm font-bold tracking-tight ${"className" in logo ? logo.className : ""}`}>
          {logo.label}
        </span>
      )}
    </div>
  );
}

export function LogoMarquee() {
  return (
    <section className="py-12 bg-white dark:bg-gray-950 border-y border-gray-100 dark:border-gray-800 overflow-hidden">
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-8">
        Trusted by content teams using
      </p>

      {/* Animated marquee — hidden when prefers-reduced-motion */}
      <div
        className="relative marquee-container"
        aria-hidden="true"
      >
        <div className="flex marquee-track hover:[animation-play-state:paused]">
          {logos.map((logo, i) => (
            <LogoItem key={`a-${i}`} logo={logo} />
          ))}
          {logos.map((logo, i) => (
            <LogoItem key={`b-${i}`} logo={logo} />
          ))}
        </div>
      </div>

      {/* Static fallback for prefers-reduced-motion */}
      <div
        className="hidden motion-reduce-flex flex-wrap justify-center gap-4 px-4"
        aria-label="Integrations"
      >
        {logos.map((logo, i) => (
          <LogoItem key={`static-${i}`} logo={logo} />
        ))}
      </div>

      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .marquee-track {
          width: max-content;
          animation: marquee 30s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-container {
            display: none;
          }
          .motion-reduce-flex {
            display: flex !important;
          }
        }
      `}</style>
    </section>
  );
}
