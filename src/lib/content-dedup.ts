/**
 * Content deduplication and cannibalization prevention utilities.
 * Combines vector similarity (via pgvector) with keyword overlap checks.
 */

/**
 * Normalize a keyword/topic string for comparison.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compute simple keyword overlap ratio between two strings (Jaccard).
 * Quick pre-filter before hitting the vector DB.
 */
export function keywordOverlapScore(a: string, b: string): number {
  const setA = new Set(normalizeText(a).split(" ").filter((w) => w.length > 2));
  const setB = new Set(normalizeText(b).split(" ").filter((w) => w.length > 2));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

/**
 * Deduplicate a list of proposed topics against each other (intra-plan dedup).
 * Removes items that are too similar to earlier items in the list.
 */
export function deduplicateWithinPlan<T extends { keyword: string; topic: string }>(
  items: T[],
  threshold = 0.4
): T[] {
  const kept: T[] = [];
  for (const item of items) {
    const tooSimilar = kept.some((k) => {
      const keywordSim = keywordOverlapScore(item.keyword, k.keyword);
      const topicSim = keywordOverlapScore(item.topic, k.topic);
      return keywordSim > threshold || topicSim > threshold;
    });
    if (!tooSimilar) kept.push(item);
  }
  return kept;
}

/**
 * Score a list of Exa research results for relevance to a niche,
 * returning a deduplicated set of title suggestions to avoid.
 */
export function extractCoveredTopics(
  exaResults: Array<{ title: string; score?: number }>
): string[] {
  return exaResults
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 30)
    .map((r) => r.title)
    .filter(Boolean);
}

/**
 * Given Exa-scraped covered topics and a proposed keyword/topic,
 * return true if the topic is too close to already-covered content.
 */
export function isCoveredByCompetitors(
  proposedKeyword: string,
  proposedTopic: string,
  coveredTopics: string[],
  threshold = 0.5
): boolean {
  return coveredTopics.some((covered) => {
    return (
      keywordOverlapScore(proposedKeyword, covered) > threshold ||
      keywordOverlapScore(proposedTopic, covered) > threshold
    );
  });
}
