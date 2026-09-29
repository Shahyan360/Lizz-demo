import { z } from "zod";
import { type GmailHeaders } from "./schemas/gmail";

/**
 * Deterministic incoming-email classifier.
 *
 * Promotional / automated / bulk mail carries unambiguous machine signals
 * (RFC 8058 `List-Unsubscribe`, RFC 3834 `Auto-Submitted`, `Precedence`, Gmail
 * category labels). This module reads those signals so the expensive LLM
 * pipeline only runs on genuine personal/business mail. No LLM call here.
 */

export type EmailCategory =
  | "promotional"
  | "transactional"
  | "personal"
  | "automated";

/** Categories that should NOT produce an AI draft reply. */
export const NON_DRAFT_CATEGORIES: ReadonlySet<EmailCategory> = new Set<
  EmailCategory
>(["promotional", "transactional", "automated"]);

/** True when an `EmailMessage.intent` value marks a classifier-skipped message. */
export function isNonDraftCategory(value: string | null | undefined): boolean {
  return value != null && NON_DRAFT_CATEGORIES.has(value as EmailCategory);
}

/** Validated input for {@link classifyEmail}. */
export const classifierInputSchema = z.object({
  headers: z.record(z.string()),
  fromAddress: z.string(),
  subject: z.string(),
  bodyText: z.string(),
  labelIds: z.array(z.string()).default([]),
});

export type ClassifierInput = z.input<typeof classifierInputSchema>;

export interface ClassificationResult {
  category: EmailCategory;
  shouldDraft: boolean;
  reason: string;
}

/** Local-parts that, on any domain, indicate non-personal automated senders. */
const PROMOTIONAL_LOCAL_PARTS: ReadonlySet<string> = new Set([
  "noreply",
  "no-reply",
  "no_reply",
  "donotreply",
  "do-not-reply",
  "do_not_reply",
  "notifications",
  "notification",
  "marketing",
  "news",
  "newsletter",
  "newsletters",
  "updates",
  "info",
]);

/** Domains where even a friendly `hello@` local-part is marketing traffic. */
const KNOWN_MARKETING_DOMAINS: ReadonlySet<string> = new Set([
  "mailchimp.com",
  "mailchimpapp.com",
  "substack.com",
  "sendgrid.net",
  "klaviyo.com",
  "hubspot.com",
  "hubspotemail.net",
  "constantcontact.com",
  "sendinblue.com",
  "mailerlite.com",
  "intercom-mail.com",
  "customer.io",
]);

/** `X-Mailer` substrings used by known bulk-mail platforms. */
const BULK_MAILER_SIGNATURES: readonly string[] = [
  "mailchimp",
  "sendgrid",
  "amazon ses",
  "amazonses",
  "sendinblue",
  "constant contact",
  "marketo",
  "hubspot",
  "mailgun",
  "klaviyo",
  "mailerlite",
  "campaign monitor",
];

/** Gmail category label -> classification. */
const CATEGORY_LABEL_MAP: Readonly<
  Record<string, { category: EmailCategory; label: string }>
> = {
  CATEGORY_PROMOTIONS: { category: "promotional", label: "Promotions" },
  CATEGORY_UPDATES: { category: "automated", label: "Updates" },
  CATEGORY_SOCIAL: { category: "automated", label: "Social" },
  CATEGORY_FORUMS: { category: "automated", label: "Forums" },
};

/**
 * Classifies an incoming email. Signals are checked in priority order and the
 * first hit short-circuits; only mail with no machine signal of bulk/automated
 * origin is treated as `personal` and worth drafting a reply to.
 */
export function classifyEmail(rawInput: ClassifierInput): ClassificationResult {
  const parsed = classifierInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(
      `Email classifier received an invalid input: ${parsed.error.message}`
    );
  }
  const { headers, fromAddress, labelIds } = parsed.data;

  // Signal 1 — RFC 8058 List-Unsubscribe: near-universal on marketing mail.
  if (headerPresent(headers, "list-unsubscribe")) {
    return skip("promotional", "List-Unsubscribe header present");
  }

  // Signal 2 — Precedence: bulk | list | junk.
  const precedence = headers["precedence"]?.trim().toLowerCase();
  if (precedence && ["bulk", "list", "junk"].includes(precedence)) {
    return skip("automated", `Precedence: ${precedence}`);
  }

  // Signal 3 — RFC 3834 Auto-Submitted: anything other than "no".
  const autoSubmitted = headers["auto-submitted"]?.trim().toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") {
    return skip("automated", `Auto-Submitted: ${autoSubmitted}`);
  }

  // Signal 4 — auto-response suppression / known bulk mailer software.
  if (headerPresent(headers, "x-auto-response-suppress")) {
    return skip("promotional", "X-Auto-Response-Suppress header present");
  }
  const xMailer = headers["x-mailer"]?.toLowerCase() ?? "";
  const matchedMailer = BULK_MAILER_SIGNATURES.find((sig) =>
    xMailer.includes(sig)
  );
  if (matchedMailer) {
    return skip("promotional", `Bulk mailer software detected: ${matchedMailer}`);
  }

  // Signal 5 — sender-address heuristics.
  const senderHit = classifyBySenderAddress(fromAddress);
  if (senderHit) {
    return senderHit;
  }

  // Signal 6 — Gmail category labels.
  for (const labelId of labelIds) {
    const mapped = CATEGORY_LABEL_MAP[labelId];
    if (mapped) {
      return skip(mapped.category, `Gmail category label: ${mapped.label}`);
    }
  }

  // Signal 7 — default: a genuine personal/business email.
  return {
    category: "personal",
    shouldDraft: true,
    reason: "No promotional/automated signals detected",
  };
}

function headerPresent(headers: GmailHeaders, name: string): boolean {
  return typeof headers[name] === "string" && headers[name].length > 0;
}

function skip(category: EmailCategory, reason: string): ClassificationResult {
  return { category, shouldDraft: false, reason };
}

function classifyBySenderAddress(
  fromAddress: string
): ClassificationResult | null {
  const address = fromAddress.trim().toLowerCase();
  const atIndex = address.lastIndexOf("@");
  if (atIndex <= 0) {
    return null;
  }
  const localPart = address.slice(0, atIndex);
  const domain = address.slice(atIndex + 1);

  if (PROMOTIONAL_LOCAL_PARTS.has(localPart)) {
    return skip("promotional", `Sender local-part "${localPart}@" is non-personal`);
  }
  if (localPart === "hello" && KNOWN_MARKETING_DOMAINS.has(domain)) {
    return skip(
      "promotional",
      `Sender "hello@${domain}" is a known marketing domain`
    );
  }
  return null;
}
