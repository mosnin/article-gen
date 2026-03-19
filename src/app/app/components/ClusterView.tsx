"use client";

import { marked } from "marked";
import type { TopicCluster, ArticleSession } from "../types";
import { CopyButton } from "./CopyButton";
import { OutputCard } from "./OutputCard";

const STEPS = [
  "Organizing context & researching facts...",
  "Generating SEO metadata...",
  "Writing article & creating image prompts...",
  "Generating AI images...",
];

interface ClusterViewProps {
  activeCluster: TopicCluster;
  clusterActiveArticleId: string | null;
  onSelectArticle: (id: string | null) => void;
  resultView: "data" | "preview";
  onResultViewChange: (view: "data" | "preview") => void;
}

export function ClusterView({
  activeCluster,
  clusterActiveArticleId,
  onSelectArticle,
  resultView,
  onResultViewChange,
}: ClusterViewProps) {
  const activeClusterArticle: ArticleSession | null = clusterActiveArticleId
    ? clusterActiveArticleId === "pillar"
      ? activeCluster.pillarSession
      : activeCluster.clusterArticles.find((a) => a.id === clusterActiveArticleId)?.session ?? null
    : null;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Cluster header */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            Topic Cluster
          </h2>
          {activeCluster.generating && (
            <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: "rgba(0, 122, 255, 0.1)", color: "var(--accent)" }}>
              {activeCluster.generationPhase === "planning" ? "Planning cluster..." :
               activeCluster.generationPhase === "pillar" ? "Generating pillar..." :
               activeCluster.generationPhase === "clusters" ? "Generating cluster articles..." :
               activeCluster.generationPhase === "relinking" ? "Re-linking pillar page..." : ""}
            </span>
          )}
          {activeCluster.generationPhase === "done" && (
            <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: "rgba(52, 199, 89, 0.1)", color: "var(--success)" }}>
              Complete
            </span>
          )}
        </div>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {activeCluster.pillarKeyword || activeCluster.pillarTopic}
        </p>
      </div>

      {/* Overview — no article selected */}
      {!clusterActiveArticleId && (
        <div className="space-y-4">
          {/* Pillar card */}
          <div
            className="cursor-pointer rounded-xl border p-4 transition-colors"
            style={{ borderColor: "var(--accent)", background: "rgba(0, 122, 255, 0.04)" }}
            onClick={() => {
              if (activeCluster.pillarSession) onSelectArticle("pillar");
            }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: "var(--accent)" }}>
                Pillar
              </span>
              {activeCluster.pillarSession?.loading && (
                <svg className="progress-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
              )}
              {activeCluster.pillarSession?.result && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              )}
              {activeCluster.pillarSession?.error && (
                <span className="text-xs" style={{ color: "var(--error)" }}>Failed</span>
              )}
            </div>
            <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              {activeCluster.pillarSession?.result?.title || activeCluster.pillarTopic}
            </h3>
            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
              {activeCluster.pillarSession?.result?.focusKeyword || activeCluster.pillarKeyword}
            </p>
          </div>

          {/* Progress bar */}
          {activeCluster.clusterArticles.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--card-border)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    background: "var(--accent)",
                    width: `${(activeCluster.clusterArticles.filter((a) => a.session?.result).length / activeCluster.clusterArticles.length) * 100}%`,
                  }}
                />
              </div>
              <span className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                {activeCluster.clusterArticles.filter((a) => a.session?.result).length}/{activeCluster.clusterArticles.length}
              </span>
            </div>
          )}

          {/* Cluster articles grid */}
          {activeCluster.clusterArticles.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {activeCluster.clusterArticles.map((article, i) => (
                <div
                  key={article.id}
                  className="cursor-pointer rounded-xl border p-3 transition-all hover:shadow-sm"
                  style={{
                    borderColor: article.session?.loading ? "var(--accent)" : "var(--card-border)",
                    background: article.session?.loading ? "rgba(0, 122, 255, 0.03)" : "var(--card)",
                    opacity: article.session?.queued && !article.session?.loading ? 0.6 : 1,
                  }}
                  onClick={() => {
                    if (article.session?.result || article.session?.error) onSelectArticle(article.id);
                  }}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: "var(--muted)" }}>
                      #{i + 1}
                    </span>
                    {article.session?.loading && (
                      <svg className="progress-spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                    )}
                    {article.session?.result && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                    {article.session?.error && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    )}
                    {article.session?.queued && (
                      <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "var(--card-border)" }} />
                    )}
                  </div>
                  <h4 className="truncate text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {article.session?.result?.title || article.concept}
                  </h4>
                  <p className="mt-0.5 truncate text-xs" style={{ color: "var(--muted)" }}>
                    {article.keyword}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Planning state */}
          {activeCluster.generationPhase === "planning" && (
            <div className="flex flex-col items-center py-12">
              <svg className="progress-spinner mb-4" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Planning your topic cluster...</p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>Generating 30 strategically interlinked article ideas</p>
            </div>
          )}
        </div>
      )}

      {/* Viewing a specific cluster article */}
      {clusterActiveArticleId && activeClusterArticle && (
        <div>
          <button
            onClick={() => onSelectArticle(null)}
            className="mb-4 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            style={{ color: "var(--accent)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--card)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back to cluster overview
          </button>

          {clusterActiveArticleId === "pillar" && (
            <span className="mb-3 inline-block rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white" style={{ background: "var(--accent)" }}>
              Pillar Page
            </span>
          )}

          {activeClusterArticle.loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="mb-6">
                <div className="relative flex items-center justify-center gap-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="loading-dot h-2 w-2 rounded-full" style={{ background: "var(--accent)", animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
              <h2 className="mb-2 text-center text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                {activeClusterArticle.topic}
              </h2>
              <div className="mt-6 w-full max-w-xs space-y-3">
                {STEPS.map((step, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm" style={{ color: i <= activeClusterArticle.currentStep ? "var(--foreground)" : "var(--muted)", opacity: i <= activeClusterArticle.currentStep ? 1 : 0.4 }}>
                    {i < activeClusterArticle.currentStep ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : i === activeClusterArticle.currentStep ? (
                      <svg className="progress-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                    ) : (
                      <div className="h-4 w-4 rounded-full border" style={{ borderColor: "var(--card-border)" }} />
                    )}
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeClusterArticle.error && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(239, 68, 68, 0.1)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </div>
              <h2 className="mb-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>Generation Failed</h2>
              <p className="mb-6 max-w-sm text-center text-sm" style={{ color: "var(--muted)" }}>{activeClusterArticle.error}</p>
            </div>
          )}

          {activeClusterArticle.result && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
                  {activeClusterArticle.result.title}
                </h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onResultViewChange("data")}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    background: resultView === "data" ? "var(--accent)" : "var(--card)",
                    color: resultView === "data" ? "#fff" : "var(--foreground)",
                  }}
                >
                  Data
                </button>
                <button
                  onClick={() => onResultViewChange("preview")}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    background: resultView === "preview" ? "var(--accent)" : "var(--card)",
                    color: resultView === "preview" ? "#fff" : "var(--foreground)",
                  }}
                >
                  Preview
                </button>
              </div>
              {resultView === "data" ? (
                <div className="space-y-4">
                  <OutputCard label="Title" content={activeClusterArticle.result.title} />
                  <OutputCard label="Meta Description" content={activeClusterArticle.result.metaDescription} />
                  <OutputCard label="Slug" content={activeClusterArticle.result.slug} />
                  <OutputCard label="Focus Keyword" content={activeClusterArticle.result.focusKeyword} />
                  <OutputCard label="Keywords" content={activeClusterArticle.result.keywords.join(", ")} />
                  <OutputCard label="Article (Markdown)" content={activeClusterArticle.result.article} large />
                  {activeClusterArticle.result.imagePrompts.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--foreground)" }}>Image Prompts</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {activeClusterArticle.result.imagePrompts.map((img, i) => (
                          <div key={i} className="rounded-xl border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                            <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "var(--card-border)" }}>
                              <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>{img.type}</span>
                              <CopyButton text={img.prompt} label="Copy" />
                            </div>
                            <div className="space-y-2 px-3 py-2.5">
                              <div>
                                <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>Prompt</span>
                                <p className="text-xs leading-relaxed" style={{ color: "var(--foreground)" }}>{img.prompt}</p>
                              </div>
                              <div>
                                <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>Alt Text</span>
                                <p className="text-xs" style={{ color: "var(--foreground)" }}>{img.altText}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {activeClusterArticle.result.schema && (
                    <OutputCard label="JSON-LD Schema" content={activeClusterArticle.result.schema} large />
                  )}
                </div>
              ) : (
                <div>
                  <div className="mb-4 flex gap-2">
                    <CopyButton
                      text={activeClusterArticle.result.article.replace(/#{1,6}\s/g, "").replace(/\*\*/g, "").replace(/\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")}
                      label="Copy Plain Text"
                    />
                    <CopyButton
                      text={marked.parse(activeClusterArticle.result.article) as string}
                      label="Copy HTML"
                    />
                  </div>
                  <div
                    className="article-preview rounded-xl border p-6 sm:p-8"
                    style={{ background: "#fff", borderColor: "var(--card-border)" }}
                    dangerouslySetInnerHTML={{ __html: marked.parse(activeClusterArticle.result.article) as string }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
