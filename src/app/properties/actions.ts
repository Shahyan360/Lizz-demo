"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { prisma } from "../../lib/prisma";
import { ZohoService } from "../../services/zoho.service";
import type {
  QualificationStatus,
} from "@prisma/client";
import {
  addFollowUp,
  DEFAULT_FOLLOW_UP_MONTHS,
  type FollowUpInput,
} from "../../lib/repositories/property.repository";
import type {
  CreatePropertyInput,
  ActionResult,
} from "./property_types";

function defaultFollowUpDate(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + DEFAULT_FOLLOW_UP_MONTHS);
  return date;
}

export type UpdatePropertyInput = Partial<Omit<CreatePropertyInput, "contacts">> & {
  contacts?: CreatePropertyInput["contacts"];
};

function hasSystemData(input: Pick<CreatePropertyInput, "callBoxBrand"|"callBoxModel"|"callBoxQuantity"|"accessControlBrand"|"accessControlModel"|"surveillanceBrand"|"surveillanceModel"|"credentials">): boolean {
  return !!(input.callBoxBrand?.trim() || input.callBoxModel?.trim() || input.callBoxQuantity != null || input.accessControlBrand?.trim() || input.accessControlModel?.trim() || input.surveillanceBrand?.trim() || input.surveillanceModel?.trim() || (input.credentials && input.credentials.length > 0));
}

function hasDeviceData(input: Pick<CreatePropertyInput, "accessControlledDoors"|"additionalDoorsToSecure"|"vehicleGates"|"pedestrianGates"|"garageDoors"|"adaDoorOperators"|"cameras">): boolean {
  return !!(input.accessControlledDoors != null || input.additionalDoorsToSecure != null || input.vehicleGates != null || input.pedestrianGates != null || input.garageDoors != null || input.adaDoorOperators != null || input.cameras != null);
}

export async function createProperty(input: CreatePropertyInput): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Property name is required." };
  if (!input.propertyType) return { ok: false, error: "Property type is required." };
  try {
    const property = await prisma.$transaction(async (tx: any) => {
      const prop = await tx.property.create({
        data: {
          name,
          propertyType: input.propertyType,
          managementCompany: input.managementCompany?.trim() || null,
          streetAddress: input.streetAddress?.trim() || null,
          city: input.city?.trim() || null,
          state: input.state?.trim() || null,
          zipCode: input.zipCode?.trim() || null,
          phone: input.phone?.trim() || null,
          website: input.website?.trim() || null,
          numberOfUnits: input.numberOfUnits ?? null,
          estimatedResidents: input.estimatedResidents ?? null,
          yearBuilt: input.yearBuilt ?? null,
        },
      });
      const contactsToCreate = input.contacts.filter((c) => c.name?.trim() || c.email?.trim() || c.phone?.trim());
      if (contactsToCreate.length > 0) {
        await tx.propertyContact.createMany({ data: contactsToCreate.map((c) => ({ propertyId: prop.id, role: c.role, name: c.name?.trim() || null, email: c.email?.trim() || null, phone: c.phone?.trim() || null })) });
      }
      if (hasSystemData(input)) {
        await tx.existingSystem.create({ data: { propertyId: prop.id, callBoxBrand: input.callBoxBrand?.trim() || null, callBoxModel: input.callBoxModel?.trim() || null, callBoxQuantity: input.callBoxQuantity ?? null, accessControlBrand: input.accessControlBrand?.trim() || null, accessControlModel: input.accessControlModel?.trim() || null, surveillanceBrand: input.surveillanceBrand?.trim() || null, surveillanceModel: input.surveillanceModel?.trim() || null, credentials: input.credentials && input.credentials.length > 0 ? (input.credentials as unknown as Prisma.InputJsonValue) : Prisma.JsonNull } });
      }
      if (hasDeviceData(input)) {
        await tx.deviceCount.create({ data: { propertyId: prop.id, accessControlledDoors: input.accessControlledDoors ?? null, additionalDoorsToSecure: input.additionalDoorsToSecure ?? null, vehicleGates: input.vehicleGates ?? null, pedestrianGates: input.pedestrianGates ?? null, garageDoors: input.garageDoors ?? null, adaDoorOperators: input.adaDoorOperators ?? null, cameras: input.cameras ?? null } });
      }
      await tx.opportunity.create({ data: { propertyId: prop.id, butterflyMxRating: input.butterflyMxRating ?? "UNKNOWN", invisibleIntercomRating: input.invisibleIntercomRating ?? "UNKNOWN", opportunityNotes: input.opportunityNotes?.trim() || null, qualificationStatus: input.qualificationStatus ?? "NEW_PROSPECT", nextFollowUpDate: input.nextFollowUpDate ? new Date(input.nextFollowUpDate) : defaultFollowUpDate(), internalNotes: input.internalNotes?.trim() || null } });
      return prop;
    });
    revalidatePath("/properties");
    return { ok: true, id: property.id };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

export async function updateProperty(id: string, input: UpdatePropertyInput): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Property ID is required." };
  try {
    await prisma.$transaction(async (tx: any) => {
      await tx.property.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name.trim() }),
          ...(input.propertyType !== undefined && { propertyType: input.propertyType }),
          ...(input.managementCompany !== undefined && { managementCompany: input.managementCompany?.trim() || null }),
          ...(input.streetAddress !== undefined && { streetAddress: input.streetAddress?.trim() || null }),
          ...(input.city !== undefined && { city: input.city?.trim() || null }),
          ...(input.state !== undefined && { state: input.state?.trim() || null }),
          ...(input.zipCode !== undefined && { zipCode: input.zipCode?.trim() || null }),
          ...(input.phone !== undefined && { phone: input.phone?.trim() || null }),
          ...(input.website !== undefined && { website: input.website?.trim() || null }),
          ...(input.numberOfUnits !== undefined && { numberOfUnits: input.numberOfUnits }),
          ...(input.estimatedResidents !== undefined && { estimatedResidents: input.estimatedResidents }),
          ...(input.yearBuilt !== undefined && { yearBuilt: input.yearBuilt }),
        },
      });
      if (input.contacts !== undefined) {
        await tx.propertyContact.deleteMany({ where: { propertyId: id } });
        const toCreate = input.contacts.filter((c) => c.name?.trim() || c.email?.trim() || c.phone?.trim());
        if (toCreate.length > 0) { await tx.propertyContact.createMany({ data: toCreate.map((c) => ({ propertyId: id, role: c.role, name: c.name?.trim() || null, email: c.email?.trim() || null, phone: c.phone?.trim() || null })) }); }
      }
      if (hasSystemData(input as CreatePropertyInput)) {
        await tx.existingSystem.upsert({
          where: { propertyId: id },
          create: { propertyId: id, callBoxBrand: input.callBoxBrand?.trim() || null, callBoxModel: input.callBoxModel?.trim() || null, callBoxQuantity: input.callBoxQuantity ?? null, accessControlBrand: input.accessControlBrand?.trim() || null, accessControlModel: input.accessControlModel?.trim() || null, surveillanceBrand: input.surveillanceBrand?.trim() || null, surveillanceModel: input.surveillanceModel?.trim() || null, credentials: input.credentials && input.credentials.length > 0 ? (input.credentials as unknown as Prisma.InputJsonValue) : Prisma.JsonNull },
          update: { ...(input.callBoxBrand !== undefined && { callBoxBrand: input.callBoxBrand?.trim() || null }), ...(input.callBoxModel !== undefined && { callBoxModel: input.callBoxModel?.trim() || null }), ...(input.callBoxQuantity !== undefined && { callBoxQuantity: input.callBoxQuantity }), ...(input.accessControlBrand !== undefined && { accessControlBrand: input.accessControlBrand?.trim() || null }), ...(input.accessControlModel !== undefined && { accessControlModel: input.accessControlModel?.trim() || null }), ...(input.surveillanceBrand !== undefined && { surveillanceBrand: input.surveillanceBrand?.trim() || null }), ...(input.surveillanceModel !== undefined && { surveillanceModel: input.surveillanceModel?.trim() || null }), ...(input.credentials !== undefined && { credentials: input.credentials.length > 0 ? (input.credentials as unknown as Prisma.InputJsonValue) : Prisma.JsonNull }) },
        });
      }
      if (hasDeviceData(input as CreatePropertyInput)) {
        await tx.deviceCount.upsert({
          where: { propertyId: id },
          create: { propertyId: id, accessControlledDoors: input.accessControlledDoors ?? null, additionalDoorsToSecure: input.additionalDoorsToSecure ?? null, vehicleGates: input.vehicleGates ?? null, pedestrianGates: input.pedestrianGates ?? null, garageDoors: input.garageDoors ?? null, adaDoorOperators: input.adaDoorOperators ?? null, cameras: input.cameras ?? null },
          update: { ...(input.accessControlledDoors !== undefined && { accessControlledDoors: input.accessControlledDoors }), ...(input.additionalDoorsToSecure !== undefined && { additionalDoorsToSecure: input.additionalDoorsToSecure }), ...(input.vehicleGates !== undefined && { vehicleGates: input.vehicleGates }), ...(input.pedestrianGates !== undefined && { pedestrianGates: input.pedestrianGates }), ...(input.garageDoors !== undefined && { garageDoors: input.garageDoors }), ...(input.adaDoorOperators !== undefined && { adaDoorOperators: input.adaDoorOperators }), ...(input.cameras !== undefined && { cameras: input.cameras }) },
        });
      }
      const hasOpportunityData = input.butterflyMxRating !== undefined || input.invisibleIntercomRating !== undefined || input.opportunityNotes !== undefined || input.qualificationStatus !== undefined || input.nextFollowUpDate !== undefined || input.internalNotes !== undefined;
      if (hasOpportunityData) {
        await tx.opportunity.upsert({
          where: { propertyId: id },
          create: { propertyId: id, butterflyMxRating: input.butterflyMxRating ?? "UNKNOWN", invisibleIntercomRating: input.invisibleIntercomRating ?? "UNKNOWN", opportunityNotes: input.opportunityNotes?.trim() || null, qualificationStatus: input.qualificationStatus ?? "NEW_PROSPECT", nextFollowUpDate: input.nextFollowUpDate ? new Date(input.nextFollowUpDate) : null, internalNotes: input.internalNotes?.trim() || null },
          update: { ...(input.butterflyMxRating !== undefined && { butterflyMxRating: input.butterflyMxRating }), ...(input.invisibleIntercomRating !== undefined && { invisibleIntercomRating: input.invisibleIntercomRating }), ...(input.opportunityNotes !== undefined && { opportunityNotes: input.opportunityNotes?.trim() || null }), ...(input.qualificationStatus !== undefined && { qualificationStatus: input.qualificationStatus }), ...(input.nextFollowUpDate !== undefined && { nextFollowUpDate: input.nextFollowUpDate ? new Date(input.nextFollowUpDate) : null }), ...(input.internalNotes !== undefined && { internalNotes: input.internalNotes?.trim() || null }) },
        });
      }
    });
    revalidatePath("/properties");
    return { ok: true, id };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

export async function updateQualificationStatus(propertyId: string, status: QualificationStatus): Promise<ActionResult> {
  try {
    await (prisma as any).opportunity.upsert({ where: { propertyId }, create: { propertyId, qualificationStatus: status }, update: { qualificationStatus: status } });
    revalidatePath("/properties");
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

export async function deleteProperty(id: string): Promise<ActionResult> {
  try {
    await prisma.property.delete({ where: { id } });
    revalidatePath("/properties");
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

export async function getPropertyDetails(id: string) {
  try {
    const property = await prisma.property.findUnique({
      where: { id },
      include: { contacts: true, existingSystem: true, deviceCount: true, opportunity: { include: { followUps: { orderBy: { createdAt: "desc" }, take: 10 } } } } as any,
    });
    if (!property) return { ok: false as const, error: "Property not found." };
    const emailHistory = await prisma.propertyEmail.findMany({
      where: { propertyId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { storedEmail: true },
    });
    return { ok: true as const, property: { ...property, emailHistory } };
  } catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : String(e) }; }
}

export async function createFollowUp(opportunityId: string, input: FollowUpInput): Promise<ActionResult> {
  try {
    await addFollowUp(opportunityId, input);
    revalidatePath("/properties");
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

/** Returns ALL follow-ups for an opportunity — used by the drawer's "Show all" button */
export async function loadAllFollowUps(opportunityId: string) {
  try {
    const followUps = await (prisma as any).followUp.findMany({
      where: { opportunityId },
      orderBy: { createdAt: "desc" },
    });
    return { ok: true as const, followUps };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

function primaryPropertyRecipient(contacts: { role: string; email: string | null }[]) {
  return contacts.find((c) => c.role === "PROPERTY_MANAGER" && c.email) ?? contacts.find((c) => c.email);
}

export async function sendPropertyFollowUp(propertyId: string): Promise<ActionResult & { link?: string }> {
  try {
    const property = await prisma.property.findUnique({ where: { id: propertyId }, include: { contacts: true, opportunity: true } });
    if (!property) return { ok: false, error: "Property not found." };
    const recipient = primaryPropertyRecipient(property.contacts);
    if (!recipient?.email) return { ok: false, error: "This property has no contact email." };
    await ZohoService.sendEmail({
      toAddress: recipient.email,
      subject: `Checking in — ${property.name}`,
      content: `<p>Hi,</p><p>We wanted to check in regarding ${property.name}. Please let us know if your gate, access-control, intercom, or camera needs have changed and how we can help.</p><p>Best regards,<br/>Lizzz</p>`,
    });
    if (property.opportunity) await addFollowUp(property.opportunity.id, { contactedBy: "Lizzz", contactMethod: "EMAIL", notes: `Direct follow-up sent to ${recipient.email}.` });
    revalidatePath("/properties");
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

export async function sendPropertyQuoteLink(propertyId: string): Promise<ActionResult & { link?: string }> {
  try {
    const property = await prisma.property.findUnique({ where: { id: propertyId }, include: { contacts: true, opportunity: true } });
    if (!property) return { ok: false, error: "Property not found." };
    const recipient = primaryPropertyRecipient(property.contacts);
    if (!recipient?.email) return { ok: false, error: "This property has no contact email." };
    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.quoteRequest.create({ data: { token, customerName: property.name, customerEmail: recipient.email.toLowerCase(), expiresAt } });
    const baseUrl = (process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const link = `${baseUrl}/quote-builder/${token}`;
    await ZohoService.sendEmail({ toAddress: recipient.email, subject: `Quote request for ${property.name}`, content: `<p>Hi,</p><p>Please use the link below to review products and submit the quote request for <strong>${property.name}</strong>:</p><p><a href="${link}">${link}</a></p><p>This link expires in 7 days.</p><p>Best regards,<br/>Lizzz</p>` });
    if (property.opportunity) await addFollowUp(property.opportunity.id, { contactedBy: "Lizzz", contactMethod: "EMAIL", notes: `Quote builder link sent to ${recipient.email}.` });
    return { ok: true, link };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}
