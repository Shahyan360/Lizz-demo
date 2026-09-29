import { z } from "zod";
import { getGeminiModel, geminiChatWithRetry } from "../../config/gemini";
import {
  BUSINESS_CATEGORIES,
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  toBusinessCategory,
  type EmailClassification,
} from "./categories";

/**
 * AI business-email classifier.
 *
 * Given an inbound email, asks Gemini to sort it into one business category
 * (sales inquiry, quote request, invoice question, complaint, support, other).
 * Complements the deterministic `email-classifier.ts` (which only decides
 * promotional-vs-personal); this one gives the *business* intent of real mail.
 */

/** The JSON shape we force the model to return. */
const classifierOutputSchema = z.object({
  category: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().optional(),
});

/** Truncated to keep the request within the free-tier token budget. */
const MAX_BODY_CHARS = 2000;

function buildRubric(): string {
  return BUSINESS_CATEGORIES.map(
    (c) => `- "${c}": ${CATEGORY_DESCRIPTIONS[c]}`
  ).join("\n");
}

export async function classifyBusinessEmail(input: {
  from: string;
  subject: string;
  bodyText: string;
}): Promise<EmailClassification> {
  const body = input.bodyText.slice(0, MAX_BODY_CHARS);

  const system =
    "You are an email triage assistant for a business. Classify the email into " +
    "exactly ONE of these categories:\n" +
    buildRubric() +
    "\n\nImportant rules:\n" +
    "- Choose \"invoice_question\" ONLY when the email is about MONEY (a bill, " +
    "invoice, payment, or refund). Account access/activation/setup issues are " +
    '"support", NOT "invoice_question".\n' +
    "- If it doesn't clearly fit sales/quote/invoice/complaint/support, use " +
    '"other" rather than guessing.\n' +
    '\nRespond ONLY as JSON: {"category": "<one of the keys above>", ' +
    '"confidence": <0-1>, "reason": "<short justification>"}.';

  const user = `FROM: ${input.from}\nSUBJECT: ${input.subject}\n\nBODY:\n${body}`;

  const response = await geminiChatWithRetry({
    model: getGeminiModel(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 200,
  });

  const parsed = classifierOutputSchema.parse(
    JSON.parse(response.choices[0].message.content || "{}")
  );

  const category = toBusinessCategory(parsed.category);
  return {
    category,
    label: CATEGORY_LABELS[category],
    confidence: parsed.confidence ?? 0.5,
    reason: parsed.reason ?? "",
  };
}
