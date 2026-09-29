import "dotenv/config";
import { PrismaClient, type EmailDirection } from "@prisma/client";
import { ZohoService } from "../src/services/zoho.service";
import { getOrCreateTenant } from "../src/lib/tenant";
import { upsertContact } from "../src/lib/tools";
import { extractEmailAddress } from "../src/lib/gmail-helpers";
import { extractAndSaveProperty } from "../src/lib/extract/property";

/**
 * One-time backfill: pull existing emails from Zoho (Inbox + Sent) into the
 * StoredEmail archive and create/link their contacts — so the CRM timelines and
 * activity reflect history, not just new mail. Idempotent (upserts by message
 * id), so it's safe to re-run.
 *
 *   BACKFILL_LIMIT=200 npm run backfill:zoho     (default 100 per folder)
 */
const prisma = new PrismaClient();

const MAX = Number(process.env.BACKFILL_LIMIT ?? 100);
const PAGE = 50;

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(Number(c)))
    .replace(/\s+/g, " ")
    .trim();
}

async function backfillFolder(
  tenantId: string,
  ourAddress: string,
  folderName: string,
  direction: EmailDirection
): Promise<number> {
  let stored = 0;
  for (let start = 1; start <= MAX; start += PAGE) {
    const limit = Math.min(PAGE, MAX - (start - 1));
    let emails;
    try {
      emails = await ZohoService.getEmails({ folderName, start, limit, includeBody: true });
    } catch (err) {
      console.warn(`  [${folderName}] page at ${start} failed:`, err instanceof Error ? err.message : err);
      break;
    }
    if (emails.length === 0) break;

    for (const e of emails) {
      try {
        const cpAddr = extractEmailAddress(
          (direction === "INBOUND" ? e.from : e.to) || ""
        ).toLowerCase();

        let contactId: string | null = null;
        if (cpAddr && cpAddr !== ourAddress) {
          const c = await upsertContact({
            email: cpAddr,
            name: direction === "INBOUND" ? e.senderName : null,
          });
          contactId = c.id;
        }

        const bodyHtml = e.content ?? null;
        const bodyText = htmlToText(e.content || e.summary || "");

        await prisma.storedEmail.upsert({
          where: { messageId: e.messageId },
          update: { contactId },
          create: {
            messageId: e.messageId,
            folderId: e.folderId,
            direction,
            fromAddress: direction === "INBOUND" ? e.from : ourAddress,
            fromName: direction === "INBOUND" ? e.senderName : null,
            toAddress: direction === "INBOUND" ? e.to : cpAddr,
            subject: e.subject,
            bodyText,
            bodyHtml,
            contactId,
            receivedAt: e.receivedAt,
          },
        });
        if (direction === "INBOUND" && cpAddr && cpAddr !== ourAddress) {
          await extractAndSaveProperty({
            senderName: e.senderName ?? "",
            fromAddress: cpAddr,
            subject: e.subject ?? "",
            bodyText,
            messageId: e.messageId,
            receivedAt: e.receivedAt,
          });
        }
        stored += 1;
      } catch (err) {
        console.warn(`  skipped one message:`, err instanceof Error ? err.message : err);
      }
    }
    process.stdout.write(`  [${folderName}] stored ${stored}…\r`);
    if (emails.length < limit) break;
  }
  console.log(`  [${folderName}] done — ${stored} stored.`);
  return stored;
}

async function main() {
  const tenant = await getOrCreateTenant();
  const ourAddress = (await ZohoService.getPrimaryEmailAddress()).toLowerCase();
  console.log(`Backfilling for mailbox ${ourAddress} (up to ${MAX} per folder)…`);

  await backfillFolder(tenant.id, ourAddress, "Inbox", "INBOUND");
  await backfillFolder(tenant.id, ourAddress, "Sent", "OUTBOUND");

  const total = await prisma.storedEmail.count();
  console.log(`\n✓ Backfill complete. StoredEmail rows now: ${total}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
