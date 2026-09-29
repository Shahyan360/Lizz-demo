import { NextRequest, NextResponse } from "next/server";
import { ZohoService } from "../../../../services/zoho.service";

// Always run live — attachments are streamed on demand.
export const dynamic = "force-dynamic";

/**
 * GET /api/zoho/attachment?accountId=&folderId=&messageId=&attachmentId=&name=
 *
 * Streams one attachment's bytes back to the browser. `name` (optional) sets the
 * download filename; `inline=1` shows it in the browser instead of downloading
 * (used for previewing image attachments).
 */
export async function GET(request: NextRequest): Promise<NextResponse | Response> {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ?? undefined;
  const folderId = searchParams.get("folderId");
  const messageId = searchParams.get("messageId");
  const attachmentId = searchParams.get("attachmentId");
  const name = searchParams.get("name") ?? "attachment";
  const inline = searchParams.get("inline") === "1";

  if (!folderId || !messageId || !attachmentId) {
    return NextResponse.json(
      { error: "folderId, messageId and attachmentId are required" },
      { status: 400 }
    );
  }

  try {
    const zohoRes = await ZohoService.getAttachmentResponse(
      messageId,
      folderId,
      attachmentId,
      accountId
    );

    const contentType =
      zohoRes.headers.get("content-type") ?? "application/octet-stream";
    const disposition = inline ? "inline" : "attachment";
    const body = await zohoRes.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(name)}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("[api/zoho/attachment] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
