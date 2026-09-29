"use server";

import { revalidatePath } from "next/cache";
import { LeadStage, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { FREE_DOMAINS, domainOf } from "../../lib/repositories/company.repository";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const LEAD_STAGES: LeadStage[] = ["NEW", "ACTIVE", "CUSTOMER"];

/** Manually set a contact's lifecycle stage (New / Active / Customer). */
export async function setContactStage(
  contactId: string,
  stage: string
): Promise<ActionResult> {
  if (!LEAD_STAGES.includes(stage as LeadStage)) {
    return { ok: false, error: "Invalid stage." };
  }
  try {
    await prisma.contact.update({
      where: { id: contactId },
      data: { lifecycleStage: stage as LeadStage },
    });
    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/contacts");
    return { ok: true };
  } catch {
    return { ok: false, error: "Contact not found." };
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Manually create a contact */
export async function createContact(input: {
  name: string;
  email: string;
  stage?: string;
  companyId?: string | null;
  isCompanyExcluded?: boolean;
}): Promise<ActionResult & { id?: string }> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const stage: LeadStage = LEAD_STAGES.includes(input.stage as LeadStage)
    ? (input.stage as LeadStage)
    : "NEW";

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  if (email.toLowerCase().endsWith("@myautogate.com")) {
    return { ok: false, error: "Internal team members and system accounts cannot be added as CRM contacts." };
  }

  const existing = await prisma.contact.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "A contact with that email already exists." };
  }

  let targetCompanyId = input.companyId;
  let isExcluded = input.isCompanyExcluded ?? false;

  if (targetCompanyId === undefined && !isExcluded) {
    const domain = domainOf(email);
    if (domain && !FREE_DOMAINS.has(domain)) {
      let comp = await prisma.company.findUnique({
        where: { domain },
      });
      if (!comp) {
        comp = await prisma.company.create({
          data: { name: domain, domain },
        });
      }
      targetCompanyId = comp.id;
    }
  }

  try {
    const created = await prisma.contact.create({
      data: {
        email,
        name: name || null,
        lifecycleStage: stage,
        companyId: targetCompanyId ?? null,
        isCompanyExcluded: isExcluded,
        interactionCount: 0,
      },
    });
    revalidatePath("/contacts");
    revalidatePath("/companies");
    return { ok: true, id: created.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "A contact with that email already exists." };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Edit a contact's display name and email address. */
export async function updateContact(
  contactId: string,
  input: { name: string; email: string }
): Promise<ActionResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const existing = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Contact not found." };

  try {
    await prisma.contact.update({
      where: { id: contactId },
      data: { name: name || null, email },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Another contact already uses that email." };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
  return { ok: true };
}

export async function deleteContact(contactId: string): Promise<ActionResult> {
  try {
    await prisma.contact.delete({
      where: { id: contactId },
    });
    revalidatePath("/contacts");
    return { ok: true };
  } catch {
    return { ok: false, error: "Contact not found." };
  }
}

export async function saveContactNotes(
  contactId: string,
  notes: string
): Promise<ActionResult> {
  try {
    await prisma.contact.update({
      where: { id: contactId },
      data: { notes: notes.trim() || null },
    });
    revalidatePath(`/contacts/${contactId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
