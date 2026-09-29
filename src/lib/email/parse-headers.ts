/**
 * Minimal RFC 5322 header parsing for the raw header block Zoho returns
 * (`ZohoService.getEmailHeader`). The Zoho webhook payload carries no headers,
 * so we fetch and parse them here to feed the deterministic email classifier
 * (which looks up List-Unsubscribe, Precedence, Auto-Submitted, X-Mailer, …).
 */

/**
 * Parses a raw header block into a `{ lowercased-name: value }` map. Continuation
 * (folded) lines — those beginning with a space or tab — are joined onto the
 * previous header. On duplicate headers the FIRST occurrence wins (the common
 * MTA convention for singleton headers like List-Unsubscribe).
 */
export function parseRawHeaders(raw: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!raw) return headers;

  const lines = raw.replace(/\r\n/g, "\n").split("\n");

  // Unfold: RFC 5322 allows a long header value to wrap onto continuation lines
  // that start with whitespace.
  const unfolded: string[] = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += " " + line.trim();
    } else {
      unfolded.push(line);
    }
  }

  for (const line of unfolded) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const name = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (name && !(name in headers)) {
      headers[name] = value;
    }
  }
  return headers;
}

export interface UnsubscribeInfo {
  /** An https unsubscribe URL, if present. */
  url?: string;
  /** A bare unsubscribe email address (mailto: stripped), if present. */
  mailto?: string;
  /** True when the sender advertises RFC 8058 one-click unsubscribe. */
  oneClick: boolean;
}

/**
 * Extracts the RFC 2369 / RFC 8058 `List-Unsubscribe` target(s) from parsed
 * headers. Values look like `<https://…>, <mailto:unsub@x.com?subject=…>`.
 * Returns null when there is no List-Unsubscribe header.
 */
export function extractUnsubscribe(
  headers: Record<string, string>
): UnsubscribeInfo | null {
  const raw = headers["list-unsubscribe"];
  if (!raw) return null;

  const info: UnsubscribeInfo = { oneClick: false };

  const bracketed = raw.match(/<([^>]+)>/g)?.map((t) => t.slice(1, -1));
  const targets = bracketed && bracketed.length > 0 ? bracketed : [raw];
  for (const target of targets) {
    const trimmed = target.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      info.url ??= trimmed;
    } else if (/^mailto:/i.test(trimmed)) {
      info.mailto ??= trimmed.replace(/^mailto:/i, "");
    }
  }

  // RFC 8058: List-Unsubscribe-Post: List-Unsubscribe=One-Click
  const post = headers["list-unsubscribe-post"]?.toLowerCase() ?? "";
  info.oneClick = post.includes("one-click");

  return info;
}

/** A human-readable unsubscribe target for logging/surfacing (or null). */
export function unsubscribeLabel(info: UnsubscribeInfo | null): string | null {
  if (!info) return null;
  if (info.url) return info.url;
  if (info.mailto) return `mailto:${info.mailto}`;
  return null;
}
