"use client";

interface IdeasModalProps {
  niche: string;
  count: number;
  loading: boolean;
  results: Array<{ concept: string; keyword: string }>;
  onNicheChange: (value: string) => void;
  onCountChange: (value: number) => void;
  onGenerate: () => void;
  onLoadToBatch: () => void;
  onClose: () => void;
}

export function IdeasModal({
  niche,
  count,
  loading,
  results,
  onNicheChange,
  onCountChange,
  onGenerate,
  onLoadToBatch,
  onClose,
}: IdeasModalProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }} />
      <div
        className="relative mx-4 w-full max-w-md rounded-2xl border shadow-2xl"
        style={{ background: "var(--background)", borderColor: "var(--card-border)", animation: "modal-enter 0.25s cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--card-border)" }}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "var(--card)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18h6" />
                <path d="M10 22h4" />
                <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Generate Ideas</h3>
              <p className="text-xs" style={{ color: "var(--muted)" }}>AI-powered article idea generation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
            style={{ color: "var(--muted)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--card)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Niche
            </label>
            <input
              type="text"
              value={niche}
              onChange={(e) => onNicheChange(e.target.value)}
              placeholder="e.g., sustainable living, digital marketing, pet care"
              className="w-full rounded-xl border px-4 py-3 text-sm transition-colors focus:outline-none"
              style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--accent)"; }}
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--card-border)"; }}
              onKeyDown={(e) => { if (e.key === "Enter") onGenerate(); }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Number of ideas
            </label>
            <input
              type="number"
              min={1}
              max={25}
              value={count}
              onChange={(e) => onCountChange(Math.min(25, Math.max(1, Number(e.target.value))))}
              className="w-full rounded-xl border px-4 py-3 text-sm transition-colors focus:outline-none"
              style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--accent)"; }}
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--card-border)"; }}
            />
          </div>
          <button
            onClick={onGenerate}
            disabled={!niche.trim() || loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-colors disabled:opacity-40"
            style={{ background: "var(--accent)" }}
            onMouseEnter={(e) => { if (!(!niche.trim() || loading)) (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-hover)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--accent)"; }}
          >
            {loading ? (
              <>
                <svg className="progress-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                Generating...
              </>
            ) : (
              "Generate Ideas"
            )}
          </button>

          {results.length > 0 && (
            <div className="rounded-xl border" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
              <div className="px-4 py-3">
                <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                  {results.length} ideas generated
                </span>
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto border-t px-3 py-2" style={{ borderColor: "var(--card-border)" }}>
                {results.map((idea, i) => (
                  <div key={i} className="rounded-lg px-3 py-2.5" style={{ background: "var(--background)" }}>
                    <span className="block text-sm font-medium" style={{ color: "var(--foreground)" }}>{idea.concept}</span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>{idea.keyword}</span>
                  </div>
                ))}
              </div>
              <div className="border-t px-4 py-3" style={{ borderColor: "var(--card-border)" }}>
                <button
                  onClick={onLoadToBatch}
                  className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-colors"
                  style={{ background: "var(--accent)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-hover)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--accent)"; }}
                >
                  Load into Batch Mode
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
