import { prisma } from "../../prisma";
import type { ExtractedProperty } from "./schema";

export function normalizeIdentity(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(the|apartments?|apartment|condominiums?|condo|community|hoa)\b/g, " ")
    .replace(/\b(street|st)\b/g, "st")
    .replace(/\b(avenue|ave)\b/g, "ave")
    .replace(/\b boulevard|\b blvd\b/g, " blvd")
    .replace(/\b(road|rd)\b/g, "rd")
    .replace(/\b(drive|dr)\b/g, "dr")
    .replace(/\b(lane|ln)\b/g, "ln")
    .replace(/\b(place|pl)\b/g, "pl")
    .replace(/\b(parkway|pkwy)\b/g, "pkwy")
    .replace(/\b(northwest|nw)\b/g, "nw")
    .replace(/\b(northeast|ne)\b/g, "ne")
    .replace(/\b(southwest|sw)\b/g, "sw")
    .replace(/\b(southeast|se)\b/g, "se")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Minimal identity check mirroring the manual form's own validation in actions.ts. */
export function hasEnoughIdentityToSave(extracted: ExtractedProperty): boolean {
  if (!extracted.propertyType) return false;
  return Boolean(
    extracted.name?.trim() ||
      extracted.streetAddress?.trim() ||
      false
  );
}

export function resolvePropertyName(extracted: ExtractedProperty): string {
  const name = extracted.name?.trim();
  if (name) return name;
  const address = [extracted.streetAddress?.trim(), extracted.city?.trim()]
    .filter(Boolean)
    .join(", ");
  if (address) return address;
  return extracted.managementCompany!.trim();
}

/** Finds an existing Property this email is most likely referring to. */
export async function findMatchingProperty(extracted: ExtractedProperty) {
  const candidates = await prisma.property.findMany({
    where: {
      ...(extracted.zipCode ? { zipCode: { contains: extracted.zipCode.trim().slice(0, 5) } } : {}),
      ...(extracted.city ? { city: { contains: extracted.city.trim() } } : {}),
    },
    include: { contacts: true, existingSystem: true, deviceCount: true, opportunity: true },
  });
  const address = normalizeIdentity(extracted.streetAddress);
  const name = normalizeIdentity(extracted.name);
  const management = normalizeIdentity(extracted.managementCompany);
  const byAddress = address && candidates.find((p) => normalizeIdentity(p.streetAddress) === address);
  if (byAddress) return byAddress;
  const byName = name && candidates.find((p) => normalizeIdentity(p.name) === name &&
    (!management || normalizeIdentity(p.managementCompany) === management));
  if (byName) return byName;

  return null;
}

export type ExistingProperty = NonNullable<Awaited<ReturnType<typeof findMatchingProperty>>>;

/** True for "Re: ...", "RE: Re: ..." etc. — i.e. an actual reply, not a fresh subject line. */
function isReplySubject(subject: string): boolean {
  return /^\s*re\s*:/i.test(subject);
}

/**
 * Finds a property by the SENDER's own address, via `PropertyContact.email`
 * (same lookup `property-context.ts` uses for reply generation) — but ONLY
 * when `subject` marks this as a reply. This is the key to handling ongoing
 * threads: a reply like "our apartment intercom is having problems... 180
 * units" doesn't restate the property's name or address (that was in an
 * earlier message, now stripped as quoted history), so
 * `findMatchingProperty`'s identity-based lookup would find nothing and the
 * email would be silently dropped even though we already know exactly which
 * property this sender belongs to.
 *
 * The subject check matters because this is a sender-email-only lookup with
 * no awareness of topic or thread — without it, ANY brand-new, unrelated
 * inquiry from an address that was ever linked to some other property (e.g.
 * a facilities contact emailing about a second, different property, or just
 * someone who separately contacted AutoGate once before) would get silently
 * merged into that unrelated property's record instead of being evaluated
 * fresh by `findMatchingProperty`/`hasEnoughIdentityToSave`. A fresh subject
 * (no "Re:") is never treated as "known sender" — it goes through normal
 * identity-based matching instead, which requires the email itself to name
 * a matching property/address/management company.
 */
export async function findPropertyBySenderEmail(
  fromAddress: string,
  subject: string
): Promise<ExistingProperty | null> {
  const email = fromAddress.trim().toLowerCase();
  if (!email || !isReplySubject(subject)) return null;

  const contact = await prisma.propertyContact.findFirst({
    where: { email },
    orderBy: { updatedAt: "desc" },
    include: {
      property: {
        include: { contacts: true, existingSystem: true, deviceCount: true, opportunity: true },
      },
    },
  });

  return contact?.property ?? null;
}
