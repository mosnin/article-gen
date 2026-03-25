"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type Difficulty = "Easy" | "Medium" | "Hard";
type ContentType =
  | "How-to Guide"
  | "Listicle"
  | "Comparison"
  | "Review"
  | "Case Study";

interface KeywordResult {
  keyword: string;
  difficulty: Difficulty;
  contentType: ContentType;
}

interface CompetitorResult {
  domain: string;
  estimatedMonthlyTraffic: string;
  topThemes: string[];
  contentGaps: { keyword: string; contentType: ContentType }[];
  topTopics: { category: string; description: string }[];
}

type Tab = "keywords" | "competitor";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function difficultyVariant(
  difficulty: Difficulty
): "success" | "warning" | "error" {
  if (difficulty === "Easy") return "success";
  if (difficulty === "Medium") return "warning";
  return "error";
}

/** Assign a deterministic difficulty + content type from an idea object */
function mapIdeaToKeyword(
  idea: { concept: string; keyword: string },
  index: number
): KeywordResult {
  const difficulties: Difficulty[] = ["Easy", "Medium", "Hard"];
  const contentTypes: ContentType[] = [
    "How-to Guide",
    "Listicle",
    "Comparison",
    "Review",
    "Case Study",
  ];

  // Heuristic: use keyword characteristics to assign difficulty
  const kw = idea.keyword.toLowerCase();
  let difficulty: Difficulty;
  if (
    kw.includes("how to") ||
    kw.includes("what is") ||
    kw.includes("best way")
  ) {
    difficulty = "Easy";
  } else if (
    kw.includes("vs") ||
    kw.includes("review") ||
    kw.includes("comparison")
  ) {
    difficulty = "Medium";
  } else {
    difficulty = difficulties[index % 3];
  }

  // Content type from keyword signals
  let contentType: ContentType;
  if (kw.includes("how to") || kw.includes("guide") || kw.includes("tips")) {
    contentType = "How-to Guide";
  } else if (
    kw.includes("best") ||
    kw.includes("top") ||
    kw.includes("list")
  ) {
    contentType = "Listicle";
  } else if (kw.includes("vs") || kw.includes("comparison")) {
    contentType = "Comparison";
  } else if (kw.includes("review")) {
    contentType = "Review";
  } else {
    contentType = contentTypes[index % contentTypes.length];
  }

  return { keyword: idea.keyword, difficulty, contentType };
}

/** Parse the research API response text into structured competitor data */
function parseCompetitorResult(
  domain: string,
  articleContext: string,
  researchContext: string
): CompetitorResult {
  const combined = `${articleContext}\n\n${researchContext}`;
  const lines = combined
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Extract themes — look for bullet-like lines in articleContext
  const themeLines = lines
    .filter(
      (l) =>
        (l.startsWith("-") || l.startsWith("•") || l.match(/^\d+\./)) &&
        l.length > 15 &&
        l.length < 120
    )
    .slice(0, 5)
    .map((l) => l.replace(/^[-•\d.]+\s*/, "").trim());

  const topThemes =
    themeLines.length >= 2
      ? themeLines
      : ["Content marketing", "SEO strategy", "Organic traffic growth"];

  // Synthesise content gap keywords from the research text
  const contentGapKeywords: { keyword: string; contentType: ContentType }[] =
    [];
  const contentTypes: ContentType[] = [
    "How-to Guide",
    "Listicle",
    "Comparison",
    "Review",
    "Case Study",
  ];

  // Pull capitalized noun phrases that look like keywords
  const kwRegex = /\b([A-Z][a-z]+(?: [a-z]+){1,4})\b/g;
  const kwMatches = new Set<string>();
  let match;
  while ((match = kwRegex.exec(combined)) !== null) {
    const phrase = match[1].trim();
    if (phrase.split(" ").length >= 2 && phrase.length < 60) {
      kwMatches.add(phrase.toLowerCase());
    }
  }

  let idx = 0;
  for (const kw of kwMatches) {
    if (contentGapKeywords.length >= 8) break;
    contentGapKeywords.push({
      keyword: kw,
      contentType: contentTypes[idx % contentTypes.length],
    });
    idx++;
  }

  if (contentGapKeywords.length < 3) {
    contentGapKeywords.push(
      { keyword: `${domain} alternatives`, contentType: "Comparison" },
      { keyword: `how to use ${domain}`, contentType: "How-to Guide" },
      { keyword: `${domain} review 2025`, contentType: "Review" }
    );
  }

  // Top performing topics — derive from the context sections
  const topTopics = [
    {
      category: "Educational Content",
      description: "In-depth guides and tutorials that drive consistent traffic",
    },
    {
      category: "Comparison Pages",
      description:
        "High-converting pages comparing products or services in the niche",
    },
    {
      category: "Case Studies",
      description: "Real-world success stories generating authority and links",
    },
  ];

  // Rough traffic estimate based on content volume mentioned
  const numbersInText = combined.match(/\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?[KkMm]?)\b/g) || [];
  const estimatedMonthlyTraffic =
    numbersInText.length > 2 ? "10K – 50K / mo (est.)" : "5K – 20K / mo (est.)";

  return {
    domain,
    estimatedMonthlyTraffic,
    topThemes,
    contentGaps: contentGapKeywords,
    topTopics,
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KeywordCard({
  result,
  index,
}: {
  result: KeywordResult;
  index: number;
}) {
  const router = useRouter();
  const encoded = encodeURIComponent(result.keyword);

  return (
    <Card
      className="fade-in-up"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <CardContent className="pt-4 pb-4 flex flex-col gap-3">
        <p className="font-medium text-[var(--text-primary)] leading-snug">
          {result.keyword}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={difficultyVariant(result.difficulty)}>
            {result.difficulty}
          </Badge>
          <Badge variant="neutral">{result.contentType}</Badge>
        </div>
        <Button
          size="sm"
          className="w-full mt-1"
          onClick={() =>
            router.push(`/app/generate?topic=${encoded}&keyword=${encoded}`)
          }
        >
          Generate Article
        </Button>
      </CardContent>
    </Card>
  );
}

function KeywordCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 flex flex-col gap-3">
        <Skeleton className="h-5 w-4/5" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-8 w-full rounded-md mt-1" />
      </CardContent>
    </Card>
  );
}

function ContentGapRow({
  item,
  index,
}: {
  item: { keyword: string; contentType: ContentType };
  index: number;
}) {
  const router = useRouter();
  const encoded = encodeURIComponent(item.keyword);

  return (
    <div
      className="fade-in-up flex items-center justify-between gap-3 py-3 px-1"
      style={{ animationDelay: `${index * 35}ms` }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-[var(--text-primary)] truncate">
          {item.keyword}
        </span>
        <Badge variant="neutral" className="shrink-0 hidden sm:inline-flex">
          {item.contentType}
        </Badge>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={() =>
          router.push(`/app/generate?topic=${encoded}&keyword=${encoded}`)
        }
      >
        Generate
      </Button>
    </div>
  );
}

// ─── Keyword Research Tab ────────────────────────────────────────────────────

function KeywordResearchTab() {
  const [niche, setNiche] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<KeywordResult[] | null>(null);

  async function handleResearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmedNiche = niche.trim();
    if (!trimmedNiche) {
      toast.error("Please enter a niche or topic.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch("/api/generate/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: targetAudience
            ? `${trimmedNiche} (target audience: ${targetAudience.trim()})`
            : trimmedNiche,
          count: 20,
          targetAudience: targetAudience.trim() || undefined,
          mode: "keywords",
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to fetch keyword ideas.");
      }

      const ideas: { concept: string; keyword: string }[] = data.ideas ?? [];
      if (ideas.length === 0) {
        throw new Error("No keyword ideas returned. Please try again.");
      }

      setResults(ideas.map(mapIdeaToKeyword));
      toast.success(`Found ${ideas.length} keyword ideas.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Search form */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Find Keywords</CardTitle>
          <CardDescription>
            Enter your niche or topic to get a list of high-value keywords to
            target.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResearch} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="kw-niche">Your niche or topic</Label>
              <Input
                id="kw-niche"
                placeholder="e.g. email marketing software"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                disabled={loading}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kw-audience">
                Target audience{" "}
                <span className="text-[var(--text-secondary)] font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="kw-audience"
                placeholder="e.g. B2B SaaS founders"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                disabled={loading}
                maxLength={150}
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !niche.trim()}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Researching…
                </span>
              ) : (
                "Research Keywords"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Loading skeletons */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <KeywordCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center justify-center py-12 text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--error-light)] flex items-center justify-center">
              <svg
                className="w-6 h-6 text-[var(--error)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-[var(--text-primary)]">
                Research failed
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-sm">
                {error}
              </p>
            </div>
            <Button variant="outline" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty state — before any search */}
      {!loading && !error && results === null && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-[var(--surface-sunken)] flex items-center justify-center">
            <svg
              className="w-7 h-7 text-[var(--text-secondary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"
              />
            </svg>
          </div>
          <p className="font-medium text-[var(--text-primary)]">
            Enter a topic to get started
          </p>
          <p className="text-sm text-[var(--text-secondary)] max-w-xs">
            We'll surface high-value keywords you can target with fresh content.
          </p>
        </div>
      )}

      {/* Results grid */}
      {!loading && !error && results !== null && results.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              {results.length} Keywords Found
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r, i) => (
              <KeywordCard key={`${r.keyword}-${i}`} result={r} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Competitor Analysis Tab ─────────────────────────────────────────────────

function CompetitorAnalysisTab() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompetitorResult | null>(null);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    const trimmedDomain = domain.trim().replace(/^https?:\/\//, "");
    if (!trimmedDomain) {
      toast.error("Please enter a competitor domain.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/generate/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: `Competitor analysis for domain: ${trimmedDomain}`,
          quality: "standard",
          competitorMode: true,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to analyze competitor.");
      }

      const parsed = parseCompetitorResult(
        trimmedDomain,
        data.articleContext ?? "",
        data.researchContext ?? ""
      );
      setResult(parsed);
      toast.success(`Analysis complete for ${trimmedDomain}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Analyze form */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Analyze a Competitor</CardTitle>
          <CardDescription>
            Enter a competitor's domain to discover content gaps and top
            performing topics you can target.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="comp-domain">Competitor URL or domain</Label>
              <Input
                id="comp-domain"
                placeholder="e.g. competitor.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={loading}
                maxLength={200}
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !domain.trim()}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Analyzing…
                </span>
              ) : (
                "Analyze"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
              <div className="flex gap-2 flex-wrap pt-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-28 rounded-full" />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Skeleton className="h-5 w-40 mb-2" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-52" />
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center justify-center py-12 text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--error-light)] flex items-center justify-center">
              <svg
                className="w-6 h-6 text-[var(--error)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-[var(--text-primary)]">
                Analysis failed
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-sm">
                {error}
              </p>
            </div>
            <Button variant="outline" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && result === null && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-[var(--surface-sunken)] flex items-center justify-center">
            <svg
              className="w-7 h-7 text-[var(--text-secondary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="font-medium text-[var(--text-primary)]">
            Enter a competitor domain to begin
          </p>
          <p className="text-sm text-[var(--text-secondary)] max-w-xs">
            We'll identify content gaps and high-performing topics so you can
            outrank them.
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && !error && result !== null && (
        <div className="space-y-5 fade-in-up">
          {/* Summary card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[var(--surface-sunken)] flex items-center justify-center shrink-0">
                  <svg
                    className="w-4 h-4 text-[var(--text-secondary)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"
                    />
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-base">{result.domain}</CardTitle>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Estimated traffic: {result.estimatedMonthlyTraffic}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                Top Content Themes
              </p>
              <div className="flex flex-wrap gap-2">
                {result.topThemes.map((theme, i) => (
                  <Badge key={i} variant="neutral">
                    {theme}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Content gaps */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Content Gaps</CardTitle>
              <CardDescription>
                Keywords {result.domain} likely ranks for that you haven't
                covered yet.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="divide-y divide-[var(--border-default)]">
                {result.contentGaps.map((item, i) => (
                  <ContentGapRow key={`${item.keyword}-${i}`} item={item} index={i} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top performing topics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top Performing Topics</CardTitle>
              <CardDescription>
                Their best content categories driving organic growth.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-3">
                {result.topTopics.map((topic, i) => (
                  <div
                    key={i}
                    className="fade-in-up flex gap-3"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-2 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {topic.category}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {topic.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  const [activeTab, setActiveTab] = useState<Tab>("keywords");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Keyword & Competitor Research"
        description="Discover high-value keywords and uncover content gaps to outrank your competition."
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-default)]">
        {(
          [
            { id: "keywords", label: "Keyword Research" },
            { id: "competitor", label: "Competitor Analysis" },
          ] as { id: Tab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.id
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === "keywords" && <KeywordResearchTab />}
      {activeTab === "competitor" && <CompetitorAnalysisTab />}
    </div>
  );
}
