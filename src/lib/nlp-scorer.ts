/**
 * NLP content scoring — measures how well an article covers the semantic
 * territory of top-ranking competitor pages for a given keyword.
 */

export interface NLPScoreResult {
  overallScore: number;          // 0-100
  wordCountScore: number;        // 0-100 (vs recommended)
  nlpTermsCoverage: number;      // 0-100 (% of NLP terms present)
  readabilityScore: number;      // 0-100 (Flesch-Kincaid proxy)
  questionsCoverage: number;     // 0-100 (% of PAA questions addressed)
  recommendations: string[];     // actionable improvements
  missingNlpTerms: string[];     // NLP terms not found in content
  missingQuestions: string[];    // questions not addressed
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2);
}

function containsTerm(content: string, term: string): boolean {
  const normalContent = content.toLowerCase();
  const normalTerm = term.toLowerCase();
  return normalContent.includes(normalTerm);
}

function fleschKincaidProxy(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const syllables = words.reduce((acc, w) => {
    // Simple syllable estimation
    const matches = w.match(/[aeiouy]{1,2}/gi);
    return acc + Math.max(1, matches?.length ?? 1);
  }, 0);

  if (sentences.length === 0 || words.length === 0) return 50;

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;

  // Flesch Reading Ease
  const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
  return Math.min(100, Math.max(0, Math.round(score)));
}

export function scoreContent(params: {
  content: string;
  nlpTerms: string[];
  questionsToAnswer: string[];
  recommendedWordCount: number;
}): NLPScoreResult {
  const { content, nlpTerms, questionsToAnswer, recommendedWordCount } = params;

  const words = content.split(/\s+/).filter(w => w.length > 0);
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0;

  // Word count score
  const wcRatio = wordCount / Math.max(recommendedWordCount, 500);
  const wordCountScore = Math.min(100, Math.round(wcRatio * 100));

  // NLP terms coverage
  const foundTerms = nlpTerms.filter(t => containsTerm(content, t));
  const missingNlpTerms = nlpTerms.filter(t => !containsTerm(content, t));
  const nlpTermsCoverage = nlpTerms.length > 0
    ? Math.round((foundTerms.length / nlpTerms.length) * 100)
    : 100;

  // Questions coverage (check if any paragraph addresses each question's key terms)
  const foundQuestions = questionsToAnswer.filter(q => {
    const qTokens = tokenize(q).filter(t => t.length > 3);
    const matched = qTokens.filter(t => containsTerm(content, t));
    return matched.length >= Math.ceil(qTokens.length * 0.5); // 50% match threshold
  });
  const missingQuestions = questionsToAnswer.filter(q => !foundQuestions.includes(q));
  const questionsCoverage = questionsToAnswer.length > 0
    ? Math.round((foundQuestions.length / questionsToAnswer.length) * 100)
    : 100;

  // Readability
  const readabilityScore = fleschKincaidProxy(content);

  // Overall score (weighted)
  const overallScore = Math.round(
    wordCountScore * 0.25 +
    nlpTermsCoverage * 0.35 +
    readabilityScore * 0.20 +
    questionsCoverage * 0.20
  );

  // Recommendations
  const recommendations: string[] = [];
  if (wordCountScore < 80) recommendations.push(`Add ~${recommendedWordCount - wordCount} more words to match top-ranking competitors`);
  if (nlpTermsCoverage < 70) recommendations.push(`Include missing NLP terms: ${missingNlpTerms.slice(0, 5).join(", ")}`);
  if (readabilityScore < 50) recommendations.push("Simplify sentences — aim for shorter, clearer sentences (aim for < 20 words per sentence)");
  if (readabilityScore > 80) recommendations.push("Add more depth — content reads too simply, add technical depth for E-E-A-T");
  if (questionsCoverage < 60) recommendations.push(`Answer missing questions: "${missingQuestions.slice(0, 3).join('", "')}"`);
  if (avgSentenceLength > 25) recommendations.push("Break up long sentences to improve readability");

  return {
    overallScore,
    wordCountScore,
    nlpTermsCoverage,
    readabilityScore,
    questionsCoverage,
    recommendations,
    missingNlpTerms: missingNlpTerms.slice(0, 15),
    missingQuestions: missingQuestions.slice(0, 8),
    wordCount,
    sentenceCount,
    avgSentenceLength: Math.round(avgSentenceLength),
  };
}
