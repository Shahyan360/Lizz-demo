"use server";

import { DraftStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";
import { approveDraftSchema, draftEditSchema } from "../../lib/schemas/actions";
import { sendReplyForDraft } from "../../lib/send/send-reply";

/**
 * Approves a draft and sends the reply through Gmail. The outcome (SENT or
 * REJECTED, plus an `ApprovalHistory` row) is written by `sendReplyForDraft`;
 * the dashboard re-renders the matching state after revalidation. No exception
 * is thrown to the UI — a failed send surfaces as the REJECTED banner.
 */
export async function approveDraft(formData: FormData): Promise<void> {
  const { draftId } = approveDraftSchema.parse({
    draftId: formData.get("draftId"),
  });
  await sendReplyForDraft({ draftId });
  revalidatePath("/");
}

/**
 * Retries a previously failed send: resets a REJECTED draft to PENDING_REVIEW
 * and runs the send pipeline again. The status guard makes this a no-op if the
 * draft is no longer REJECTED.
 */
export async function retryDraftSend(formData: FormData): Promise<void> {
  const { draftId } = approveDraftSchema.parse({
    draftId: formData.get("draftId"),
  });
  await prisma.emailDraft.updateMany({
    where: { id: draftId, status: DraftStatus.REJECTED },
    data: { status: DraftStatus.PENDING_REVIEW },
  });
  await sendReplyForDraft({ draftId });
  revalidatePath("/");
}

/**
 * Overwrites a draft's body and returns it to pending review. Each real edit is
 * also recorded as an `ApprovalHistory` EDITED row so the original AI-generated
 * text can be recovered for the `userEdits` audit diff when the draft is sent.
 */
export async function updateDraftText(
  draftId: string,
  text: string
): Promise<void> {
  const parsed = draftEditSchema.parse({ draftId, text });

  const existing = await prisma.emailDraft.findUnique({
    where: { id: parsed.draftId },
  });
  if (!existing) {
    throw new Error(`Draft ${parsed.draftId} not found.`);
  }

  if (existing.draftText === parsed.text) {
    await prisma.emailDraft.update({
      where: { id: parsed.draftId },
      data: { status: DraftStatus.PENDING_REVIEW },
    });
  } else {
    await prisma.$transaction([
      prisma.approvalHistory.create({
        data: {
          draftId: parsed.draftId,
          action: "EDITED",
          original: existing.draftText,
          modified: parsed.text,
          performedBy: "USER",
        },
      }),
      prisma.emailDraft.update({
        where: { id: parsed.draftId },
        data: { draftText: parsed.text, status: DraftStatus.PENDING_REVIEW },
      }),
    ]);
  }

  revalidatePath("/");
}
