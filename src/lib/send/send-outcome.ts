import { DraftStatus, Prisma, type EmailMessage } from "@prisma/client";
import { prisma } from "../prisma";
import { extractEmailAddress } from "../gmail-helpers";
import { persistApprovedDraftMemory } from "../memory/persist-episodic";
import type { SendResult } from "../schemas/send-result";

/**
 * Persistence of send outcomes — success finalization and failure rejection.
 * Both functions are resilient: they never throw, so the orchestrator's control
 * flow stays deterministic and an already-sent email is never "un-sent".
 */

/** The draft shape loaded by the send pipeline (draft + thread + account + msg). */
export type LoadedDraft = Prisma.EmailDraftGetPayload<{
  include: { thread: { include: { gmailAccount: true; messages: true } } };
}>;

/** Recovers the original AI-generated text from the first recorded edit. */
async function resolveOriginalText(
  draftId: string,
  currentText: string
): Promise<string> {
  try {
    const firstEdit = await prisma.approvalHistory.findFirst({
      where: { draftId, action: "EDITED" },
      orderBy: { createdAt: "asc" },
    });
    return firstEdit?.original ?? currentText;
  } catch {
    return currentText;
  }
}

/**
 * Records a successful send: marks the draft SENT, writes the APPROVED audit
 * row + the `userEdits` diff, stores the outgoing message, and persists the
 * episodic memory. The email is already out, so the draft is forced to SENT
 * even if the bookkeeping writes fail — it must never be re-sent.
 */
export async function finalizeSuccess(
  draft: LoadedDraft,
  incoming: EmailMessage,
  recipient: string,
  messageId: string
): Promise<SendResult> {
  const sentAt = new Date();
  const original = await resolveOriginalText(draft.id, draft.draftText);
  const userEdits = JSON.stringify({
    original,
    final: draft.draftText,
    changed: original !== draft.draftText,
  });
  const accountEmail = draft.thread.gmailAccount?.email ?? "me";

  try {
    await prisma.$transaction(async (tx) => {
      await tx.emailDraft.update({
        where: { id: draft.id },
        data: { status: DraftStatus.SENT, approvedBy: "USER", userEdits },
      });
      await tx.approvalHistory.create({
        data: {
          draftId: draft.id,
          action: "APPROVED",
          original,
          modified: draft.draftText,
          performedBy: "USER",
        },
      });
      await tx.emailMessage.create({
        data: {
          threadId: draft.threadId,
          contactId: incoming.contactId,
          sender: accountEmail,
          recipients: [recipient],
          bodyText: draft.draftText,
          isIncoming: false,
          receivedAt: sentAt,
          intent: "reply",
        },
      });
    });
  } catch (error) {
    console.error(
      `[send-outcome] post-send persistence failed for draft ${draft.id}:`,
      error
    );
    // The email IS sent — the draft must reflect SENT so it is never re-sent.
    try {
      await prisma.emailDraft.update({
        where: { id: draft.id },
        data: { status: DraftStatus.SENT, approvedBy: "USER", userEdits },
      });
    } catch (fatal) {
      console.error(
        `[send-outcome] CRITICAL: draft ${draft.id} sent but not marked SENT:`,
        fatal
      );
    }
  }

  // Learning loop — `persistApprovedDraftMemory` swallows its own errors.
  await persistApprovedDraftMemory({
    contactEmail: extractEmailAddress(incoming.sender),
    contactId: incoming.contactId,
    triggerText: incoming.bodyText,
    replyText: draft.draftText,
    threadId: draft.threadId,
    sourceMessageId: incoming.id,
  });

  return { status: "sent", messageId, threadId: draft.threadId, sentAt };
}

/**
 * Records a failed send: moves the draft to REJECTED and writes a REJECTED
 * audit row carrying the error reason (read back by the dashboard banner).
 */
export async function rejectDraft(
  draft: LoadedDraft,
  reason: string,
  retriable: boolean
): Promise<SendResult> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.emailDraft.update({
        where: { id: draft.id },
        data: { status: DraftStatus.REJECTED },
      });
      await tx.approvalHistory.create({
        data: {
          draftId: draft.id,
          action: "REJECTED",
          original: draft.draftText,
          modified: reason,
          performedBy: "USER",
        },
      });
    });
  } catch (error) {
    console.error(
      `[send-outcome] failed to record rejection for draft ${draft.id}:`,
      error
    );
  }
  return { status: "failed", reason, retriable };
}
