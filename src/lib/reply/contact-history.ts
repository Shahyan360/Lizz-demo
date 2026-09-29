import { ZohoService } from "../../services/zoho.service";

/**
 * Builds conversation context about a contact so the reply generator understands
 * the ongoing relationship — e.g. WHY a sender is frustrated — instead of
 * replying to the latest message in isolation.
 *
 * Two sources, neither of which needs the email history persisted in the DB:
 *   1. This thread's earlier messages, taken from the quoted history in the
 *      incoming email (always present on a reply, no API call).
 *   2. The contact's recent messages across other threads, fetched live from
 *      Zoho (their side of past conversations).
 */

/** Markers where an email's quoted reply history begins. */
const QUOTE_MARKERS: RegExp[] = [
  /-{2,}\s*On\b[\s\S]{0,300}?wrote\s*-{2,}/i, // Zoho "---- On <date> X wrote ----"
  /\bOn\b[\s\S]{0,200}?\bwrote:/i, // Gmail "On <date> X wrote:"
  /[-=]{2,}\s*Original Message\s*[-=]{2,}/i, // Outlook
  /^\s*From:\s.+@/im, // forwarded/quoted header block
];

/** Splits an email body into its newest message and the quoted history below. */
export function splitThread(text: string): { latest: string; prior: string } {
  let idx = -1;
  for (const re of QUOTE_MARKERS) {
    const m = text.match(re);
    if (m && m.index != null && (idx === -1 || m.index < idx)) idx = m.index;
  }
  if (idx <= 0) return { latest: text.trim(), prior: "" };
  return { latest: text.slice(0, idx).trim(), prior: text.slice(idx).trim() };
}

const MAX_PRIOR_CHARS = 15000;
const MAX_CONTEXT_CHARS = 26000;

/**
 * Returns a plain-text conversation-context block for the given contact, or ""
 * when there's nothing useful. Never throws — a lookup failure degrades to just
 * the in-email thread history.
 */
export async function buildContactContext(params: {
  fromAddress: string;
  /** The full incoming body (plain text), including any quoted history. */
  bodyText: string;
  currentMessageId?: string;
  accountId?: string;
}): Promise<string> {
  const pieces: string[] = [];

  // 1. Earlier messages in THIS thread (from the quoted history).
  const { prior } = splitThread(params.bodyText);
  if (prior) {
    pieces.push(`Earlier in this thread:\n${prior.slice(0, MAX_PRIOR_CHARS)}`);
  }

  // 2. This contact's recent messages across other threads (live from Zoho).
  //    Fetch BOTH directions: messages FROM the customer AND messages WE SENT
  //    TO the customer, so the LLM sees the full conversation (including any
  //    templates or declines Lizzz already sent).
  const address = params.fromAddress.trim();
  if (address) {
    try {
      const [fromThem, toThem] = await Promise.all([
        ZohoService.searchMessages({
          searchKey: `sender:${address}`,
          accountId: params.accountId,
          limit: 6,
        }),
        ZohoService.searchMessages({
          searchKey: `toAddress:${address}`,
          accountId: params.accountId,
          limit: 6,
        }),
      ]);

      const allMessages = [...fromThem, ...toThem]
        .filter((m) => m.messageId !== params.currentMessageId)
        .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
        .filter((m, i, arr) => arr.findIndex((x) => x.messageId === m.messageId) === i)
        .slice(0, 6);

      const formatted = allMessages.map((m) => {
        const date = m.receivedAt.toLocaleDateString();
        const direction = m.from.toLowerCase().includes(address.toLowerCase())
          ? "FROM customer"
          : "FROM Lizzz (our reply)";
        const preview = (m.summary || "").replace(/\s+/g, " ").slice(0, 200);
        return `- (${date}) [${direction}] "${m.subject}" — ${preview}`;
      });

      if (formatted.length > 0) {
        pieces.push(`Recent messages with this contact:\n${formatted.join("\n")}`);
      }
    } catch (err) {
      console.warn("[contact-history] recent-message lookup failed:", err);
    }
  }

  return pieces.join("\n\n").slice(0, MAX_CONTEXT_CHARS);
}
