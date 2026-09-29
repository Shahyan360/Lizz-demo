import { NextRequest, NextResponse } from "next/server";
import { ZohoService } from "../../../../services/zoho.service";
import { extractEmailAddress } from "../../../../lib/gmail-helpers";
import { prisma } from "../../../../lib/prisma";

// Always live — the conversation reflects the current mailbox.
export const dynamic = "force-dynamic";

/** Pulls a single header value (e.g. "Subject") from raw RFC header text. */
function headerValue(header: string, name: string): string {
  const match = header.match(new RegExp(`^${name}:\\s*(.*)$`, "im"));
  return match?.[1]?.trim() ?? "";
}

/** Strips leading Re:/Fwd: so an original and its replies compare equal. */
function cleanSubject(subject: string): string {
  return subject.replace(/^(\s*(re|fwd|fw)\s*:\s*)+/i, "").trim();
}

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
    let subject = headerValue(header, "Subject");
    let originalIdRaw =
      headerValue(header, "Message-ID") || headerValue(header, "Message-Id");
    let fromAddr = extractEmailAddress(headerValue(header, "From")).toLowerCase();
    let toAddr = extractEmailAddress(headerValue(header, "To")).toLowerCase();

    // Fallback to stored email in Prisma if Zoho header endpoint returned 400 or empty
    if (!subject || !originalIdRaw) {
      try {
        const stored = await prisma.storedEmail.findFirst({
          where: { OR: [{ id: messageId }, { messageId }] },
        });
        if (stored) {
          if (!subject) subject = stored.subject || "";
          if (!originalIdRaw) originalIdRaw = stored.messageId || "";
          if (!fromAddr) fromAddr = (stored.fromAddress || "").toLowerCase();
          if (!toAddr) toAddr = (stored.toAddress || "").toLowerCase();
        }
      } catch {
        // ignore
      }
    }

    const clean = cleanSubject(subject);
    if (!clean) return NextResponse.json({ messages: [] });

    // The opened email's RFC Message-ID. Replies point back to it via
    // In-Reply-To / References — this is how we find the reply to THIS specific
    // email, since repeated test emails share an identical subject.
    const originalIdMatch = originalIdRaw.match(/<[^>]+>/);
    const originalId = originalIdMatch ? originalIdMatch[0] : originalIdRaw.trim();

    // The counterpart address = the participant who isn't this mailbox, used to
    // avoid merging unrelated conversations that happen to share a subject.
    const owner = (await ZohoService.getPrimaryEmailAddress().catch(() => ""))
      .toLowerCase();
    const participant = [fromAddr, toAddr].find((a) => a && a !== owner) ?? "";

    // Search everywhere by the cleaned subject (strip operator-breaking chars).
    const searchKey = `subject:${clean.replace(/[:"']/g, " ").trim()}`;
    const candidates = await ZohoService.searchMessages({
      searchKey,
      accountId,
      limit: 25,
    });

    // Without the original Message-ID we can't reliably tell replies apart from
    // other same-subject emails — show nothing rather than guess wrong.
    if (!originalId) return NextResponse.json({ messages: [] });

    // Candidate pool: same cleaned subject, involving the same counterpart,
    // excluding the opened message itself. The precise reply match happens next.
    const pool = candidates
      .filter((m) => cleanSubject(m.subject).toLowerCase() === clean.toLowerCase())
      .filter((m) => {
        if (!participant) return true;
        return `${m.from} ${m.to}`.toLowerCase().includes(participant);
      })
      .filter((m) => m.messageId !== messageId)
      .slice(0, 15);

    // Keep only messages that are a DIRECT reply to the opened email — matched by
    // the RFC threading headers (In-Reply-To / References), NOT the subject, so
    // replies to OTHER same-subject test emails are excluded. Fetch header+body
    // together; a single failure is skipped, not thrown.
    const messages = [];
    for (const m of pool) {
      const detail = await ZohoService.getEmailDetail(
        m.messageId,
        m.folderId,
        accountId
      ).catch(() => null);
      if (!detail) continue;
      const refs = `${headerValue(detail.header, "In-Reply-To")} ${headerValue(
        detail.header,
        "References"
      )}`;
      if (!refs.includes(originalId)) continue;
      messages.push({
        messageId: m.messageId,
        folderId: m.folderId,
        from: m.from,
        senderName: m.senderName,
        to: m.to,
        subject: m.subject,
        receivedAt: m.receivedAt.toISOString(),
        isOwn: extractEmailAddress(m.from).toLowerCase() === owner,
        content: detail.content,
      });
    }
    messages.sort(
      (a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
    );

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[api/zoho/thread] failed:", error);
    return NextResponse.json({ messages: [] });
  }
}
