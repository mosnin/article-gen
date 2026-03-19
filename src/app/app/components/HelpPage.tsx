"use client";

export function HelpPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-1.5 text-sm font-medium"
          style={{ color: "var(--accent)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <h2 className="mb-3 text-3xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          How Article Sauce Works
        </h2>
        <p style={{ color: "var(--muted)" }}>
          A guide to generating SEO-optimized articles, using batch mode, and configuring advanced settings.
        </p>
      </div>

      <div className="space-y-8">
        <div className="rounded-xl border p-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <h3 className="mb-3 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Overview</h3>
          <div className="space-y-2 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
            <p>Article Sauce generates comprehensive, SEO-optimized articles in three steps:</p>
            <ol className="list-decimal space-y-1 pl-5" style={{ color: "var(--muted)" }}>
              <li><strong style={{ color: "var(--foreground)" }}>Research</strong> - Analyzes your topic and gathers context</li>
              <li><strong style={{ color: "var(--foreground)" }}>Metadata</strong> - Generates title, meta description, slug, focus keyword, and supporting keywords</li>
              <li><strong style={{ color: "var(--foreground)" }}>Content</strong> - Writes the article, creates image prompts, and generates JSON-LD schema</li>
            </ol>
            <p style={{ color: "var(--muted)" }}>
              Each article includes: a markdown article, copyable metadata fields, 4 photorealistic image prompts with alt texts, and structured data for SEO rich snippets.
            </p>
          </div>
        </div>

        <div className="rounded-xl border p-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <h3 className="mb-3 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Single Mode</h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Enter a topic and an optional focus keyword. The article generates immediately at premium quality (~4,000 words).
          </p>
        </div>

        <div className="rounded-xl border p-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <h3 className="mb-3 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Batch Mode</h3>
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            <p>
              Generate up to 25 articles at once. Choose between Standard (~2,000 words) or Premium (~4,000 words) quality. Articles process 2 at a time with 60-second intervals between batches to stay within rate limits.
            </p>
            <p>
              You can add articles manually or import them via JSON. Use the{" "}
              <strong style={{ color: "var(--foreground)" }}>Upload</strong> or{" "}
              <strong style={{ color: "var(--foreground)" }}>Paste</strong> buttons to import.
            </p>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--accent)" }}>
                Batch JSON Format
              </p>
              <pre
                className="overflow-x-auto rounded-lg p-4 text-xs leading-relaxed"
                style={{ background: "var(--background)", color: "var(--foreground)" }}
              >
                {`[\n  {\n    "concept": "The Ultimate Guide to Indoor Herb Gardening",\n    "keyword": "indoor herb gardening"\n  },\n  {\n    "concept": "Best Running Shoes for Marathon Training in 2025",\n    "keyword": "marathon running shoes"\n  }\n]`}
              </pre>
            </div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              <strong style={{ color: "var(--foreground)" }}>Accepted fields:</strong>{" "}
              <code>concept</code> or <code>topic</code> for the article subject,{" "}
              <code>keyword</code> or <code>focusKeyword</code> for the target keyword.
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <h3 className="mb-3 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Advanced Settings</h3>
          <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            <p>
              Optional settings that populate the JSON-LD schema with your actual site and author information instead of placeholders.
            </p>
            <div>
              <p className="mb-1 text-xs font-medium" style={{ color: "var(--foreground)" }}>Available fields:</p>
              <ul className="list-disc space-y-1 pl-5 text-xs">
                <li><strong style={{ color: "var(--foreground)" }}>Domain</strong> - Your website URL (e.g., https://yourblog.com)</li>
                <li><strong style={{ color: "var(--foreground)" }}>Site Name</strong> - Publisher/organization name</li>
                <li><strong style={{ color: "var(--foreground)" }}>About the Blog</strong> - Short description of your site</li>
                <li><strong style={{ color: "var(--foreground)" }}>Author Name</strong> - Article author&apos;s name</li>
                <li><strong style={{ color: "var(--foreground)" }}>About the Author</strong> - Author bio/credentials</li>
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--accent)" }}>
                Advanced Settings JSON Format
              </p>
              <pre
                className="overflow-x-auto rounded-lg p-4 text-xs leading-relaxed"
                style={{ background: "var(--background)", color: "var(--foreground)" }}
              >
                {`{\n  "domain": "https://yourblog.com",\n  "siteName": "Your Blog Name",\n  "siteAbout": "A blog about sustainable living",\n  "authorName": "John Doe",\n  "authorAbout": "Expert with 10 years of experience"\n}`}
              </pre>
            </div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              <strong style={{ color: "var(--foreground)" }}>Accepted aliases:</strong>{" "}
              <code>domain</code>/<code>url</code>,{" "}
              <code>siteName</code>/<code>site_name</code>/<code>blogName</code>,{" "}
              <code>authorName</code>/<code>author_name</code>/<code>author</code>,{" "}
              <code>authorAbout</code>/<code>author_about</code>/<code>authorBio</code>/<code>bio</code>,{" "}
              <code>siteAbout</code>/<code>site_about</code>/<code>blogAbout</code>/<code>about</code>
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <h3 className="mb-3 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Output</h3>
          <div className="space-y-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            <p>Each generated article includes two views:</p>
            <ul className="list-disc space-y-1 pl-5 text-xs">
              <li>
                <strong style={{ color: "var(--foreground)" }}>Data tab</strong> - Copyable fields for title, meta description, slug, focus keyword, keywords, markdown article, 4 image prompts with alt texts, and JSON-LD schema
              </li>
              <li>
                <strong style={{ color: "var(--foreground)" }}>Preview tab</strong> - Rendered article as it would appear on a blog, with buttons to copy as plain text or HTML
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
