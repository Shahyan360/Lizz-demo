import { z } from "zod";

export const PROPERTY_TYPES = ["APARTMENT", "MULTIFAMILY", "HOA", "CONDO_COMMUNITY"] as const;
export const CONTACT_ROLES = ["PROPERTY_MANAGER", "MAINTENANCE_MANAGER", "REGIONAL_MANAGER"] as const;
export const OPPORTUNITY_RATINGS = ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const;
export const CREDENTIAL_TYPES = ["KEY_FOB", "MOBILE_APP", "KEYPAD_CODE", "KEY_CARD"] as const;

export const propertyExtractionSchema = z.object({
  isPropertyLead: z.boolean().default(false),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).default("LOW"),
  name: z.string().nullish(),
  propertyType: z.enum(PROPERTY_TYPES).nullish(),
  managementCompany: z.string().nullish(),
  streetAddress: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  zipCode: z.string().nullish(),
  phone: z.string().nullish(),
  website: z.string().nullish(),
  numberOfUnits: z.number().int().positive().nullish(),
  estimatedResidents: z.number().int().positive().nullish(),
  yearBuilt: z
    .number()
    .int()
    .min(1800)
    .max(new Date().getFullYear() + 1)
    .nullish(),
  contacts: z
    .array(
      z.object({
        role: z.enum(CONTACT_ROLES),
        name: z.string().nullish(),
        email: z.string().nullish(),
        phone: z.string().nullish(),
      })
    )
    .default([]),
  existingSystem: z
    .object({
      callBoxBrand: z.string().nullish(),
      callBoxModel: z.string().nullish(),
      callBoxQuantity: z.number().int().nullish(),
      accessControlBrand: z.string().nullish(),
      accessControlModel: z.string().nullish(),
      surveillanceBrand: z.string().nullish(),
      surveillanceModel: z.string().nullish(),
      credentials: z.array(z.enum(CREDENTIAL_TYPES)).nullish(),
    })
    .nullish(),
  deviceCount: z
    .object({
      accessControlledDoors: z.number().int().nullish(),
      additionalDoorsToSecure: z.number().int().nullish(),
      vehicleGates: z.number().int().nullish(),
      pedestrianGates: z.number().int().nullish(),
      garageDoors: z.number().int().nullish(),
      adaDoorOperators: z.number().int().nullish(),
      cameras: z.number().int().nullish(),
    })
    .nullish(),
  invisibleIntercomRating: z.enum(OPPORTUNITY_RATINGS).nullish(),
  butterflyMxRating: z.enum(OPPORTUNITY_RATINGS).nullish(),
  opportunityNotes: z.string().nullish(),
  // Explicit competitive-bid signal — the specific pattern that has cost
  // AutoGate deals in the past (a property goes out to bid without AutoGate
  // ever hearing about it). This is a literal-language judgment, separate
  // from the general opportunity ratings above.
  competitiveRisk: z
    .enum(["GOING_OUT_TO_BID", "EVALUATING_OTHER_VENDORS", "NONE"])
    .default("NONE"),
  competitiveRiskDetail: z.string().nullish(),
});

export type ExtractedProperty = z.infer<typeof propertyExtractionSchema>;

/** The inbound email fields the extraction pipeline needs, end to end. */
export interface InboundEmail {
  senderName: string;
  fromAddress: string;
  subject: string;
  bodyText: string;
  messageId?: string;
  threadId?: string;
  receivedAt?: Date;
}

/** Same email, minus the body — all that downstream task/follow-up logging needs. */
export type InboundEmailMeta = Omit<InboundEmail, "bodyText">;
