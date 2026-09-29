import { z } from "zod";

/**
 * Zod schemas for data coming back from the Gmail API.
 *
 * Gmail payloads are loosely typed by `googleapis` (everything nullable). These
 * schemas are the single validation boundary: parse once, fail loudly if the
 * shape drifts, and hand typed data to the rest of the system.
 */

/** A single raw `{ name, value }` header entry as returned by Gmail. */
export const rawGmailHeaderSchema = z.object({
  name: z.string().nullish(),
  value: z.string().nullish(),
});

/**
 * The full `payload.headers` array, transformed into a flat lookup map keyed by
 * lower-cased header name. Repeated headers keep the first occurrence.
 */
export const gmailHeadersSchema = z
  .array(rawGmailHeaderSchema)
  .transform((entries): GmailHeaders => {
    const map: Record<string, string> = {};
    for (const entry of entries) {
      if (entry.name && entry.value != null) {
        const key = entry.name.toLowerCase();
        if (!(key in map)) {
          map[key] = entry.value;
        }
      }
    }
    return map;
  });

/** Header lookup map: lower-cased header name -> value. */
export type GmailHeaders = Record<string, string>;

/** Subset of a Gmail message we depend on, after validation. */
export const gmailMessageSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().nullish(),
  snippet: z.string().nullish(),
  labelIds: z.array(z.string()).nullish(),
});

export type GmailMessageMeta = z.infer<typeof gmailMessageSchema>;

/** Allowed look-back windows for a Gmail sync (maps to `newer_than:` queries). */
export const syncWindowSchema = z.enum(["1h", "6h", "1d", "7d"]);

export type SyncWindow = z.infer<typeof syncWindowSchema>;
