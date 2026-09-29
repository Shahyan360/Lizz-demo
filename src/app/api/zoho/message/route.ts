import { NextRequest, NextResponse } from "next/server";
import { ZohoService } from "../../../../services/zoho.service";
import {
  parseRawHeaders,
  extractUnsubscribe,
} from "../../../../lib/email/parse-headers";

// Always run live — message bodies are fetched on demand.
export const dynamic = "force-dynamic";

/** Strips HTML tags/entities to plain text for the classifier. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Pulls a single header value (e.g. "Subject") from raw RFC header text. */
function headerValue(header: string, name: string): string {
  const match = header.match(new RegExp(`^${name}:\\s*(.*)$`, "im"));
  return match?.[1]?.trim() ?? "";
}

/**
 * GET /api/zoho/message?accountId=&folderId=&messageId=
 *
 * Returns one message's `{ messageId, header, content }`. Used when the user
 * clicks an email on the /zoho page to open its full body.
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
    // Detail (header + body) and the attachment list run in parallel.
    const [detail, attachments] = await Promise.all([
      ZohoService.getEmailDetail(messageId, folderId, accountId),
      ZohoService.getEmailAttachments(messageId, folderId, accountId).catch(
        (err) => {
          console.warn("[api/zoho/message] attachmentinfo failed:", err);
          return [];
        }
      ),
    ]);

    // Surface the sender's List-Unsubscribe target (if any) so the reading pane
    // can show an Unsubscribe button.
    const unsubscribe = extractUnsubscribe(parseRawHeaders(detail.header));

    return NextResponse.json({
      ...detail,
      classification: null,
      attachments,
      unsubscribe,
    });
  } catch (error) {
    console.error("[api/zoho/message] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
