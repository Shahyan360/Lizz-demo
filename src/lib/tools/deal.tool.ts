import type { Deal, DealStage } from "@prisma/client";
import { prisma } from "../prisma";

/** A Deal with its linked contact (email/name) eager-loaded. */
export type DealWithContact = Deal & {
  contact: { id: string; email: string; name: string | null } | null;
};

const OPEN_STAGES: DealStage[] = ["NEW", "QUOTED"];

/** All deals, newest first, with their contact. */
export function listDeals(): Promise<DealWithContact[]> {
  return prisma.deal.findMany({
    orderBy: { updatedAt: "desc" },
    include: { contact: { select: { id: true, email: true, name: true } } },
  });
}

export interface CreateDealInput {
  title: string;
  contactId?: string | null;
  stage?: DealStage;
  value?: number | null;
  notes?: string | null;
  sourceFrom?: string | null;
  sourceSubject?: string | null;
  sourceBody?: string | null;
}

export function createDeal(input: CreateDealInput): Promise<Deal> {
  const stage = input.stage ?? "NEW";
  return prisma.deal.create({
    data: {
      title: input.title,
      contactId: input.contactId ?? null,
      stage,
      value: input.value ?? null,
      notes: input.notes ?? null,
      sourceFrom: input.sourceFrom ?? null,
      sourceSubject: input.sourceSubject ?? null,
      sourceBody: input.sourceBody ?? null,
      closedAt: stage === "WON" || stage === "LOST" ? new Date() : null,
    },
  });
}

export async function upsertEmailDeal(
  input: CreateDealInput
): Promise<{ deal: Deal; created: boolean }> {
  if (input.contactId) {
    const existing = await prisma.deal.findFirst({
      where: {
        contactId: input.contactId,
        stage: { in: OPEN_STAGES },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      const stage: DealStage =
        input.stage === "QUOTED" || existing.stage === "QUOTED"
          ? "QUOTED"
          : "NEW";
      const deal = await prisma.deal.update({
        where: { id: existing.id },
        data: {
          stage,
          value: input.value ?? existing.value,
        },
      });
      return { deal, created: false };
    }
  }
  return { deal: await createDeal(input), created: true };
}

export interface UpdateDealInput {
  title?: string;
  stage?: DealStage;
  value?: number | null;
  notes?: string | null;
}

export async function updateDeal(
  id: string,
  data: UpdateDealInput
): Promise<Deal> {
  const closes = data.stage === "WON" || data.stage === "LOST";
  const deal = await prisma.deal.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.value !== undefined ? { value: data.value } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.stage !== undefined
        ? { stage: data.stage, closedAt: closes ? new Date() : null }
        : {}),
    },
  });

  if (data.stage === "WON" && deal.contactId) {
    await prisma.contact.update({
      where: { id: deal.contactId },
      data: { lifecycleStage: "CUSTOMER" },
    });
  }
  return deal;
}

export async function loseOpenDeal(contactId: string): Promise<Deal | null> {
  const existing = await prisma.deal.findFirst({
    where: { contactId, stage: { in: OPEN_STAGES } },
    orderBy: { createdAt: "desc" },
  });
  if (!existing) return null;
  return updateDeal(existing.id, { stage: "LOST" });
}

export function deleteDeal(id: string): Promise<Deal> {
  return prisma.deal.delete({ where: { id } });
}

export function deleteDeals(ids: string[]): Promise<{ count: number }> {
  return prisma.deal.deleteMany({ where: { id: { in: ids } } });
}
