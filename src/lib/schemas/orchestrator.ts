import { z } from "zod";
import { ReviewLevel } from "@prisma/client";

/**
 * Input/output contract for `MultiAgentOrchestrator.execute()`.
 *
 * The result is a discriminated union: an incoming email is either classified
 * as not-worth-drafting (`skipped`) or run through the full agent pipeline
 * (`drafted`). Every caller must handle both variants.
 */

export const orchestratorInputSchema = z.object({
  /** Gmail thread id (also the `EmailThread.id`). */
  threadId: z.string().min(1),
  /** Raw `From` header of the incoming message. */
  sender: z.string().min(1),
  /** Raw decoded body text of the incoming message. */
  rawBody: z.string(),
  /** Normalized thread subject (reply/forward prefixes stripped). */
  subject: z.string().optional(),
  /** Short preview snippet for the thread. */
  snippet: z.string().optional(),
  /** Raw per-message subject for the `EmailMessage` row. */
  messageSubject: z.string().optional(),
  /** Parsed Gmail headers of the incoming message (classifier input). */
  headers: z.record(z.string()).optional(),
  /** Gmail label ids on the incoming message (classifier input). */
  labelIds: z.array(z.string()).optional(),
});

export type OrchestratorInput = z.infer<typeof orchestratorInputSchema>;

export const orchestratorResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("skipped"),
    /** Human-readable explanation of why no draft was produced. */
    reason: z.string(),
    /** Classifier category (`promotional` | `automated` | `transactional`). */
    category: z.string(),
    /** Id of the persisted incoming `EmailMessage`. */
    messageId: z.string(),
  }),
  z.object({
    status: z.literal("drafted"),
    draftId: z.string(),
    draftText: z.string(),
    confidence: z.number(),
    reviewLevel: z.nativeEnum(ReviewLevel),
  }),
]);

export type OrchestratorResult = z.infer<typeof orchestratorResultSchema>;
