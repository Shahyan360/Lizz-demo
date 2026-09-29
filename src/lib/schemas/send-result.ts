import { z } from "zod";

/**
 * Contracts for the reply-send pipeline.
 *
 * `sendResultSchema` — the discriminated outcome every send flow returns;
 * callers branch on `status` deterministically.
 * `sendParamsSchema` — the validated parameters handed to `GmailService.sendDraft`;
 * this is the boundary that rejects malformed recipients / empty drafts.
 */

export const sendResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("sent"),
    messageId: z.string(),
    threadId: z.string(),
    sentAt: z.date(),
  }),
  z.object({
    status: z.literal("skipped"),
    reason: z.enum(["already_sent", "wrong_status"]),
  }),
  z.object({
    status: z.literal("failed"),
    reason: z.string(),
    retriable: z.boolean(),
  }),
]);

export type SendResult = z.infer<typeof sendResultSchema>;

export const sendParamsSchema = z.object({
  /** Gmail thread id the reply is associated with. */
  threadId: z.string().optional(),
  /** Recipient address — validated as a real email (malformed → send fails). */
  to: z.string().email(),
  /** Reply subject (already prefixed with "Re:" by the subject builder). */
  subject: z.string().min(1),
  /** Reply body — an empty draft cannot be sent. */
  bodyText: z.string().min(1),
  /** Optional HTML body; `GmailService` auto-generates from text when absent. */
  bodyHtml: z.string().optional(),
  /** RFC `Message-ID` of the message being replied to (threading headers). */
  inReplyTo: z.string().optional(),
  references: z.string().optional(),
});

export type SendParams = z.infer<typeof sendParamsSchema>;
