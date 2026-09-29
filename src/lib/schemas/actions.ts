import { z } from "zod";

/**
 * Zod schemas for server-action inputs (form data / typed args).
 *
 * NOTE: model ids in this project are generated with Prisma `@default(uuid())`,
 * so id fields are validated as UUIDs (not CUIDs).
 */

/** Validates an `accountId` field — used by Gmail account mutations. */
export const accountIdSchema = z.object({
  accountId: z.string().uuid(),
});

/** Validates a draft edit payload. */
export const draftEditSchema = z.object({
  draftId: z.string().uuid(),
  text: z.string().min(1),
});

/**
 * Validates the draft id submitted by the `approveDraft` / `retryDraftSend`
 * form actions. The id is read from raw `FormData`, so it is never trusted.
 */
export const approveDraftSchema = z.object({
  draftId: z.string().uuid(),
});

/** Validates the communication-profile (tone) form. */
export const toneProfileSchema = z.object({
  greetingStyle: z.string().min(1),
  signoffStyle: z.string().min(1),
  avgSentenceLen: z.coerce.number().int().min(1).max(100),
  formalityScale: z.coerce.number().min(0).max(1),
  vocabularyPref: z.array(z.string()),
  forbiddenWords: z.array(z.string()),
});

export type ToneProfileInput = z.infer<typeof toneProfileSchema>;
