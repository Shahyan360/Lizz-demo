import type { Contact } from "@prisma/client";
import { prisma } from "../prisma";

/**
 * Tool: upsert a Contact by email.
 *
 * Creates the contact on first sight, or bumps its interaction counter and
 * `lastInteractionAt` if it already exists (unique by email).
 * Email is normalized to lowercase. Returns the full Contact.
 */
export interface UpsertContactInput {
  email: string;
  name?: string | null;
  phone?: string;
}

export async function upsertContact(
  input: UpsertContactInput
): Promise<Contact> {
  const email = input.email.trim().toLowerCase();
  const contact = await prisma.contact.upsert({
    where: { email },
    update: {
      lastInteractionAt: new Date(),
      interactionCount: { increment: 1 },
      ...(input.name ? { name: input.name } : {}),
    },
    // Count the very first email too — start at 1, not the schema default of 0.
    create: {
      email,
      name: input.name ?? null,
      interactionCount: 1,
    },
  });

  // Lifecycle auto-advance: a brand-new contact is a NEW lead; once they've
  // interacted more than once they're ACTIVE.
  if (contact.interactionCount > 1 && contact.lifecycleStage === "NEW") {
    return prisma.contact.update({
      where: { id: contact.id },
      data: { lifecycleStage: "ACTIVE" },
    });
  }
  return contact;
}
