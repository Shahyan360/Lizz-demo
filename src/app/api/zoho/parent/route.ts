import { NextRequest, NextResponse } from "next/server";
import { ZohoService } from "../../../../services/zoho.service";

// Always live — reflects the current mailbox.
export const dynamic = "force-dynamic";

/** Pulls a single header value (e.g. "Subject") from raw RFC header text. */
function headerValue(header: string, name: string): string {
  const match = header.match(new RegExp(`^${name}:\\s*(.*)$`, "im"));
  return match?.[1]?.trim() ?? "";
}

/** Strips leading Re:/Fwd: so an original and its reply compare equal. */
function cleanSubject(subject: string): string {
  return subject.replace(/^(\s*(re|fwd|fw)\s*:\s*)+/i, "").trim();
}

function firstMessageId(value: string): string {
  return value.match(/<[^>]+>/)?.[0] ?? "";
}

/**
 * GET /api/zoho/parent?accountId=&folderId=&messageId=
 *
 * Returns the ORIGINAL email that the given message is a reply to — the "main"
 * email in the thread. Used when viewing a draft reply so the reading pane can
 * show which incoming email the draft answers.
 *
 * The parent is located from the message's In-Reply-To (the direct parent's
 * RFC Message-ID): search the mailbox by the cleaned subject, then match a
 * candidate whose own Message-ID equals that id. Returns { parent: null } when
 * there's no reply header or no match (e.g. drafts created before threading).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ?? undefined;
  const folderId = searchParams.get("folderId");
  const messageId = searchParams.get("messageId");

  if (!folderId || !messageId) {
    return NextResponse.json(
      { error: "folderId and messageId are required" },
      { status: 400 }
    );
  }

  try {
    const header = await ZohoService.getEmailHeader(messageId, folderId, accountId);

    // The direct parent's Message-ID (fall back to the last id in References).
    const parentId =
      firstMessageId(headerValue(header, "In-Reply-To")) ||
      (headerValue(header, "References").match(/<[^>]+>/g)?.pop() ?? "");
    if (!parentId) return NextResponse.json({ parent: null });

    const clean = cleanSubject(headerValue(header, "Subject"));
    if (!clean) return NextResponse.json({ parent: null });

    const candidates = await ZohoService.searchMessages({
      searchKey: `subject:${clean.replace(/[:"']/g, " ").trim()}`,
      accountId,
      limit: 25,
    });

    for (const m of candidates) {
      if (m.messageId === messageId) continue;
      const detail = await ZohoService.getEmailDetail(
        m.messageId,
        m.folderId,
        accountId
      ).catch(() => null);
      if (!detail) continue;
      const mid = firstMessageId(headerValue(detail.header, "Message-ID"));
      if (mid && mid === parentId) {
        return NextResponse.json({
          parent: {
            messageId: m.messageId,
            folderId: m.folderId,
            from: m.from,
            senderName: m.senderName,
            to: m.to,
            subject: m.subject,
            receivedAt: m.receivedAt.toISOString(),
            content: detail.content,
          },
        });
      }
    }

    return NextResponse.json({ parent: null });
  } catch (error) {
    console.error("[api/zoho/parent] failed:", error);
    return NextResponse.json({ parent: null });
  }
}
