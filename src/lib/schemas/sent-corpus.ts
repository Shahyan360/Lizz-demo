import { z } from "zod";

/**
 * The user's recent Gmail "Sent" mail, fetched at most ONCE per batch sync and
 * threaded through the pipeline as a fresh style corpus for cold-start drafts
 * (Tier 3). See `src/lib/context-builder/sent-corpus.ts`.
 */

export const sentCorpusMessageSchema = z.object({
  /** Gmail message id. */
  messageId: z.string().min(1),
  /** Gmail thread id this message belongs to. */
  threadId: z.string().min(1),
  /** Lowercased, deduped recipient addresses (To + Cc). */
  recipients: z.array(z.string()),
  /** Raw message subject. */
  subject: z.string(),
  /** Plain-text body, signature / quote-block stripped. */
  bodyText: z.string(),
  /** When the message was sent. */
  sentAt: z.date(),
  /**
   * Lazily-populated embedding cache for Tier 3b tonal ranking. Computed once
   * per batch on first use, then reused across every email in the same sync.
   */
  embedding: z.array(z.number()).optional(),
});

export const sentCorpusSchema = z.object({
  fetchedAt: z.date(),
  windowDays: z.number().int().positive(),
  /** Chronological, newest first. */
  messages: z.array(sentCorpusMessageSchema),
});

export type SentCorpusMessage = z.infer<typeof sentCorpusMessageSchema>;
export type SentCorpus = z.infer<typeof sentCorpusSchema>;
