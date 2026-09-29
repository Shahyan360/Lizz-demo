import { NextRequest, NextResponse } from "next/server";
import { ZohoService } from "../../../../services/zoho.service";
import { toEmailItem, EMAIL_PAGE_SIZE } from "../../../zoho/_components/email-item";

// Always run live — never cache a page of the mailbox.
export const dynamic = "force-dynamic";

/**
 * GET /api/zoho/emails?accountId=&folderId=&start=&limit=
 *
 * Returns one page of emails as display-ready `EmailItem[]`. Used by the
 * client-side "Load More" (lazy loading) button on the /zoho page.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ?? undefined;
  const folderId = searchParams.get("folderId") ?? undefined;
  const start = Number(searchParams.get("start") ?? "1");
  const limit = Number(searchParams.get("limit") ?? String(EMAIL_PAGE_SIZE));

  if (!folderId) {
    return NextResponse.json({ error: "folderId is required" }, { status: 400 });
  }

  try {
    const emails = await ZohoService.getEmails({
      accountId,
      folderId,
      start: Number.isFinite(start) && start > 0 ? start : 1,
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : EMAIL_PAGE_SIZE,
      threadedMails: true,
      // includeTo: true,
      includeTo: true,
    });
    return NextResponse.json(emails.map(toEmailItem));
  } catch (error) {
    console.error("[api/zoho/emails] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
