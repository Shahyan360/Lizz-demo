import { getGeminiModel, geminiChatWithRetry } from "../../../config/gemini";
import { stripQuotedText } from "../../email/strip-quoted";
import { mightBePropertyLead } from "./pre-filter";
import { buildPropertyExtractionPrompt } from "./prompt";
import { propertyExtractionSchema, type ExtractedProperty, type InboundEmail } from "./schema";

export async function extractPropertyFromEmail(
  input: InboundEmail,
  opts: { skipPreFilter?: boolean } = {}
): Promise<ExtractedProperty> {
  const body = stripQuotedText(input.bodyText);

  if (!opts.skipPreFilter && !mightBePropertyLead(input.subject, body)) {
    return propertyExtractionSchema.parse({ isPropertyLead: false, confidence: "LOW" });
  }

  const user =
    `FROM: ${input.senderName} <${input.fromAddress}>\n` +
    `SUBJECT: ${input.subject}\n\nBODY:\n${body}`;

  const response = await geminiChatWithRetry({
    model: getGeminiModel(),
    messages: [
      { role: "system", content: buildPropertyExtractionPrompt() },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 900,
  });

  return propertyExtractionSchema.parse(
    JSON.parse(response.choices[0].message.content || "{}")
  );
}
