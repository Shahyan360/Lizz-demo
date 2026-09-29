import { extractPropertyFromEmail } from "./extract";
import {
  findMatchingProperty,
  findPropertyBySenderEmail,
  hasEnoughIdentityToSave,
  resolvePropertyName,
  type ExistingProperty,
} from "./lookup";
import { createNewProperty, linkStoredEmailToProperty, mergeIntoExistingProperty } from "./persist";
import { detectPropertyRisk, raisePropertyRiskAlert } from "./risk";
import type { ExtractedProperty, InboundEmail, InboundEmailMeta } from "./schema";

export { extractPropertyFromEmail } from "./extract";
export type { ExtractedProperty } from "./schema";

type SaveResult = {
  saved: true;
  created: false;
  propertyId: string;
  name: string;
  riskFlagged: boolean;
};

/** Shared by both the known-sender fast path and the identity-match path below. */
async function mergeAndAlert(
  existing: ExistingProperty,
  extracted: ExtractedProperty,
  input: InboundEmailMeta
): Promise<SaveResult> {
  const riskReasons = detectPropertyRisk(existing, extracted);
  await mergeIntoExistingProperty(existing, extracted);
  if (riskReasons.length > 0) {
    await raisePropertyRiskAlert(existing, riskReasons, input);
  }
  return {
    saved: true,
    created: false,
    propertyId: existing.id,
    name: existing.name,
    riskFlagged: riskReasons.length > 0,
  };
}

export async function extractAndSaveProperty(input: InboundEmail): Promise<{
  saved: boolean;
  created: boolean;
  propertyId?: string;
  name?: string;
  riskFlagged?: boolean;
}> {
  const knownProperty = await findPropertyBySenderEmail(input.fromAddress, input.subject);
  const extracted = await extractPropertyFromEmail(input, {
    skipPreFilter: Boolean(knownProperty),
  });

  if (knownProperty) {
    const result = await mergeAndAlert(knownProperty, extracted, input);
    await linkStoredEmailToProperty(result.propertyId, input.messageId);
    return result;
  }

  if (!extracted.isPropertyLead || extracted.confidence === "LOW") {
    return { saved: false, created: false };
  }
  if (!hasEnoughIdentityToSave(extracted)) {
    return { saved: false, created: false };
  }

  const existingByIdentity = await findMatchingProperty(extracted);
  if (existingByIdentity) {
    const result = await mergeAndAlert(existingByIdentity, extracted, input);
    await linkStoredEmailToProperty(result.propertyId, input.messageId);
    return result;
  }

  const propertyId = await createNewProperty(extracted);
  await linkStoredEmailToProperty(propertyId, input.messageId);
  return { saved: true, created: true, propertyId, name: resolvePropertyName(extracted) };
}
