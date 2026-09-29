import type { GmailAccount } from "@prisma/client";
import { prisma } from "../prisma";
import { GmailService, type GmailCredentials } from "../../services/gmail.service";
import type { SendParams } from "../schemas/send-result";
import { categorizeSendError, isAuthError } from "./send-errors";

/**
 * Gmail send transport with the single token-refresh retry path.
 *
 * On a 401 the access token is force-refreshed, the re-encrypted tokens are
 * persisted (non-fatal — the in-memory tokens still work), and the send is
 * retried exactly ONCE. There is no loop. This function never throws; every
 * outcome is a {@link SendAttempt}.
 */

export type SendAttempt =
  | { ok: true; messageId: string }
  | { ok: false; reason: string; retriable: boolean };

export async function sendWithRefresh(
  account: GmailAccount,
  credentials: GmailCredentials,
  params: SendParams
): Promise<SendAttempt> {
  try {
    return {
      ok: true,
      messageId: await GmailService.sendDraft(params, credentials),
    };
  } catch (firstError) {
    if (!isAuthError(firstError)) {
      return { ok: false, ...categorizeSendError(firstError) };
    }

    // 401 — the cached access token expired. Force a refresh and retry once.
    console.warn(
      `[gmail-sender] auth error sending for ${account.email}; refreshing token`
    );
    let refreshed: GmailCredentials;
    try {
      refreshed = await GmailService.refreshAccessToken(credentials);
    } catch (refreshError) {
      console.error(
        `[gmail-sender] token refresh failed for ${account.email}:`,
        refreshError
      );
      return { ok: false, reason: "auth_failed", retriable: false };
    }

    // Persist re-encrypted tokens — non-fatal: the in-memory creds still work,
    // so a write failure here must not block the send already in progress.
    try {
      await prisma.gmailAccount.update({
        where: { id: account.id },
        data: {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          tokenExpiry: refreshed.tokenExpiry,
        },
      });
    } catch (persistError) {
      console.error(
        `[gmail-sender] could not persist refreshed tokens for ${account.email} ` +
          `(send continues with in-memory tokens):`,
        persistError
      );
    }

    try {
      return {
        ok: true,
        messageId: await GmailService.sendDraft(params, refreshed),
      };
    } catch (secondError) {
      return { ok: false, ...categorizeSendError(secondError) };
    }
  }
}
