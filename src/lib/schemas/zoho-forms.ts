import { z } from "zod";
import type { PropertyType, OpportunityRating, QualificationStatus } from "@prisma/client";

const maybeNumeric = z.union([z.number(), z.string()]).optional().transform((val) => {
  if (val === undefined || val === null || String(val).trim() === "") return undefined;
  const parsed = Number(val);
  return isNaN(parsed) ? undefined : parsed;
});

const propertyTypeSchema = z.string().transform((val) => {
  const norm = val.toUpperCase().replace(/\s+/g, "_").trim();
  if (["APARTMENT", "MULTIFAMILY", "HOA", "CONDO_COMMUNITY"].includes(norm)) {
    return norm as PropertyType;
  }
  return "APARTMENT" as PropertyType;
});

const opportunityRatingSchema = z.string().optional().transform((val) => {
  if (!val) return "UNKNOWN" as OpportunityRating;
  const norm = val.toUpperCase().trim();
  if (["HIGH", "MEDIUM", "LOW", "UNKNOWN"].includes(norm)) {
    return norm as OpportunityRating;
  }
  return "UNKNOWN" as OpportunityRating;
});

const qualificationStatusSchema = z.string().optional().transform((val) => {
  if (!val) return "NEW_PROSPECT" as QualificationStatus;
  const norm = val.toUpperCase().replace(/\s+/g, "_").trim();
  if (["NEW_PROSPECT", "RESEARCHING", "QUALIFIED", "PROPOSAL_READY", "PROPOSAL_SENT", "CUSTOMER", "LOST"].includes(norm)) {
    return norm as QualificationStatus;
  }
  return "NEW_PROSPECT" as QualificationStatus;
});

const credentialsSchema = z.union([z.array(z.string()), z.string()]).optional().transform((val) => {
  if (!val) return undefined;
  if (Array.isArray(val)) return val;
  return val.split(",").map((s) => s.trim()).filter(Boolean);
});

export const zohoFormWebhookSchema = z.object({
  // Webhook event info & metadata
  submissionId: z.string().optional(),
  recordId: z.string().optional(),

  // Property details
  name: z.string().min(1, "Property name is required"),
  propertyType: propertyTypeSchema,
  managementCompany: z.string().optional(),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  numberOfUnits: maybeNumeric,
  estimatedResidents: maybeNumeric,
  yearBuilt: maybeNumeric,

  // Contacts
  pmName: z.string().optional(),
  pmEmail: z.string().optional(),
  pmPhone: z.string().optional(),

  mmName: z.string().optional(),
  mmEmail: z.string().optional(),
  mmPhone: z.string().optional(),

  rmName: z.string().optional(),
  rmEmail: z.string().optional(),
  rmPhone: z.string().optional(),

  // Existing system
  callBoxBrand: z.string().optional(),
  callBoxModel: z.string().optional(),
  callBoxQuantity: maybeNumeric,
  accessControlBrand: z.string().optional(),
  accessControlModel: z.string().optional(),
  surveillanceBrand: z.string().optional(),
  surveillanceModel: z.string().optional(),
  credentials: credentialsSchema,

  // Device counts
  accessControlledDoors: maybeNumeric,
  additionalDoorsToSecure: maybeNumeric,
  vehicleGates: maybeNumeric,
  pedestrianGates: maybeNumeric,
  garageDoors: maybeNumeric,
  adaDoorOperators: maybeNumeric,
  cameras: maybeNumeric,

  // Opportunity / Qualification
  butterflyMxRating: opportunityRatingSchema,
  invisibleIntercomRating: opportunityRatingSchema,
  opportunityNotes: z.string().optional(),
  qualificationStatus: qualificationStatusSchema,
  nextFollowUpDate: z.string().optional().nullable(),
  internalNotes: z.string().optional(),
});

export type ZohoFormWebhookInput = z.infer<typeof zohoFormWebhookSchema>;
