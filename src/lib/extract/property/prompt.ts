import { CREDENTIAL_TYPES } from "./schema";

export function buildPropertyExtractionPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return (
    `You work for AutoGate Electric. You extract PROPERTY records from inbound customer emails for property intelligence and sales tracking.\n\n` +
    `An inbound email is below. Work in two steps.\n\n` +
    `STEP 1 — DECIDE:\n` +
    `Is this email about a PROPERTY (residential property, apartment community, condo association, HOA, multifamily building, residential estate, or private property) that has an identifiable property name, community name, or street address?\n` +
    `- isPropertyLead = true when the email is about ANY residential property, apartment complex, condo, HOA, gated community, estate, or customer property with an identified address or property name (for ANY service: gates, access control, intercoms, cameras, security, repairs, installation, or quotes).\n` +
    `- EXCLUSION: isPropertyLead = false for COMMERCIAL OFFICE BUILDINGS, corporate office parks, or business towers (office buildings are strictly excluded).\n` +
    `- isPropertyLead = false for spam, vendor advertisements, unrelated emails, or internal staff chatter without any customer property details. When false, still return the JSON shape with other fields null/empty.\n\n` +
    `STEP 2 — EXTRACT (when isPropertyLead = true):\n` +
    `Pull out ONLY facts written explicitly in the email. Never infer, round, or estimate a number or name that is not stated — leave that field null instead.\n\n` +
    `FIELD RULES:\n` +
    `- name: the property or community's name if stated (e.g. "Fairfax Ridge Apartments", "Oak Creek HOA", or the customer property name). Never use a management company, sender name, or business name as the property name. If only a bare address is given with no named community, leave this null — the caller will fall back to the address.\n` +
    `- propertyType: exactly one of APARTMENT, MULTIFAMILY, HOA, CONDO_COMMUNITY.\n` +
    `  * APARTMENT = rental apartment complex or building\n` +
    `  * CONDO_COMMUNITY = condo building or condominium association\n` +
    `  * HOA = homeowner/community association, gated subdivision, or community board\n` +
    `  * MULTIFAMILY = multifamily properties, residential estates, or general residential properties\n` +
    `- managementCompany: property management or HOA management company name, if stated.\n` +
    `- streetAddress / city / state / zipCode: the property's address. Normalize state to 2-letter USPS code (e.g. "VA", "MD", "DC").\n` +
    `- phone: contact phone number.\n` +
    `- website: property or management website URL.\n` +
    `- numberOfUnits: explicit unit count (e.g. 84 units -> 84).\n` +
    `- estimatedResidents: explicit resident count.\n` +
    `- yearBuilt: explicit construction year.\n` +
    `- contacts: one entry per named person mentioned (including the sender). role must be one of PROPERTY_MANAGER, MAINTENANCE_MANAGER, REGIONAL_MANAGER (if not specified, default to PROPERTY_MANAGER).\n` +
    `- existingSystem: brand/model of call box, access control, or cameras mentioned, callBoxQuantity, and credentials array using only ${CREDENTIAL_TYPES.join(", ")}.\n` +
    `- deviceCount: counts of accessControlledDoors, additionalDoorsToSecure, vehicleGates, pedestrianGates, garageDoors, adaDoorOperators, cameras.\n` +
    `- invisibleIntercomRating / butterflyMxRating: sales fit rating (HIGH, MEDIUM, LOW, UNKNOWN).\n` +
    `- opportunityNotes: ONE short sentence summarizing what the property needs or wants.\n` +
    `- competitiveRisk: GOING_OUT_TO_BID, EVALUATING_OTHER_VENDORS, or NONE.\n` +
    `- competitiveRiskDetail: short phrase describing the risk if applicable.\n` +
    `- confidence: HIGH if property address or name is clear; MEDIUM if partial details; LOW if vague.\n\n` +
    `Today's date is ${today}. Return valid JSON matching the schema.\n` +
    `Respond ONLY as JSON matching this shape (no prose, no markdown fences):\n` +
    `{"isPropertyLead": <bool>, "confidence": "HIGH"|"MEDIUM"|"LOW", ` +
    `"name": <string|null>, "propertyType": "APARTMENT"|"MULTIFAMILY"|"HOA"|"CONDO_COMMUNITY"|null, ` +
    `"managementCompany": <string|null>, "streetAddress": <string|null>, "city": <string|null>, ` +
    `"state": <string|null>, "zipCode": <string|null>, "phone": <string|null>, "website": <string|null>, ` +
    `"numberOfUnits": <number|null>, "estimatedResidents": <number|null>, "yearBuilt": <number|null>, ` +
    `"contacts": [{"role": "PROPERTY_MANAGER"|"MAINTENANCE_MANAGER"|"REGIONAL_MANAGER", "name": <string|null>, "email": <string|null>, "phone": <string|null>}], ` +
    `"existingSystem": {"callBoxBrand": <string|null>, "callBoxModel": <string|null>, "callBoxQuantity": <number|null>, ` +
    `"accessControlBrand": <string|null>, "accessControlModel": <string|null>, "surveillanceBrand": <string|null>, ` +
    `"surveillanceModel": <string|null>, "credentials": [<string>]}|null, ` +
    `"deviceCount": {"accessControlledDoors": <number|null>, "additionalDoorsToSecure": <number|null>, ` +
    `"vehicleGates": <number|null>, "pedestrianGates": <number|null>, "garageDoors": <number|null>, ` +
    `"adaDoorOperators": <number|null>, "cameras": <number|null>}|null, ` +
    `"invisibleIntercomRating": "HIGH"|"MEDIUM"|"LOW"|"UNKNOWN"|null, "butterflyMxRating": "HIGH"|"MEDIUM"|"LOW"|"UNKNOWN"|null, ` +
    `"opportunityNotes": <string|null>, "competitiveRisk": "GOING_OUT_TO_BID"|"EVALUATING_OTHER_VENDORS"|"NONE", ` +
    `"competitiveRiskDetail": <string|null>}`
  );
}
