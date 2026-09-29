/**
 * Removes quoted reply history from an email body so the AI only reasons about
 * the sender's NEW message — not the prior thread we're quoting back to them.
 *
 * Works on already-flattened plain text (newlines may be collapsed to spaces),
 * so markers are matched as substrings rather than line-anchored. It truncates
 * at the EARLIEST reply marker; if that would leave nothing, the original text
 * is kept (better some context than an empty body).
 */
export function stripQuotedText(text: string): string {
  if (!text) return text;

  const markers: RegExp[] = [
    // "On <date>, <name> <addr> wrote:" (Gmail / Zoho / Apple Mail)
    /\bOn\b[^]{0,240}?\bwrote:/i,
    // "-----Original Message-----" (Outlook)
    /-{2,}\s*Original Message\s*-{2,}/i,
    // A quoted header block: "From: … To:/Sent:/Date:/Subject:"
    /From:\s[^]{0,260}?\b(Sent|Date|To|Subject):/i,
    // Helpdesk / ticket separators.
    /Reply\s+above\s+this\s+line/i,
  ];

  let cut = -1;
  for (const re of markers) {
    const m = text.match(re);
    if (m && m.index != null && (cut === -1 || m.index < cut)) {
      cut = m.index;
    }
  }

  if (cut <= 0) return text.trim();
  const head = text.slice(0, cut).trim();
  return head.length > 0 ? head : text.trim();
}
