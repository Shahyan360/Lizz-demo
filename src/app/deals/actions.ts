"use server";

import { revalidatePath } from "next/cache";
import type { DealStage } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { createDeal, updateDeal, deleteDeal } from "../../lib/tools";

/** Server actions backing the Deals / pipeline kanban. */

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const STAGES: DealStage[] = ["NEW", "QUOTED", "WON", "LOST"];
function stageOf(value: string): DealStage {
  return STAGES.includes(value as DealStage) ? (value as DealStage) : "NEW";
}

export async function createDealAction(input: {
  title: string;
  contactEmail?: string;
  value?: number | null;
  stage?: string;
}): Promise<ActionResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title is required." };

  let contactId: string | null = null;
  const email = (input.contactEmail ?? "").trim().toLowerCase();
  if (email) {
    const contact = await prisma.contact.findUnique({
      where: { email },
    });
    contactId = contact?.id ?? null;
  }

  await createDeal({
    title,
    contactId,
    value: input.value ?? null,
    stage: stageOf(input.stage ?? "NEW"),
  });
  revalidatePath("/deals");
  return { ok: true };
}

export async function updateDealStageAction(
  id: string,
  stage: string
): Promise<ActionResult> {
  await updateDeal(id, { stage: stageOf(stage) });
  revalidatePath("/deals");
  return { ok: true };
}

export async function updateDealAction(input: {
  id: string;
  title?: string;
  value?: number | null;
}): Promise<ActionResult> {
  await updateDeal(input.id, {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.value !== undefined ? { value: input.value } : {}),
  });
  revalidatePath("/deals");
  return { ok: true };
}

export async function deleteDealAction(id: string): Promise<ActionResult> {
  await deleteDeal(id);
  revalidatePath("/deals");
  return { ok: true };
}

export async function deleteDealsAction(ids: string[]): Promise<ActionResult> {
  if (ids.length === 0) return { ok: true };
  await prisma.deal.deleteMany({
    where: { id: { in: ids } },
  });
  revalidatePath("/deals");
  return { ok: true };
}
