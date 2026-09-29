import { z } from "zod";

/**
 * Quantified writing-style fingerprint extracted from a corpus of the user's
 * own messages. Every numeric field is coerced to a finite number — NaN /
 * Infinity from an empty or tiny corpus collapses to 0 — so a fingerprint can
 * never inject a malformed value into an LLM prompt.
 */

/** A finite number; NaN / Infinity / non-numbers fall back to 0. */
const safeNumber = z.number().finite().catch(0);

export const styleFingerprintSchema = z.object({
  /** Mean words per sentence across the corpus. */
  avgSentenceLength: safeNumber,
  /** Mean word count per message. */
  avgMessageLength: safeNumber,
  /** Up to 3 most common opening lines. */
  greetingPatterns: z.array(z.string()).catch([]),
  /** Up to 3 most common closing lines. */
  signoffPatterns: z.array(z.string()).catch([]),
  /** Up to 10 most frequent two-word phrases (stopwords removed). */
  frequentBigrams: z.array(z.string()).catch([]),
  /** Ratio of contraction words to total words (0..1). */
  contractionRate: safeNumber,
  /** Fraction of sentences ending in "?" (0..1). */
  questionRate: safeNumber,
  /** Fraction of sentences ending in "!" (0..1). */
  exclamationRate: safeNumber,
  /** Up to 2 longest non-greeting / non-signoff sentences — concrete examples. */
  sampleSnippets: z.array(z.string()).catch([]),
});

export type StyleFingerprint = z.infer<typeof styleFingerprintSchema>;
