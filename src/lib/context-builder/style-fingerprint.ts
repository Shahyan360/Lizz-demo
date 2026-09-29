import {
  styleFingerprintSchema,
  type StyleFingerprint,
} from "../schemas/style-fingerprint";

/**
 * Pure style-fingerprint extraction — no I/O. Quantifies how the user writes
 * (sentence length, greetings, sign-offs, characteristic phrases, punctuation
 * habits) from a corpus of their own messages.
 */

/** Inline ~30-word stopword list — kept local to avoid a dependency. */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "at", "for",
  "with", "is", "are", "was", "were", "be", "been", "i", "you", "we", "they",
  "it", "this", "that", "my", "your", "our", "as", "so", "if",
]);

/** A word containing an apostrophe-style contraction (don't, we'll, it's). */
const CONTRACTION_RE = /[a-z]+['’][a-z]+/i;

function words(text: string): string[] {
  return text.split(/\s+/).map((w) => w.trim()).filter(Boolean);
}

function nonEmptyLines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function topByFrequency(items: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([item]) => item);
}

function containsForbidden(text: string, forbidden: Set<string>): boolean {
  if (forbidden.size === 0) return false;
  return words(text).some((w) =>
    forbidden.has(w.toLowerCase().replace(/[^a-z0-9']/g, ""))
  );
}

/**
 * Builds a {@link StyleFingerprint} from the user's messages. Empty or tiny
 * corpora yield safe zeros (the schema coerces any NaN/Infinity). Bigrams and
 * snippets containing a forbidden word are filtered out before exposure.
 */
export function extractStyleFingerprint(
  messages: { bodyText: string }[],
  forbiddenWords: string[] = []
): StyleFingerprint {
  const forbidden = new Set(
    forbiddenWords.map((w) => w.trim().toLowerCase()).filter(Boolean)
  );

  const allSentences: string[] = [];
  const greetingLines: string[] = [];
  const signoffLines: string[] = [];
  const bigramCounts = new Map<string, number>();
  const messageWordCounts: number[] = [];
  let contractionCount = 0;
  let totalWords = 0;

  for (const { bodyText } of messages) {
    const lines = nonEmptyLines(bodyText);
    if (lines.length === 0) continue;
    greetingLines.push(lines[0]);
    signoffLines.push(lines[lines.length - 1]);

    const msgWords = words(bodyText);
    messageWordCounts.push(msgWords.length);
    totalWords += msgWords.length;
    for (const w of msgWords) {
      if (CONTRACTION_RE.test(w)) contractionCount++;
    }

    allSentences.push(...splitSentences(bodyText));

    const tokens = msgWords
      .map((w) => w.toLowerCase().replace(/[^a-z0-9']/g, ""))
      .filter((w) => w.length > 1 && !STOPWORDS.has(w));
    for (let i = 0; i < tokens.length - 1; i++) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      if (bigram.split(" ").some((w) => forbidden.has(w))) continue;
      bigramCounts.set(bigram, (bigramCounts.get(bigram) ?? 0) + 1);
    }
  }

  const sentenceWordTotal = allSentences.reduce(
    (sum, s) => sum + words(s).length,
    0
  );
  const sentenceCount = allSentences.length;
  const boilerplate = new Set([...greetingLines, ...signoffLines]);

  return styleFingerprintSchema.parse({
    avgSentenceLength: sentenceCount ? sentenceWordTotal / sentenceCount : 0,
    avgMessageLength: messageWordCounts.length
      ? totalWords / messageWordCounts.length
      : 0,
    greetingPatterns: topByFrequency(greetingLines, 3),
    signoffPatterns: topByFrequency(signoffLines, 3),
    frequentBigrams: [...bigramCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([bigram]) => bigram),
    contractionRate: totalWords ? contractionCount / totalWords : 0,
    questionRate: sentenceCount
      ? allSentences.filter((s) => s.endsWith("?")).length / sentenceCount
      : 0,
    exclamationRate: sentenceCount
      ? allSentences.filter((s) => s.endsWith("!")).length / sentenceCount
      : 0,
    sampleSnippets: allSentences
      .filter((s) => !boilerplate.has(s))
      .filter((s) => !containsForbidden(s, forbidden))
      .sort((a, b) => words(b).length - words(a).length)
      .slice(0, 2),
  });
}
