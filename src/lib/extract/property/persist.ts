import { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { addFollowUp } from "../../repositories/property.repository";
import type { ExistingProperty } from "./lookup";
import { resolvePropertyName } from "./lookup";
import type { ExtractedProperty } from "./schema";

/** Only fills fields that are currently blank — never overwrites human-entered data. */
export function fillBlanks<T extends Record<string, unknown>>(
  existing: Partial<Record<keyof T, unknown>>,
  incoming: T
): Partial<T> {
  const patch: Partial<T> = {};
  for (const key of Object.keys(incoming) as (keyof T)[]) {
    const value = incoming[key];
    if (value === undefined || value === null) continue;
    const current = existing[key];
    if (current === null || current === undefined || current === "") {
      patch[key] = value;
    }
  }
  return patch;
}

export async function createNewProperty(extracted: ExtractedProperty): Promise<string> {
  const name = resolvePropertyName(extracted);

  const property = await prisma.$transaction(async (tx) => {
    const prop = await tx.property.create({
      data: {
        name,
        propertyType: extracted.propertyType!,
        managementCompany: extracted.managementCompany?.trim() || null,
        streetAddress: extracted.streetAddress?.trim() || null,
        city: extracted.city?.trim() || null,
        state: extracted.state?.trim() || null,
        zipCode: extracted.zipCode?.trim() || null,
        phone: extracted.phone?.trim() || null,
        website: extracted.website?.trim() || null,
        numberOfUnits: extracted.numberOfUnits ?? null,
        estimatedResidents: extracted.estimatedResidents ?? null,
        yearBuilt: extracted.yearBuilt ?? null,
      },
    });

    const contacts = extracted.contacts.filter(
      (c) => c.name?.trim() || c.email?.trim() || c.phone?.trim()
    );
    if (contacts.length > 0) {
      await tx.propertyContact.createMany({
        data: contacts.map((c) => ({
          propertyId: prop.id,
          role: c.role,
          name: c.name?.trim() || null,
          email: c.email?.trim() || null,
          phone: c.phone?.trim() || null,
        })),
      });
    }

    const sys = extracted.existingSystem;
    if (
      sys &&
      (sys.callBoxBrand || sys.callBoxModel || sys.callBoxQuantity != null ||
        sys.accessControlBrand || sys.accessControlModel ||
        sys.surveillanceBrand || sys.surveillanceModel ||
        (sys.credentials && sys.credentials.length > 0))
    ) {
      await tx.existingSystem.create({
        data: {
          propertyId: prop.id,
          callBoxBrand: sys.callBoxBrand?.trim() || null,
          callBoxModel: sys.callBoxModel?.trim() || null,
          callBoxQuantity: sys.callBoxQuantity ?? null,
          accessControlBrand: sys.accessControlBrand?.trim() || null,
          accessControlModel: sys.accessControlModel?.trim() || null,
          surveillanceBrand: sys.surveillanceBrand?.trim() || null,
          surveillanceModel: sys.surveillanceModel?.trim() || null,
          credentials:
            sys.credentials && sys.credentials.length > 0
              ? (sys.credentials as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
        },
      });
    }

    const dc = extracted.deviceCount;
    if (
      dc &&
      (dc.accessControlledDoors != null || dc.additionalDoorsToSecure != null ||
        dc.vehicleGates != null || dc.pedestrianGates != null ||
        dc.garageDoors != null || dc.adaDoorOperators != null || dc.cameras != null)
    ) {
      await tx.deviceCount.create({
        data: {
          propertyId: prop.id,
          accessControlledDoors: dc.accessControlledDoors ?? null,
          additionalDoorsToSecure: dc.additionalDoorsToSecure ?? null,
          vehicleGates: dc.vehicleGates ?? null,
          pedestrianGates: dc.pedestrianGates ?? null,
          garageDoors: dc.garageDoors ?? null,
          adaDoorOperators: dc.adaDoorOperators ?? null,
          cameras: dc.cameras ?? null,
        },
      });
    }

    await tx.opportunity.create({
      data: {
        propertyId: prop.id,
        butterflyMxRating: extracted.butterflyMxRating ?? "UNKNOWN",
        invisibleIntercomRating: extracted.invisibleIntercomRating ?? "UNKNOWN",
        opportunityNotes: extracted.opportunityNotes?.trim() || null,
        qualificationStatus: "NEW_PROSPECT",
      },
    });

    return prop;
  });

  return property.id;
}

export async function linkStoredEmailToProperty(propertyId: string, messageId?: string): Promise<void> {
  if (!messageId) return;
  const stored = await prisma.storedEmail.findUnique({ where: { messageId }, select: { id: true } });
  if (!stored) return;
  await prisma.propertyEmail.upsert({
    where: { propertyId_storedEmailId: { propertyId, storedEmailId: stored.id } },
    create: { propertyId, storedEmailId: stored.id },
    update: {},
  });
}

/** Merges a fresh extraction into an existing property without clobbering curated data. */
export async function mergeIntoExistingProperty(
  existing: ExistingProperty,
  extracted: ExtractedProperty
): Promise<void> {
  const scalarPatch = fillBlanks(existing, {
    managementCompany: extracted.managementCompany?.trim() || null,
    streetAddress: extracted.streetAddress?.trim() || null,
    city: extracted.city?.trim() || null,
    state: extracted.state?.trim() || null,
    zipCode: extracted.zipCode?.trim() || null,
    phone: extracted.phone?.trim() || null,
    website: extracted.website?.trim() || null,
    numberOfUnits: extracted.numberOfUnits ?? null,
    estimatedResidents: extracted.estimatedResidents ?? null,
    yearBuilt: extracted.yearBuilt ?? null,
  });

  const newContacts = extracted.contacts.filter((c) => {
    if (!c.name?.trim() && !c.email?.trim() && !c.phone?.trim()) return false;
    const email = c.email?.trim().toLowerCase();
    if (!email) return true;
    return !existing.contacts.some((ec) => ec.email?.trim().toLowerCase() === email);
  });

  const sys = extracted.existingSystem;
  const systemPatch = sys
    ? fillBlanks(
        (existing.existingSystem ?? {}) as Record<string, unknown>,
        {
          callBoxBrand: sys.callBoxBrand?.trim() || null,
          callBoxModel: sys.callBoxModel?.trim() || null,
          callBoxQuantity: sys.callBoxQuantity ?? null,
          accessControlBrand: sys.accessControlBrand?.trim() || null,
          accessControlModel: sys.accessControlModel?.trim() || null,
          surveillanceBrand: sys.surveillanceBrand?.trim() || null,
          surveillanceModel: sys.surveillanceModel?.trim() || null,
        }
      )
    : {};
  const existingCredentials = Array.isArray(existing.existingSystem?.credentials)
    ? (existing.existingSystem!.credentials as string[])
    : [];
  const mergedCredentials = [
    ...new Set([...existingCredentials, ...(sys?.credentials ?? [])]),
  ];

  const dc = extracted.deviceCount;
  const devicePatch = dc
    ? fillBlanks(
        (existing.deviceCount ?? {}) as Record<string, unknown>,
        {
          accessControlledDoors: dc.accessControlledDoors ?? null,
          additionalDoorsToSecure: dc.additionalDoorsToSecure ?? null,
          vehicleGates: dc.vehicleGates ?? null,
          pedestrianGates: dc.pedestrianGates ?? null,
          garageDoors: dc.garageDoors ?? null,
          adaDoorOperators: dc.adaDoorOperators ?? null,
          cameras: dc.cameras ?? null,
        }
      )
    : {};

  await prisma.$transaction(async (tx) => {
    if (Object.keys(scalarPatch).length > 0) {
      await tx.property.update({ where: { id: existing.id }, data: scalarPatch });
    }

    if (newContacts.length > 0) {
      await tx.propertyContact.createMany({
        data: newContacts.map((c) => ({
          propertyId: existing.id,
          role: c.role,
          name: c.name?.trim() || null,
          email: c.email?.trim() || null,
          phone: c.phone?.trim() || null,
        })),
      });
    }

    if (Object.keys(systemPatch).length > 0 || mergedCredentials.length > 0) {
      await tx.existingSystem.upsert({
        where: { propertyId: existing.id },
        create: {
          propertyId: existing.id,
          ...systemPatch,
          credentials:
            mergedCredentials.length > 0
              ? (mergedCredentials as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
        },
        update: {
          ...systemPatch,
          ...(mergedCredentials.length > existingCredentials.length
            ? { credentials: mergedCredentials as unknown as Prisma.InputJsonValue }
            : {}),
        },
      });
    }

    if (Object.keys(devicePatch).length > 0) {
      await tx.deviceCount.upsert({
        where: { propertyId: existing.id },
        create: { propertyId: existing.id, ...devicePatch },
        update: devicePatch,
      });
    }

    // Ratings/notes are a sales judgment call a rep may have already set —
    // only fill them in when still at the schema default (never override).
    const opportunityPatch: Record<string, unknown> = {};
    if (
      extracted.invisibleIntercomRating &&
      (!existing.opportunity || existing.opportunity.invisibleIntercomRating === "UNKNOWN")
    ) {
      opportunityPatch.invisibleIntercomRating = extracted.invisibleIntercomRating;
    }
    if (
      extracted.butterflyMxRating &&
      (!existing.opportunity || existing.opportunity.butterflyMxRating === "UNKNOWN")
    ) {
      opportunityPatch.butterflyMxRating = extracted.butterflyMxRating;
    }
    if (Object.keys(opportunityPatch).length > 0) {
      await tx.opportunity.upsert({
        where: { propertyId: existing.id },
        create: { propertyId: existing.id, ...opportunityPatch },
        update: opportunityPatch,
      });
    }
  });

  // Every touch is logged on the property's own timeline rather than silently
  // mutating fields — mirrors how a human rep's follow-up call gets logged.
  if (existing.opportunity && extracted.opportunityNotes?.trim()) {
    await addFollowUp(existing.opportunity.id, {
      contactedBy: "Lizzz (auto-extraction)",
      contactMethod: "EMAIL",
      notes: `Auto-detected from inbound email: ${extracted.opportunityNotes.trim()}`,
    });
  }
}
