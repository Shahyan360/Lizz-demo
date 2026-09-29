import { NextRequest, NextResponse } from "next/server";
import { ZohoService } from "../../../../services/zoho.service";
import { blockSender, unblockSender } from "../../../../lib/spam/blocklist";

// Always run live.
export const dynamic = "force-dynamic";

/** The app's own folder that screened/blocked mail is filed into (matches the
 *  webhook) — NOT Zoho's system Spam folder. */
const FILTERED_FOLDER = process.env.ZOHO_FILTERED_FOLDER?.trim() || "Filtered";

/**
 * POST /api/zoho/block  { email, action?, accountId?, folderId?, messageId? }
 *
 * action "block" (default): adds the sender to the blocklist so future mail from
 * them is auto-filed to the app's Filtered folder and never replied to; if a
 * messageId+folderId are given, the current message is moved there too. action
 * "unblock": removes it.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: {
    email?: string;
    action?: "block" | "unblock";
    accountId?: string;
    folderId?: string;
    messageId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  if (!email) {
    return NextResponse.json({ ok: false, error: "email is required" }, { status: 400 });
  }

  try {
    if (body.action === "unblock") {
      await unblockSender(email);
      return NextResponse.json({ ok: true, action: "unblock" });
    }

    await blockSender(email, "blocked from mailbox UI");

    // Move the current message to the Filtered folder (best-effort — blocking
    // still succeeds even if the move fails, e.g. missing folders scope).
    let moved = false;
    if (body.messageId && body.folderId) {
      try {
        const dest = await ZohoService.getOrCreateFolderIdByName(
          FILTERED_FOLDER,
          body.accountId
        );
        if (dest !== body.folderId) {
          await ZohoService.moveMessage(body.messageId, dest, body.accountId);
        }
        moved = true;
      } catch (err) {
        console.warn("[api/zoho/block] could not move message to Filtered:", err);
      }
    }

    return NextResponse.json({ ok: true, action: "block", moved });
  } catch (error) {
    console.error("[api/zoho/block] failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
