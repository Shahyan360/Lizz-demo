import "dotenv/config";
import { PrismaClient, type StoredEmail } from "@prisma/client";
import { extractAndSaveProperty } from "../src/lib/extract/property";

const prisma = new PrismaClient();

async function main() {
  const emails = await prisma.storedEmail.findMany({
    where: { direction: "INBOUND" },
    orderBy: { receivedAt: "asc" },
  });
  console.log(`Scanning ${emails.length} stored inbound emails for property data...`);
  let saved = 0;
  let created = 0;
  for (const email of emails as StoredEmail[]) {
    const result = await extractAndSaveProperty({
      senderName: email.fromName ?? "",
      fromAddress: email.fromAddress,
      subject: email.subject ?? "",
      bodyText: email.bodyText,
      messageId: email.messageId ?? undefined,
      threadId: email.threadId ?? undefined,
      receivedAt: email.receivedAt,
    });
    if (result.saved) {
      saved += 1;
      if (result.created) created += 1;
    }
  }
  console.log(`Property scan complete: ${saved} emails matched; ${created} properties created.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
