import { classifyEmail, type EmailCategory } from "../email-classifier";
import {
  parseRawHeaders,
  extractUnsubscribe,
  type UnsubscribeInfo,
} from "../email/parse-headers";
import { llmSpamCheck } from "./llm-spam-check";
import { ZohoService } from "../../services/zoho.service";

/**
 * Inbound spam / promotional screening for the Zoho path.
 *
 * Reuses the deterministic {@link classifyEmail} (List-Unsubscribe, Precedence,
 * Auto-Submitted, bulk-mailer software, marketing sender heuristics). The Zoho
 * webhook payload has no headers, so we fetch the message's raw header block
 * first; if that fetch fails we degrade gracefully to sender-address heuristics.
 * No LLM call — this is free and near-zero false-positive.
 */

export interface SpamScreenResult {
  /** True when the email is promotional/automated/bulk — do not engage with AI. */
  isSpam: boolean;
  category: EmailCategory;
  reason: string;
  /** The List-Unsubscribe target, surfaced so a human can act on it. */
  unsubscribe: UnsubscribeInfo | null;
}

export async function screenInboundEmail(input: {
  messageId?: string;
  folderId?: string;
  fromAddress: string;
  subject: string;
  bodyText: string;
}): Promise<SpamScreenResult> {
  let headers: Record<string, string> = {};
  if (input.messageId && input.folderId) {
    try {
      const raw = await ZohoService.getEmailHeader(input.messageId, input.folderId);
      headers = parseRawHeaders(raw);
    } catch (err) {
      console.warn(
        "[spam-screen] header fetch failed; using sender heuristics only:",
        err
      );
    }
  }

  const unsubscribe = extractUnsubscribe(headers);

  const result = classifyEmail({
    headers,
    fromAddress: input.fromAddress,
    subject: input.subject,
    bodyText: input.bodyText,
    labelIds: [], // Zoho has no Gmail category labels.
  });

  // Deterministic machine signals caught it (bulk/marketing/automated).
  if (!result.shouldDraft) {
    return {
      isSpam: true,
      category: result.category,
      reason: result.reason,
      unsubscribe,
    };
  }

  // Looks personal by envelope signals — take a second, content-based opinion
  // to catch scams/phishing hand-typed from ordinary addresses (no bulk headers).
  // Enabled by default; set SPAM_LLM_CHECK=false to skip the extra LLM call.
  if (process.env.SPAM_LLM_CHECK !== "false") {
    const llm = await llmSpamCheck({
      from: input.fromAddress,
      subject: input.subject,
      bodyText: input.bodyText,
    });
    if (llm.isSpam) {
      return {
        isSpam: true,
        category: "promotional",
        reason: `AI content check: ${llm.reason || "flagged as spam/scam"}`,
        unsubscribe,
      };
    }
  }

  return {
    isSpam: false,
    category: result.category,
    reason: result.reason,
    unsubscribe,
  };
}
