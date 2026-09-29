import { NextRequest, NextResponse } from "next/server";
import { ZohoService } from "../../../../services/zoho.service";
import {
  parseRawHeaders,
  extractUnsubscribe,
} from "../../../../lib/email/parse-headers";

// Always run live — acts on the message's current headers.
export const dynamic = "force-dynamic";

/**
 * POST /api/zoho/unsubscribe  { accountId?, folderId, messageId }
 *
 * Unsubscribes from the sender of a message using its List-Unsubscribe header.
 * The target is re-derived server-side from the message headers (never trusted
 * from the client) and the best available method is used:
 *
 *   - RFC 8058 one-click  → POST `List-Unsubscribe=One-Click` to the https URL
 *   - mailto: only        → send an unsubscribe email from the mailbox
 *   - plain https URL     → returned as `openUrl` for the client to open in a tab
 *
 * Returns `{ ok, method, openUrl? }`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { accountId?: string; folderId?: string; messageId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { accountId, folderId, messageId } = body;
  if (!folderId || !messageId) {
    return NextResponse.json(
      { ok: false, error: "folderId and messageId are required" },
      { status: 400 }
    );
  }

  try {
    const header = await ZohoService.getEmailHeader(messageId, folderId, accountId);
    const unsub = extractUnsubscribe(parseRawHeaders(header));

    if (!unsub) {
      return NextResponse.json(
        { ok: false, error: "This email has no unsubscribe option." },
        { status: 404 }
      );
    }

    // 1) RFC 8058 one-click: a single POST, no user visit required.
    if (unsub.oneClick && unsub.url) {
      const res = await fetch(unsub.url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
        redirect: "follow",
      });
      if (!res.ok) {
        throw new Error(`Unsubscribe endpoint returned ${res.status}`);
      }
      return NextResponse.json({ ok: true, method: "one-click" });
    }

    // 2) mailto: — send the unsubscribe request from the mailbox itself.
    if (unsub.mailto) {
      const [addr, query] = unsub.mailto.split("?");
      const params = new URLSearchParams(query ?? "");
      const subject = params.get("subject") || "Unsubscribe";
      const bodyText =
        params.get("body") || "Please unsubscribe me from this mailing list.";
      await ZohoService.sendEmail({
        toAddress: addr.trim(),
        subject,
        content: `<p>${bodyText}</p>`,
      });
      return NextResponse.json({ ok: true, method: "email" });
    }

    // 3) A plain web link — hand it back for the client to open in a new tab
    //    (it may require the user to confirm on the sender's page).
    if (unsub.url) {
      return NextResponse.json({ ok: true, method: "link", openUrl: unsub.url });
    }

    return NextResponse.json(
      { ok: false, error: "No usable unsubscribe target found." },
      { status: 404 }
    );
  } catch (error) {
    console.error("[api/zoho/unsubscribe] failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
