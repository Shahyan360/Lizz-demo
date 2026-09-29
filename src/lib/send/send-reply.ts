import { DraftStatus } from "@prisma/client";
import { prisma } from "../prisma";
import type { GmailCredentials } from "../../services/gmail.service";
import { extractEmailAddress } from "../gmail-helpers";
import {
  sendParamsSchema,
  sendResultSchema,
  type SendParams,
  type SendResult,
} from "../schemas/send-result";
import { buildReplySubject } from "./subject-builder";
import { resolveReplyMessageId } from "./message-id-extractor";
import { categorizeSendError } from "./send-errors";
import { sendWithRefresh } from "./gmail-sender";
import { finalizeSuccess, rejectDraft } from "./send-outcome";

/**
 * Sends the reply for an approved draft — atomically and idempotently.
 *
 * Flow: load → reserve (PENDING_REVIEW → SENDING lock) → build reply params →
 * throttle → send (the token-refresh retry lives in `gmail-sender.ts`) →
 * finalize / reject. Never throws to the caller; every outcome is a
 * {@link SendResult}.
 */

/** Soft throttle before each send — protects the shared Gemini free-tier quota
 *  used by the episodic-memory embedding fired on the same approval. */
const SEND_THROTTLE_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Validates a result at the module boundary before returning it. */
function done(result: SendResult): SendResult {
  return sendResultSchema.parse(result);
}

export async function sendReplyForDraft(input: {
  draftId: string;
}): Promise<SendResult> {
  const { draftId } = input;

  // (1) Load draft + thread + account + latest incoming message in one query.
  const draft = await prisma.emailDraft.findUnique({
    where: { id: draftId },
    include: {
      thread: {
        include: {
          gmailAccount: true,
          messages: {
            where: { isIncoming: true },
            orderBy: { receivedAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
  if (!draft) {
    return done({ status: "failed", reason: "draft_not_found", retriable: false });
  }
  if (draft.status === DraftStatus.SENT) {
    return done({ status: "skipped", reason: "already_sent" });
  }
  if (draft.status !== DraftStatus.PENDING_REVIEW) {
    return done({ status: "skipped", reason: "wrong_status" });
  }

  // (2) Reserve — a conditional updateMany is the idempotency lock. Two
  // concurrent approvals race here; only the one that flips the row wins.
  const reserved = await prisma.emailDraft.updateMany({
    where: { id: draftId, status: DraftStatus.PENDING_REVIEW },
    data: { status: DraftStatus.SENDING },
  });
  if (reserved.count === 0) {
    return done({ status: "skipped", reason: "already_sent" });
  }

  // Past the lock: every failure must move the draft out of SENDING.
  try {
    const account = draft.thread.gmailAccount;
    if (!account) {
      return done(await rejectDraft(draft, "account_disconnected", false));
    }
    const incoming = draft.thread.messages[0];
    if (!incoming) {
      return done(await rejectDraft(draft, "missing_incoming_message", false));
    }

    // (3) Build + validate the reply parameters.
    const paramsResult = sendParamsSchema.safeParse({
      threadId: draft.threadId,
      to: extractEmailAddress(incoming.sender),
      subject: buildReplySubject(incoming.subject ?? draft.thread.subject),
      bodyText: draft.draftText,
      bodyHtml: draft.draftHtml ?? undefined,
    });
    if (!paramsResult.success) {
      const field = paramsResult.error.issues[0]?.path[0];
      const reason =
        field === "to"
          ? "malformed_recipient"
          : field === "bodyText"
            ? "empty_draft"
            : "invalid_send_params";
      return done(await rejectDraft(draft, reason, false));
    }

    const credentials: GmailCredentials = {
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      tokenExpiry: account.tokenExpiry,
    };
    // Real RFC Message-ID for In-Reply-To / References (best-effort threading).
    const replyMessageId = await resolveReplyMessageId({
      gmailThreadId: draft.threadId,
      credentials,
      accountEmail: account.email,
    });
    const sendParams: SendParams = {
      ...paramsResult.data,
      inReplyTo: replyMessageId ?? undefined,
      references: replyMessageId ?? undefined,
    };

    // (4) Throttle, then send (with a single token-refresh retry on 401).
    await sleep(SEND_THROTTLE_MS);
    const outcome = await sendWithRefresh(account, credentials, sendParams);
    if (!outcome.ok) {
      return done(await rejectDraft(draft, outcome.reason, outcome.retriable));
    }

    // (5) Email is out — finalize (resilient; never reverts a sent message).
    return done(
      await finalizeSuccess(draft, incoming, sendParams.to, outcome.messageId)
    );
  } catch (error) {
    // Safety net for an unexpected pre-send error (e.g. a DB hiccup).
    console.error(`[send-reply] unexpected error for draft ${draftId}:`, error);
    const { reason, retriable } = categorizeSendError(error);
    return done(
      await rejectDraft(draft, reason, retriable).catch(
        (): SendResult => ({ status: "failed", reason, retriable })
      )
    );
  }
}
