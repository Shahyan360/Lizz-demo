import { gmailHeadersSchema, type GmailHeaders } from "./schemas/gmail";

/**
 * Shared Gmail parsing helpers. Each piece of logic is written once here and
 * reused by `GmailService`, the OAuth callback, and the orchestrator.
 */

/**
 * Matches a single leading reply/forward prefix, e.g. `Re:`, `RE :`, `Fwd:`,
 * `Re[2]:`, plus common localized variants (German `Aw:`/`Wg:`/`Antw:`,
 * Scandinavian `Sv:`, French `Tr:`, Spanish `Rv:`, Finnish `Vs:`, Polish
 * `Odp:`, Turkish `Ynt:`).
 */
const SUBJECT_PREFIX_RE =
  /^\s*(?:re|fwd?|aw|sv|antw|wg|tr|rv|vs|odp|ynt)\s*(?:\[\d+\])?\s*:\s*/i;

/** Fallback subject when an email genuinely has none. */
export const NO_SUBJECT = "(No Subject)";

/**
 * Strips every leading reply/forward prefix from a subject line.
 * `"Re: Fwd: RE: Quarterly numbers"` -> `"Quarterly numbers"`.
 */
export function normalizeSubject(subject: string | null | undefined): string {
  let current = (subject ?? "").trim();
  let previous = "";
  while (current !== previous) {
    previous = current;
    current = current.replace(SUBJECT_PREFIX_RE, "").trim();
  }
  return current.length > 0 ? current : NO_SUBJECT;
}

/**
 * Validates and flattens a raw Gmail `payload.headers` array into a lookup map
 * keyed by lower-cased header name. Throws if the shape drifts from what the
 * Gmail API contract promises.
 */
export function parseGmailHeaders(raw: unknown): GmailHeaders {
  const parsed = gmailHeadersSchema.safeParse(raw ?? []);
  if (!parsed.success) {
    throw new Error(
      `Gmail header shape drift — failed validation: ${parsed.error.message}`
    );
  }
  return parsed.data;
}

/**
 * Extracts a bare, lower-cased email address from a `From`/`To` header value
 * such as `"Jane Doe <jane@acme.com>"`.
 */
export function extractEmailAddress(headerValue: string): string {
  const angled = headerValue.match(/<([^>]+)>/);
  if (angled?.[1]) {
    return angled[1].trim().toLowerCase();
  }
  const bare = headerValue.match(/[^\s<>]+@[^\s<>]+/);
  return (bare?.[0] ?? headerValue).trim().toLowerCase();
}

/**
 * Markers that begin a signature or a quoted-original block. The body is cut at
 * the EARLIEST occurrence of any of these — a conservative, cut-only strip that
 * never edits surviving text (over-trimming would cost real style signal).
 */
const SIGNATURE_CUT_MARKERS: readonly RegExp[] = [
  /^--\s*$/m, // RFC 3676 signature delimiter line
  /^sent from my /im, // iPhone / iPad / Android default signatures
  /^sent via /im,
  /^get outlook for /im, // Outlook mobile signature
  /^-{2,}\s*original message\s*-{2,}/im, // Outlook quoted-original header
  /^on .+ wrote:\s*$/im, // Gmail / Apple Mail quoted-reply header
];

/**
 * Conservatively strips a trailing signature / quoted-reply block from a plain
 * text email body. Everything before the earliest marker is kept verbatim;
 * when no marker is present the body is returned unchanged (trimmed).
 */
export function stripSignature(body: string): string {
  let cutIndex = body.length;
  for (const marker of SIGNATURE_CUT_MARKERS) {
    const match = marker.exec(body);
    if (match && match.index < cutIndex) {
      cutIndex = match.index;
    }
  }
  return body.slice(0, cutIndex).trimEnd();
}
