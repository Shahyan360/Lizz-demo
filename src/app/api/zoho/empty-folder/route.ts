import { NextRequest, NextResponse } from "next/server";
import { ZohoService } from "../../../../services/zoho.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/zoho/empty-folder — deletes ALL emails in a folder (e.g. Empty Trash).
 * Body: { accountId?, folderId }.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { accountId?: string; folderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { accountId, folderId } = body;
  if (!folderId) {
    return NextResponse.json({ error: "folderId is required" }, { status: 400 });
  }

  try {
    await ZohoService.emptyFolder(folderId, accountId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/zoho/empty-folder] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
