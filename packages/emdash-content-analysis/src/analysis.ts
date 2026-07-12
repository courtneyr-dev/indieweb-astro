/**
 * Content Analysis — pure text-analysis functions.
 *
 * Yoast-style readability and keyphrase checks:
 * - Flesch Reading Ease (English heuristic syllable counting)
 * - sentence-length distribution
 * - paragraph-length check
 * - keyphrase density / placement checks
 *
 * All functions are pure so they can run identically in trusted and
 * sandboxed plugin modes and be unit-tested without a plugin context.
 */

// ─── Text segmentation ─────────────────────────────────────────────────────

/** Split text into words (letters/digits/apostrophes; hyphens split). */
export function splitWords(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+(?:'[\p{L}]+)?/gu) ?? [];
}

/** Split text into sentences on terminal punctuation or blank lines. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n{2,}/u)
    .map((s) => s.trim())
    .filter((s) => splitWords(s).length > 0);
}

/** Split text into paragraphs on blank lines. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

// ─── Syllables and Flesch Reading Ease ─────────────────────────────────────

/**
 * Heuristic English syllable count for one word.
 *
 * Counts vowel groups, then applies common corrections (silent trailing
 * "e", "-le" endings, "-ed" endings). Accurate enough for aggregate
 * readability scoring; not a dictionary lookup.
 */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;

  let stripped = w
    // silent "-ed" after a consonant other than d/t: "walked", "played"
    .replace(/([^aeiouydt])ed$/, "$1")
    // silent trailing "e": "make", but keep "-le" as in "table"
    .replace(/([^aeiouyl])e$/, "$1")
    .replace(/^y/, "");

  const groups = stripped.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Flesch Reading Ease score for a text, clamped to 0–100. */
export function fleschReadingEase(text: string): number {
  const sentences = splitSentences(text);
  const words = splitWords(text);
  if (sentences.length === 0 || words.length === 0) return 0;

  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const score =
    206.835 -
    1.015 * (words.length / sentences.length) -
    84.6 * (syllables / words.length);
  return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10;
}

/** Human-readable band for a Flesch Reading Ease score. */
export function fleschBand(score: number): string {
  if (score >= 90) return "very easy";
  if (score >= 80) return "easy";
  if (score >= 70) return "fairly easy";
  if (score >= 60) return "standard";
  if (score >= 50) return "fairly difficult";
  if (score >= 30) return "difficult";
  return "very difficult";
}

// ─── Keyphrase ─────────────────────────────────────────────────────────────

export interface KeyphraseStats {
  /** Occurrences of the whole phrase (word-boundary, case-insensitive). */
  count: number;
  /** Occurrences per 100 words of body text. */
  density: number;
}

/** Count keyphrase occurrences and density (per 100 words). */
export function keyphraseDensity(
  text: string,
  keyphrase: string,
): KeyphraseStats {
  const words = splitWords(text);
  const phraseWords = splitWords(keyphrase.toLowerCase());
  if (words.length === 0 || phraseWords.length === 0) {
    return { count: 0, density: 0 };
  }

  const lowered = words.map((w) => w.toLowerCase());
  let count = 0;
  for (let i = 0; i <= lowered.length - phraseWords.length; i++) {
    if (phraseWords.every((pw, j) => lowered[i + j] === pw)) count++;
  }

  return {
    count,
    density: Math.round((count / words.length) * 100 * 100) / 100,
  };
}

/** Whether a text contains the keyphrase (word-boundary, case-insensitive). */
export function containsKeyphrase(text: string, keyphrase: string): boolean {
  return keyphraseDensity(text, keyphrase).count > 0;
}

// ─── Portable Text extraction ──────────────────────────────────────────────

/**
 * Extract plain text from EmDash Portable Text blocks.
 * Paragraph blocks are joined with blank lines so paragraph and sentence
 * segmentation keep working downstream.
 */
export function extractPortableText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";

  const paragraphs: string[] = [];
  for (const block of blocks) {
    if (typeof block !== "object" || block === null) continue;
    const b = block as Record<string, unknown>;
    if (!Array.isArray(b.children)) continue;

    const parts: string[] = [];
    for (const child of b.children) {
      if (typeof child === "object" && child !== null) {
        const text = (child as Record<string, unknown>).text;
        if (typeof text === "string") parts.push(text);
      }
    }
    const paragraph = parts.join("").trim();
    if (paragraph) paragraphs.push(paragraph);
  }

  return paragraphs.join("\n\n");
}

// ─── Aggregate analysis ────────────────────────────────────────────────────

export type CheckStatus = "good" | "ok" | "poor";

export interface AnalysisCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface AnalysisResult {
  wordCount: number;
  sentenceCount: number;
  fleschScore: number;
  fleschBand: string;
  keyphrase?: KeyphraseStats;
  checks: AnalysisCheck[];
}

export interface AnalyzeInput {
  /** Post title (may be empty for notes and other title-less kinds). */
  title?: string;
  /** Plain body text (use extractPortableText for Portable Text). */
  text: string;
  /** Optional focus keyphrase for SEO checks. */
  keyphrase?: string;
}

const LONG_SENTENCE_WORDS = 20;
const LONG_SENTENCE_MAX_RATIO = 0.25;
const LONG_PARAGRAPH_WORDS = 150;
const MIN_ARTICLE_WORDS = 300;
const DENSITY_MIN = 0.5;
const DENSITY_MAX = 3;

/** Run all readability + keyphrase checks over a piece of content. */
export function analyzeContent(input: AnalyzeInput): AnalysisResult {
  const text = input.text.trim();
  const words = splitWords(text);
  const sentences = splitSentences(text);
  const paragraphs = splitParagraphs(text);
  const checks: AnalysisCheck[] = [];

  // Word count
  checks.push({
    id: "word-count",
    label: "Word count",
    status:
      words.length >= MIN_ARTICLE_WORDS
        ? "good"
        : words.length >= 50
          ? "ok"
          : "poor",
    detail:
      words.length >= MIN_ARTICLE_WORDS
        ? `${words.length} words — enough substance for search engines.`
        : `${words.length} words. Short posts (notes, replies) are fine; aim for ${MIN_ARTICLE_WORDS}+ on articles.`,
  });

  // Flesch Reading Ease
  const flesch = fleschReadingEase(text);
  const band = fleschBand(flesch);
  checks.push({
    id: "flesch",
    label: "Flesch Reading Ease",
    status: flesch >= 60 ? "good" : flesch >= 50 ? "ok" : "poor",
    detail: `Score ${flesch} (${band}). 60+ reads comfortably for a general audience.`,
  });

  // Sentence length
  const longSentences = sentences.filter(
    (s) => splitWords(s).length > LONG_SENTENCE_WORDS,
  ).length;
  const longRatio = sentences.length > 0 ? longSentences / sentences.length : 0;
  checks.push({
    id: "sentence-length",
    label: "Sentence length",
    status:
      longRatio <= LONG_SENTENCE_MAX_RATIO
        ? "good"
        : longRatio <= 0.4
          ? "ok"
          : "poor",
    detail: `${longSentences} of ${sentences.length} sentences exceed ${LONG_SENTENCE_WORDS} words (${Math.round(longRatio * 100)}%). Keep this at or below ${LONG_SENTENCE_MAX_RATIO * 100}%.`,
  });

  // Paragraph length
  const longParagraphs = paragraphs.filter(
    (p) => splitWords(p).length > LONG_PARAGRAPH_WORDS,
  ).length;
  checks.push({
    id: "paragraph-length",
    label: "Paragraph length",
    status: longParagraphs === 0 ? "good" : longParagraphs <= 2 ? "ok" : "poor",
    detail:
      longParagraphs === 0
        ? `All ${paragraphs.length} paragraphs stay under ${LONG_PARAGRAPH_WORDS} words.`
        : `${longParagraphs} paragraph(s) exceed ${LONG_PARAGRAPH_WORDS} words — consider splitting them.`,
  });

  // Keyphrase checks (only when a keyphrase is provided)
  let keyphraseStats: KeyphraseStats | undefined;
  const keyphrase = input.keyphrase?.trim();
  if (keyphrase) {
    keyphraseStats = keyphraseDensity(text, keyphrase);

    const densityOk =
      keyphraseStats.density >= DENSITY_MIN &&
      keyphraseStats.density <= DENSITY_MAX;
    checks.push({
      id: "keyphrase-density",
      label: "Keyphrase density",
      status: densityOk ? "good" : keyphraseStats.count > 0 ? "ok" : "poor",
      detail:
        keyphraseStats.count === 0
          ? `"${keyphrase}" does not appear in the text.`
          : `"${keyphrase}" appears ${keyphraseStats.count}× (${keyphraseStats.density}% density). Aim for ${DENSITY_MIN}–${DENSITY_MAX}%.`,
    });

    const title = input.title?.trim() ?? "";
    checks.push({
      id: "keyphrase-title",
      label: "Keyphrase in title",
      status: title
        ? containsKeyphrase(title, keyphrase)
          ? "good"
          : "poor"
        : "ok",
      detail: title
        ? containsKeyphrase(title, keyphrase)
          ? "The focus keyphrase appears in the title."
          : "The focus keyphrase is missing from the title."
        : "This post has no title (fine for notes and similar kinds).",
    });

    const firstParagraph = paragraphs[0] ?? "";
    checks.push({
      id: "keyphrase-intro",
      label: "Keyphrase in introduction",
      status: containsKeyphrase(firstParagraph, keyphrase) ? "good" : "ok",
      detail: containsKeyphrase(firstParagraph, keyphrase)
        ? "The focus keyphrase appears in the first paragraph."
        : "Consider using the focus keyphrase in the first paragraph.",
    });
  }

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    fleschScore: flesch,
    fleschBand: band,
    keyphrase: keyphraseStats,
    checks,
  };
}
