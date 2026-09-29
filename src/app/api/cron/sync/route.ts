import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { syncGmailAccount, type SyncResult } from "../../../../lib/gmail-sync";

export const dynamic = "force-dynamic";

interface AccountError {
  accountId: string;
  error: string;
}

/**
 * Scheduled batch sync. Iterates every active Gmail mailbox and syncs each over
 * a 1-day window. A failure in one account is recorded but does not abort the
 * rest of the batch.
 *
 * Secured by `CRON_SECRET`: the caller must send `Authorization: Bearer <secret>`.
 */
async function handleCronSync(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization");
  if (!secret || provided !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.gmailAccount.findMany({
    where: { isActive: true },
  });

  const results: Array<SyncResult | AccountError> = [];
  for (const account of accounts) {
    try {
      results.push(await syncGmailAccount(account.id, "1d"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[cron/sync] Account ${account.id} failed:`, error);
      results.push({ accountId: account.id, error: message });
    }
  }

  return NextResponse.json({
    ok: true,
    accountsSynced: accounts.length,
    results,
  });
}

export const GET = handleCronSync;
export const POST = handleCronSync;
