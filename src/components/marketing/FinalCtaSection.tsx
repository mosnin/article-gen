"use client";

export function FinalCtaSection() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl sm:text-5xl lg:text-[52px] font-bold leading-tight tracking-tight text-gray-900 mb-6">
          The content engine for teams that want to rank
        </h2>

        <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto">
          Join 2,400+ teams writing faster, ranking higher, and publishing everywhere.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="#"
            className="inline-flex items-center justify-center h-11 px-7 rounded-md bg-gray-900 text-white font-medium text-sm hover:bg-black transition-colors"
          >
            Start writing free
          </a>
          <a
            href="#"
            className="inline-flex items-center justify-center h-11 px-7 rounded-md border border-gray-300 text-gray-700 font-medium text-sm hover:border-gray-400 hover:text-gray-900 transition-colors"
          >
            Talk to us
          </a>
        </div>
      </div>
    </section>
  );
}
