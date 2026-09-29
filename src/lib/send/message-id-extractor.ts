import { GmailService, type GmailCredentials } from "../../services/gmail.service";
import type { GmailHeaders } from "../schemas/gmail";

/**
 * Resolves the RFC `Message-ID` of the email being replied to — used for the
 * `In-Reply-To` / `References` headers so the reply threads correctly in every
 * mail client (this is NOT the Gmail thread id).
 */

/**
 * Pulls the `Message-ID` header from a parsed Gmail header map. When the header
 * is absent (rare — some auto-generated mail omits it) a synthetic id is
 * constructed from the Gmail message id.
 */
export function extractMessageIdHeader(
  headers: GmailHeaders,
  gmailMessageId: string
): { messageId: string; wasFallback: boolean } {
  const raw = headers["message-id"]?.trim();
  if (raw && raw.length > 0) {
    const wrapped = raw.startsWith("<") ? raw : `<${raw}>`;
    return { messageId: wrapped, wasFallback: false };
  }
  return {
    messageId: `<${gmailMessageId}@mail.gmail.com>`,
    wasFallback: true,
  };
}

/**
 * Fetches the Gmail thread and returns the `Message-ID` of its latest incoming
 * message. Best-effort: returns `null` if the thread cannot be read, in which
 * case the reply is still sent (Gmail associates it via the thread id), just
 * without precise `In-Reply-To` headers.
 */
export async function resolveReplyMessageId(params: {
  gmailThreadId: string;
  credentials: GmailCredentials;
  accountEmail: string;
}): Promise<string | null> {
  try {
    const { messages } = await GmailService.fetchThreadMessages(
      params.gmailThreadId,
      params.credentials,
      params.accountEmail
    );
    const latestIncoming = [...messages].reverse().find((m) => m.isIncoming);
    if (!latestIncoming) {
      console.warn(
        `[message-id-extractor] no incoming message in thread ${params.gmailThreadId}`
      );
      return null;
    }
    const { messageId, wasFallback } = extractMessageIdHeader(
      latestIncoming.headers,
      latestIncoming.id
    );
    if (wasFallback) {
      console.warn(
        `[message-id-extractor] Message-ID header missing on ${latestIncoming.id}; ` +
          `using synthetic ${messageId}`
      );
    }
    return messageId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[message-id-extractor] thread fetch failed for ${params.gmailThreadId}: ${message}`
    );
    return null;
  }
}
