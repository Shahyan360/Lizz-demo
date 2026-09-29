import { prisma } from "../prisma";

/**
 * Surfaces what AutoGate already knows about a sender's property (from the
 * long-term multifamily/HOA prospect list built by `extract/property/`
 * and the manual qualification form) into the reply-generation payload.
 *
 * This is informational only — it does not change which tool Phase 2 picks
 * or how gate/service replies are routed. It exists so Lizzz's reply can
 * read as relationship-aware ("I see you're at Fairfax Ridge...") instead of
 * treating every email from a known long-term prospect as a first contact,
 * and so a rep glancing at the draft sees the known opportunity status
 * without switching to the /properties page.
 */

const RATING_LABEL: Record<string, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  UNKNOWN: "Unknown",
};

/** Returns a plain-text property context block, or "" when the sender isn't a known property contact. */
export async function buildPropertyContext(fromAddress: string): Promise<string> {
  const email = fromAddress.trim().toLowerCase();
  if (!email) return "";

  let contact;
  try {
    contact = await prisma.propertyContact.findFirst({
      where: { email },
      orderBy: { updatedAt: "desc" },
      include: {
        property: {
          include: { existingSystem: true, deviceCount: true, opportunity: true },
        },
      },
    });
  } catch (err) {
    console.warn("[property-context] lookup failed:", err);
    return "";
  }

  if (!contact?.property) return "";
  const property = contact.property;

  const lines: string[] = [
    "This sender is linked to a known property in AutoGate's long-term multifamily/HOA prospect list:",
    `- Property: ${property.name} (${property.propertyType}` +
      (property.managementCompany ? `, managed by ${property.managementCompany}` : "") +
      ")",
  ];

  const address = [property.streetAddress, property.city, property.state, property.zipCode]
    .filter(Boolean)
    .join(", ");
  if (address) lines.push(`- Address: ${address}`);
  if (property.numberOfUnits != null) lines.push(`- Units: ${property.numberOfUnits}`);

  const sys = property.existingSystem;
  if (sys) {
    const sysParts = [
      sys.callBoxBrand
        ? `call box: ${sys.callBoxBrand}${sys.callBoxModel ? ` ${sys.callBoxModel}` : ""}`
        : null,
      sys.accessControlBrand
        ? `access control: ${sys.accessControlBrand}${sys.accessControlModel ? ` ${sys.accessControlModel}` : ""}`
        : null,
      sys.surveillanceBrand
        ? `cameras: ${sys.surveillanceBrand}${sys.surveillanceModel ? ` ${sys.surveillanceModel}` : ""}`
        : null,
    ].filter(Boolean);
    if (sysParts.length > 0) lines.push(`- Known existing systems: ${sysParts.join("; ")}`);
  }

  if (property.opportunity) {
    const opp = property.opportunity;
    lines.push(
      `- Opportunity ratings: ButterflyMX = ${RATING_LABEL[opp.butterflyMxRating]}, ` +
        `Invisible Intercom = ${RATING_LABEL[opp.invisibleIntercomRating]}`
    );
    if (opp.opportunityNotes) lines.push(`- Notes: ${opp.opportunityNotes}`);
    lines.push(`- Qualification status: ${opp.qualificationStatus}`);
    if (opp.nextFollowUpDate) {
      lines.push(`- Next scheduled follow-up: ${opp.nextFollowUpDate.toISOString().slice(0, 10)}`);
    }
  }

  lines.push(`- This sender is on file as the ${contact.role.replace(/_/g, " ").toLowerCase()}.`);

  return lines.join("\n");
}
