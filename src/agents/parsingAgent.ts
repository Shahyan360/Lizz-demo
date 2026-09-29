import { extractEmailAddress, stripSignature } from "../lib/gmail-helpers";

export interface CleanedEmailMetadata {
  cleanedText: string;
  senderName: string;
  senderEmail: string;
}

/**
 * Deterministic incoming-email parser — NO LLM call.
 *
 * Sender details come straight from the `From` header; the body is cleaned of
 * signatures and quoted history with the shared `stripSignature` helper. Intent
 * and urgency are no longer inferred here — the single merged Reasoning call
 * classifies them while it drafts, which removes one LLM round-trip per email.
 */
export class ParsingAgent {
  public static parse(rawBody: string, sender: string): CleanedEmailMetadata {
    const senderEmail = extractEmailAddress(sender);
    const senderName = sender.split("<")[0].trim() || senderEmail;
    const cleaned = stripSignature(rawBody).trim();

    return {
      cleanedText: cleaned.length > 0 ? cleaned : rawBody.trim(),
      senderName,
      senderEmail,
    };
  }
}
