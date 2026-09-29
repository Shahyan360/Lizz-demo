import { z } from "zod";
import { styleFingerprintSchema } from "./style-fingerprint";

/**
 * Three-tier conversation context resolved per incoming email. The tier
 * decides which corpus the Reasoning Agent mimics:
 *
 *  Tier 1  `direct_history`         — prior user replies to THIS sender (Postgres)
 *  Tier 2  `related_history`        — tonally similar past replies (Qdrant)
 *  Tier 3a `sent_corpus_to_sender`  — Gmail "Sent" mail addressed to this sender
 *  Tier 3b `sent_corpus_similar`    — Gmail "Sent" mail tonally similar to this email
 *  Tier 3c `cold_start`             — nothing usable; fall back to profile defaults
 *
 * The Reasoning Agent branches on `context.tier`.
 */

/** Tier 1 — direct correspondence history with the sender. */
export const directHistorySignalsSchema = z.object({
  contactName: z.string(),
  relationshipScore: z.number(),
  formalityLevel: z.number(),
  interactionCount: z.number(),
  notes: z.string(),
  recentSummaries: z.array(z.string()),
  userSentMessageCount: z.number(),
  fingerprint: styleFingerprintSchema,
});

/** Tier 2 — semantically related past conversations (tone signals only, no PII). */
export const relatedHistorySignalsSchema = z.object({
  matchCount: z.number(),
  topScore: z.number(),
  fingerprint: styleFingerprintSchema,
});

/** Tier 3a / 3b — fingerprint sourced from the Gmail "Sent" corpus. */
export const sentCorpusSignalsSchema = z.object({
  source: z.enum(["to_sender", "tonal_similarity"]),
  matchedMessageCount: z.number(),
  corpusSize: z.number(),
  fingerprint: styleFingerprintSchema,
});

/** Tier 3c — no usable corpus. */
export const coldStartSignalsSchema = z.object({
  reason: z.string(),
  sentCorpusSize: z.number(),
});

export const conversationContextSchema = z.discriminatedUnion("tier", [
  z.object({
    tier: z.literal("direct_history"),
    signals: directHistorySignalsSchema,
  }),
  z.object({
    tier: z.literal("related_history"),
    signals: relatedHistorySignalsSchema,
  }),
  z.object({
    tier: z.literal("sent_corpus_to_sender"),
    signals: sentCorpusSignalsSchema,
  }),
  z.object({
    tier: z.literal("sent_corpus_similar"),
    signals: sentCorpusSignalsSchema,
  }),
  z.object({
    tier: z.literal("cold_start"),
    signals: coldStartSignalsSchema,
  }),
]);

export type DirectHistorySignals = z.infer<typeof directHistorySignalsSchema>;
export type RelatedHistorySignals = z.infer<typeof relatedHistorySignalsSchema>;
export type SentCorpusSignals = z.infer<typeof sentCorpusSignalsSchema>;
export type ColdStartSignals = z.infer<typeof coldStartSignalsSchema>;
export type ConversationContext = z.infer<typeof conversationContextSchema>;
export type ConversationTier = ConversationContext["tier"];
