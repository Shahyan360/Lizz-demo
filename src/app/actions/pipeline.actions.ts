"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";
import { syncGmailAccount } from "../../lib/gmail-sync";

export async function triggerLiveGmailSync(): Promise<void> {
  const account = await prisma.gmailAccount.findFirst({
    where: { isActive: true },
  });
  if (!account) {
    throw new Error(
      "No active Gmail account. Connect a mailbox and set it active first."
    );
  }

  const result = await syncGmailAccount(account.id, "1d");
  console.log(
    `[pipeline.actions] Manual sync — drafted ${result.drafted}, ` +
      `skipped ${result.skipped}, failed ${result.failed}.`
  );

  revalidatePath("/");
}
