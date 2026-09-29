/**
 * Builds the `Subject` header for a reply.
 */

/** RFC 5322 maximum header line length. */
const MAX_SUBJECT_LENGTH = 998;

/** Leading reply prefix: "Re:", "RE:", "Re :", "re  :" (case-insensitive). */
const REPLY_PREFIX_RE = /^re\s*:/i;

/**
 * Returns a reply subject: a single "Re: " prefix is prepended unless one is
 * already present. Leading whitespace is stripped and the result is capped at
 * the RFC 5322 line-length limit.
 */
export function buildReplySubject(originalSubject: string): string {
  const trimmed = (originalSubject ?? "").replace(/^\s+/, "");
  const prefixed = REPLY_PREFIX_RE.test(trimmed) ? trimmed : `Re: ${trimmed}`;
  return prefixed.slice(0, MAX_SUBJECT_LENGTH);
}
