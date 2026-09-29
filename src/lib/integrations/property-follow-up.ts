import { getGeminiModel, geminiChatWithRetry } from "../../config/gemini";
import { ZohoService } from "../../services/zoho.service";
import { REPLY_SIGNER, formatProductCatalogForPrompt } from "../reply/business-knowledge";
import {
  getPropertiesDueForFollowUp,
  recordAutoFollowUpSent,
  type PropertyDueForFollowUp,
} from "../repositories/property.repository";

export interface FollowUpSentResult {
  propertyId: string;
  propertyName: string;
  sentTo: string;
}

export interface FollowUpSkippedResult {
  propertyId: string;
  propertyName: string;
  reason: string;
}

export interface FollowUpErrorResult {
  propertyId: string;
  propertyName: string;
  error: string;
}

const SYSTEM_PROMPT = `You are ${REPLY_SIGNER}, a business-development rep at AutoGate Electric, writing a brief, warm check-in follow-up email to a property manager we have not closed a deal with yet.

${formatProductCatalogForPrompt()}

Write in first person as ${REPLY_SIGNER}. Keep it short (under 150 words), friendly, and low-pressure — this is a routine periodic check-in, not a hard sell. Reference the property by name. Ask whether their gate/access-control/security needs have changed and offer a quick call. Do not invent specific past conversations or commitments. Do not include a subject line or a signature block (name/title/company) — those are added separately. Respond with ONLY the email body as plain text paragraphs separated by blank lines.`;

function pickRecipient(
  contacts: PropertyDueForFollowUp["contacts"]
): { name: string | null; email: string } | null {
  const withEmail = contacts.filter(
    (c): c is { name: string | null; email: string; role: string } => !!c.email
  );
  if (withEmail.length === 0) return null;
  const manager = withEmail.find((c) => c.role === "PROPERTY_MANAGER");
  return manager ?? withEmail[0];
}

function plainTextToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para.trim()).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function draftFollowUpEmail(property: PropertyDueForFollowUp, recipientName: string | null): Promise<string> {
  const userPrompt = `Property: ${property.name}${property.managementCompany ? ` (managed by ${property.managementCompany})` : ""}\nRecipient: ${recipientName ?? "Property Manager"}\n\nWrite the follow-up email body now.`;

  try {
    const response = await geminiChatWithRetry({
      model: getGeminiModel(),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 500,
    });
    const text = response.choices?.[0]?.message?.content?.trim();
    if (text) return text;
  } catch (err) {
    console.warn(`[property-follow-up] AI draft failed for property ${property.id}; using fallback text:`, err);
  }

  return `Hi ${recipientName ?? "there"},\n\nJust checking in on ${property.name} — it's been a little while since we last connected. If your gate, access control, or camera setup needs have changed, or if you'd like a quick refresher on what AutoGate Electric can help with, I'd be glad to set up a short call.\n\nLet me know what works for you.`;
}

async function sendFollowUpForProperty(
  property: PropertyDueForFollowUp,
  now: Date
): Promise<FollowUpSentResult | FollowUpSkippedResult> {
  const recipient = pickRecipient(property.contacts);
  if (!recipient) {
    return {
      propertyId: property.id,
      propertyName: property.name,
      reason: "No contact with an email address on file.",
    };
  }

  const bodyText = await draftFollowUpEmail(property, recipient.name);
  const signatureHtml = await ZohoService.getSignatureHtml();
  const content = plainTextToHtml(bodyText) + (signatureHtml ? `<br/>${signatureHtml}` : "");
  const subject = `Checking in — ${property.name}`.slice(0, 200);

  await ZohoService.sendEmail({
    toAddress: recipient.email,
    subject,
    content,
  });

  await recordAutoFollowUpSent(
    property.opportunityId,
    `Automated follow-up email sent to ${recipient.email}.`,
    now
  );

  return {
    propertyId: property.id,
    propertyName: property.name,
    sentTo: recipient.email,
  };
}

/**
 * Sends the periodic follow-up email for every property whose opportunity's
 * nextFollowUpDate has arrived (excluding CUSTOMER/LOST). createProperty()
 * defaults that date to createdAt + DEFAULT_FOLLOW_UP_MONTHS when not set
 * explicitly; each automated send reschedules it another
 * DEFAULT_FOLLOW_UP_MONTHS out, so the cadence repeats until the
 * qualification status changes or a human logs a different date.
 */
export async function executePropertyFollowUps(now: Date = new Date()): Promise<{
  due: number;
  sent: FollowUpSentResult[];
  skipped: FollowUpSkippedResult[];
  errors: FollowUpErrorResult[];
}> {
  const dueProperties = await getPropertiesDueForFollowUp(now);
  const sent: FollowUpSentResult[] = [];
  const skipped: FollowUpSkippedResult[] = [];
  const errors: FollowUpErrorResult[] = [];

  for (const property of dueProperties) {
    try {
      const result = await sendFollowUpForProperty(property, now);
      if ("sentTo" in result) {
        sent.push(result);
      } else {
        skipped.push(result);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[property-follow-up] Property ${property.id} failed:`, error);
      errors.push({ propertyId: property.id, propertyName: property.name, error: message });
    }
  }

  return { due: dueProperties.length, sent, skipped, errors };
}
