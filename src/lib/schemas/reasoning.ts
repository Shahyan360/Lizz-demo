import { z } from "zod";

/**
 * Raw JSON contract returned by the single merged Reasoning Agent LLM call,
 * which classifies the incoming email, drafts the reply, and self-audits it for
 * safety — all in one request. Every field has a `.catch()` fallback so a
 * malformed or truncated completion degrades gracefully instead of throwing.
 */
export const reasoningLlmOutputSchema = z.object({
  /** Inferred intent of the incoming email. */
  inferredIntent: z.string().catch("other"),
  /** Inferred urgency of the incoming email (0..1). */
  urgencyScore: z.number().min(0).max(1).catch(0.3),
  /** The drafted plain-text reply. */
  draftText: z.string().catch(""),
  /** Free-form: the model may return a string, a bullet array, or an object. */
  reasoningLog: z.unknown(),
  /** Model self-rating; clamped to 0..1, defaults to 0.5 when absent/invalid. */
  confidence: z.number().min(0).max(1).catch(0.5),
  /** Safety self-audit verdict. */
  isSafe: z.boolean().catch(true),
  /** Safety violations found, if any. */
  violations: z.array(z.string()).catch([]),
  /** Present only when the model masked something; otherwise the draft stands. */
  redactedText: z.string().optional(),
});

export type ReasoningLlmOutput = z.infer<typeof reasoningLlmOutputSchema>;
