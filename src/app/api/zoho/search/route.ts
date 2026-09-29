import { NextRequest, NextResponse } from "next/server";
import { ZohoService } from "../../../../services/zoho.service";
import { toEmailItem } from "../../../zoho/_components/email-item";

// Always run live — search reflects the current mailbox.
export const dynamic = "force-dynamic";

/**
 * GET /api/zoho/search?accountId=&q=&start=&limit=
 *
 * Full-mailbox email search. `q` is matched everywhere (subject + body + sender)
 * via Zoho's `entire:` operator. Returns display-ready `EmailItem[]` — each with
 * its own folderId, since results span folders. Empty `q` → empty array.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ?? undefined;
  const q = (searchParams.get("q") ?? "").trim();
  const start = Number(searchParams.get("start") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "40");

  if (!q) return NextResponse.json([]);

  try {
    const emails = await ZohoService.searchMessages({
      accountId,
      // Escape the operator delimiter so a stray ":" in the query can't inject
      // a different Zoho search field.
      searchKey: `entire:${q.replace(/:/g, " ")}`,
      start: Number.isFinite(start) && start > 0 ? start : 1,
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 40,
    });
    return NextResponse.json(emails.map(toEmailItem));
  } catch (error) {
    console.error("[api/zoho/search] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
