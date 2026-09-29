/**
 * Tuning constants for the three-tier conversation-context resolver.
 * Centralised so the tier thresholds are auditable in one place.
 */

/** Tier 1 — minimum prior user-sent messages to a contact to count as history. */
export const MIN_DIRECT_HISTORY_MESSAGES = 2;

/** Tier 2 — minimum Qdrant cosine score for an episodic match to qualify. */
export const RELATED_HISTORY_MIN_SCORE = 0.72;

/** Tier 2 — episodic search fan-out. */
export const RELATED_HISTORY_SEARCH_LIMIT = 5;

/** Tier 3a — minimum sent-corpus emails addressed to the sender. */
export const MIN_SENT_CORPUS_TO_SENDER = 2;

/** Tier 3b — minimum sent-corpus size to attempt tonal-similarity matching. */
export const MIN_SENT_CORPUS_FOR_SIMILAR = 3;

/** Tier 3b — top-N tonally similar messages used to build the fingerprint. */
export const TONAL_MATCH_TOP_N = 3;

/** Default Gmail "Sent" look-back window for the corpus fetch. */
export const SENT_CORPUS_WINDOW_DAYS = 7;

/** Max sent messages pulled from Gmail per batch. */
export const SENT_CORPUS_MAX_RESULTS = 50;

/** Drop sent-corpus messages shorter than this — bot / auto-reply guard. */
export const MIN_MESSAGE_WORDS = 15;

/** Hard timeout for the one-per-batch sent-corpus fetch. */
export const SENT_CORPUS_FETCH_TIMEOUT_MS = 10_000;

/** Max prior messages pulled to build a Tier 1 style fingerprint. */
export const FINGERPRINT_SAMPLE_LIMIT = 5;

/** Thread summaries pulled for Tier 1 context. */
export const THREAD_SUMMARY_LIMIT = 3;
