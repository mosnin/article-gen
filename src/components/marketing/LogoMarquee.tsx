"use client";

const logos = [
  { label: "WordPress" },
  { label: "Shopify" },
  { label: "Ghost" },
  { label: "Medium" },
  { label: "Dev.to" },
  { label: "Notion" },
  { label: "Webflow" },
  { label: "HubSpot" },
  { label: "Ahrefs" },
  { label: "SEMrush" },
] as const;

export function LogoMarquee() {
  return (
    <section className="py-16 bg-white border-y border-gray-100">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm text-gray-400 mb-10">
          Used by content teams at
        </p>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-0">
          {logos.map((logo) => (
            <div
              key={logo.label}
              className="flex items-center justify-center px-5 py-5 border border-gray-200"
            >
              <span className="text-sm font-bold text-gray-800 tracking-tight whitespace-nowrap">
                {logo.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
