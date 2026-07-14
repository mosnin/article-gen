/**
 * Deterministic scrubber for AI-generated copy. Prompts forbid em/en dashes,
 * but models drift; this guarantees the output honors the rule.
 *
 * - Numeric ranges keep a plain hyphen (2020–2024 → 2020-2024).
 * - Spaced dashes become a comma pause ("fast — really fast" → "fast, really fast").
 * - Remaining dashes collapse to a comma+space.
 */
export function stripAiDashes(text: string): string {
  if (!text) return text;
  return text
    .replace(/(\d)\s*[–—]\s*(\d)/g, "$1-$2")
    .replace(/\s+[–—]\s+/g, ", ")
    .replace(/[–—]/g, ", ");
}
