"use server";

import type { GmailAccount } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";
import { GmailService } from "../../services/gmail.service";
import { accountIdSchema } from "../../lib/schemas/actions";

export async function getGmailAccounts(): Promise<GmailAccount[]> {
  return prisma.gmailAccount.findMany({
    orderBy: { createdAt: "asc" },
  });
}

export async function setActiveGmailAccount(accountId: string): Promise<void> {
  const parsed = accountIdSchema.parse({ accountId });

  const account = await prisma.gmailAccount.findUnique({
    where: { id: parsed.accountId },
  });
  if (!account) {
    throw new Error("Gmail account not found.");
  }

  await prisma.$transaction([
    prisma.gmailAccount.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    }),
    prisma.gmailAccount.update({
      where: { id: parsed.accountId },
      data: { isActive: true },
    }),
  ]);

  console.log(`[gmail.actions] Active mailbox set to ${account.email}.`);
  revalidatePath("/");
}

export async function disconnectGmailAccount(accountId: string): Promise<void> {
  const parsed = accountIdSchema.parse({ accountId });

  const account = await prisma.gmailAccount.findUnique({
    where: { id: parsed.accountId },
  });
  if (!account) {
    throw new Error("Gmail account not found.");
  }

  try {
    await GmailService.revokeAccess(account.accessToken);
  } catch (error) {
    console.error(
      `[gmail.actions] OAuth revocation failed for ${account.email}; continuing with disconnect.`,
      error
    );
  }

  await prisma.gmailAccount.delete({ where: { id: account.id } });
  console.log(`[gmail.actions] Disconnected mailbox ${account.email}.`);

  if (account.isActive) {
    const replacement = await prisma.gmailAccount.findFirst({
      orderBy: { createdAt: "desc" },
    });
    if (replacement) {
      await prisma.gmailAccount.update({
        where: { id: replacement.id },
        data: { isActive: true },
      });
    }
  }

  revalidatePath("/");
}
