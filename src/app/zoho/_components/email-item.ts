import type { ZohoEmail } from "../../../lib/schemas/zoho";

/**
 * A JSON-safe, display-ready email row shared by the server page and the
 * `/api/zoho/emails` route. `receivedAt` is pre-formatted to a string here so
 * no `Date` needs to cross the server→client / HTTP boundary.
 */
export interface EmailItem {
  messageId: string;
  /** Owning folder — lets cross-folder search results open/act correctly. */
  folderId: string;
  senderName: string;
  from: string;
  to: string;
  subject: string;
  summary: string;
  receivedAtLabel: string;
}

/** How many emails each page (initial load and each "Load More") fetches. */
export const EMAIL_PAGE_SIZE = 30;

/** A message attachment as shown in the opened-email view. */
export interface EmailAttachment {
  attachmentId: string;
  attachmentName: string;
  attachmentSize: number;
  isInline: boolean;
  /** Content-ID for inline images — matches `<img src="cid:…">` in the body. */
  cid?: string;
}

function formatLabel(date: Date): string {
  try {
    return date.toLocaleString();
  } catch {
    return "";
  }
}

/** Maps a raw `ZohoEmail` into the display-ready `EmailItem`. */
export function toEmailItem(email: ZohoEmail): EmailItem {
  return {
    messageId: email.messageId,
    folderId: email.folderId,
    senderName: email.senderName,
    from: email.from,
    to: email.to,
    subject: email.subject,
    summary: email.summary,
    receivedAtLabel: formatLabel(email.receivedAt),
  };
}
