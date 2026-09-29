import type { GeneratedReply } from "../types";
import { productInformationSchema } from "../router-tool";
import { getProductLine } from "../business-knowledge";

export async function handleProductInformationTool(
  args: unknown
): Promise<GeneratedReply> {
  const parsed = productInformationSchema.parse(args);
  const product = getProductLine(parsed.productCategory);

  console.log(
    `[llm-orchestrator] Product info: ${parsed.productCategory} — ${parsed.customerQuestion}`
  );
  if (parsed.productsReferenced?.length) {
    console.log(
      `[llm-orchestrator] Products referenced: ${parsed.productsReferenced.join(", ")}`
    );
  }

  const catalogNote = product
    ? `Catalog grounding: ${product.name} — ${product.tagline}`
    : `Catalog grounding: ${parsed.productCategory}`;

  return {
    replyText: parsed.emailDraft,
    followUp: [
      catalogNote,
      ...(parsed.nextAction ? [parsed.nextAction] : []),
      "Informational product reply — no Evernote forward unless customer requests a proposal next.",
    ],
  };
}
