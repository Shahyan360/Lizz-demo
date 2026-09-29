import { prisma } from "../prisma";

/**
 * Persists every email into the `StoredEmail` archive — inbound customer mail and
 * the replies we send.
 */

async function resolveContactId(
  address: string | undefined
): Promise<string | null> {
  const email = (address ?? "").trim().toLowerCase();
  if (!email) return null;
  const contact = await prisma.contact.findUnique({
    where: { email },
  });
  return contact?.id ?? null;
}

export async function storeInboundEmail(input: {
  messageId?: string;
  threadId?: string;
  folderId?: string;
  fromAddress: string;
  fromName?: string;
  toAddress?: string;
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
  receivedAt: Date;
}): Promise<void> {
  const contactId = await resolveContactId(input.fromAddress);

  const data = {
    direction: "INBOUND" as const,
    threadId: input.threadId ?? null,
    folderId: input.folderId ?? null,
    fromAddress: input.fromAddress,
    fromName: input.fromName ?? null,
    toAddress: input.toAddress ?? null,
    subject: input.subject ?? null,
    bodyText: input.bodyText,
    bodyHtml: input.bodyHtml ?? null,
    contactId,
    receivedAt: input.receivedAt,
  };

  if (input.messageId) {
    await prisma.storedEmail.upsert({
      where: { messageId: input.messageId },
      update: { contactId },
      create: { messageId: input.messageId, ...data },
    });
  } else {
    await prisma.storedEmail.create({ data });
  }
}

export async function storeOutboundEmail(input: {
  threadId?: string;
  folderId?: string;
  fromAddress: string;
  toAddress: string;
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
}): Promise<void> {
  const contactId = await resolveContactId(input.toAddress);

  await prisma.storedEmail.create({
    data: {
      direction: "OUTBOUND",
      threadId: input.threadId ?? null,
      folderId: input.folderId ?? null,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      subject: input.subject ?? null,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml ?? null,
      contactId,
      receivedAt: new Date(),
    },
  });
}
