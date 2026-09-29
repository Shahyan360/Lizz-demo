import { prisma } from "../prisma";
import type { PropertyType, QualificationStatus } from "@prisma/client";
import { REPLY_SIGNER } from "../reply/business-knowledge";

/** How long after a property is created, with no explicit follow-up date set, before the automated follow-up email fires. */
export const DEFAULT_FOLLOW_UP_MONTHS = 3;

export interface FollowUpInput {
  contactedBy?: string;
  contactMethod?: string;
  notes?: string;
  nextFollowUpDate?: string | null;
}

export interface PropertyListItem {
  id: string;
  name: string;
  propertyType: PropertyType;
  managementCompany: string | null;
  city: string | null;
  state: string | null;
  numberOfUnits: number | null;
  qualificationStatus: QualificationStatus | null;
  nextFollowUpDate: Date | null;
  createdAt: Date;
}

export async function getPropertiesPage({
  query = "",
  type,
  status,
  skip = 0,
  take = 20,
}: {
  query?: string;
  type?: PropertyType;
  status?: QualificationStatus;
  skip?: number;
  take?: number;
}): Promise<{ properties: PropertyListItem[]; total: number }> {
  const where = {
    ...(query
      ? {
          OR: [
            { name: { contains: query } },
            { managementCompany: { contains: query } },
            { city: { contains: query } },
            { state: { contains: query } },
            { streetAddress: { contains: query } },
          ],
        }
      : {}),
    ...(type ? { propertyType: type } : {}),
    ...(status
      ? { opportunity: { qualificationStatus: status } }
      : {}),
  };

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        propertyType: true,
        managementCompany: true,
        city: true,
        state: true,
        numberOfUnits: true,
        createdAt: true,
        opportunity: {
          select: {
            qualificationStatus: true,
            nextFollowUpDate: true,
          },
        },
      },
    }),
    prisma.property.count({ where }),
  ]);

  return {
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      propertyType: p.propertyType,
      managementCompany: p.managementCompany,
      city: p.city,
      state: p.state,
      numberOfUnits: p.numberOfUnits,
      qualificationStatus: p.opportunity?.qualificationStatus ?? null,
      nextFollowUpDate: p.opportunity?.nextFollowUpDate ?? null,
      createdAt: p.createdAt,
    })),
    total,
  };
}

export async function propertyStatusCounts(): Promise<Record<string, number>> {
  // Run groupBy and total count in parallel — single round trip each
  const [groups, total] = await Promise.all([
    prisma.opportunity.groupBy({
      by: ["qualificationStatus"],
      _count: { _all: true },
    }),
    prisma.property.count(),
  ]);

  const counts: Record<string, number> = {
    ALL: total,
    NEW_PROSPECT: 0,
    RESEARCHING: 0,
    QUALIFIED: 0,
    PROPOSAL_READY: 0,
    PROPOSAL_SENT: 0,
    CUSTOMER: 0,
    LOST: 0,
  };

  for (const g of groups) {
    counts[g.qualificationStatus] = g._count._all;
  }

  return counts;
}

/** Returns all follow-ups for a given opportunity, newest first. */
export async function getPropertyFollowUps(opportunityId: string) {
  return (prisma as any).followUp.findMany({
    where: { opportunityId },
    orderBy: { createdAt: "desc" },
  });
}

/** Logs a new follow-up and optionally updates nextFollowUpDate on the opportunity. */
export async function addFollowUp(
  opportunityId: string,
  input: FollowUpInput
) {
  return prisma.$transaction(async (tx: any) => {
    const followUp = await tx.followUp.create({
      data: {
        opportunityId,
        contactedBy: input.contactedBy?.trim() || null,
        contactMethod: input.contactMethod?.trim() || null,
        notes: input.notes?.trim() || null,
        nextFollowUpDate: input.nextFollowUpDate
          ? new Date(input.nextFollowUpDate)
          : null,
      },
    });

    // Keep the opportunity's nextFollowUpDate in sync if provided
    if (input.nextFollowUpDate) {
      await tx.opportunity.update({
        where: { id: opportunityId },
        data: { nextFollowUpDate: new Date(input.nextFollowUpDate) },
      });
    }

    return followUp;
  });
}

export interface PropertyDueForFollowUp {
  id: string;
  name: string;
  managementCompany: string | null;
  opportunityId: string;
  qualificationStatus: QualificationStatus;
  contacts: { name: string | null; email: string | null; role: string }[];
}

/** Properties whose opportunity's nextFollowUpDate has arrived. createProperty() defaults this to createdAt + DEFAULT_FOLLOW_UP_MONTHS when not set explicitly, so this is the single source of truth for "due". Excludes CUSTOMER/LOST opportunities — no point auto-following-up on a closed deal. */
export async function getPropertiesDueForFollowUp(
  now: Date = new Date()
): Promise<PropertyDueForFollowUp[]> {
  const properties = await prisma.property.findMany({
    where: {
      opportunity: {
        nextFollowUpDate: { lte: now },
        qualificationStatus: { notIn: ["CUSTOMER", "LOST"] },
      },
    },
    select: {
      id: true,
      name: true,
      managementCompany: true,
      contacts: { select: { name: true, email: true, role: true } },
      opportunity: { select: { id: true, qualificationStatus: true } },
    },
  });

  return properties
    .filter((p) => p.opportunity !== null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      managementCompany: p.managementCompany,
      opportunityId: p.opportunity!.id,
      qualificationStatus: p.opportunity!.qualificationStatus,
      contacts: p.contacts,
    }));
}

/** Logs the automated follow-up email as a FollowUp entry and reschedules nextFollowUpDate DEFAULT_FOLLOW_UP_MONTHS out, so the cadence repeats until a human changes the qualification status or logs a different follow-up date. */
export async function recordAutoFollowUpSent(
  opportunityId: string,
  notes: string,
  sentAt: Date = new Date()
) {
  const nextFollowUpDate = new Date(sentAt);
  nextFollowUpDate.setMonth(nextFollowUpDate.getMonth() + DEFAULT_FOLLOW_UP_MONTHS);

  return prisma.$transaction(async (tx: any) => {
    const followUp = await tx.followUp.create({
      data: {
        opportunityId,
        contactedBy: REPLY_SIGNER,
        contactMethod: "EMAIL",
        notes,
        nextFollowUpDate,
      },
    });

    await tx.opportunity.update({
      where: { id: opportunityId },
      data: { nextFollowUpDate },
    });

    return followUp;
  });
}
