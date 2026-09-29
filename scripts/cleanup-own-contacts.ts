import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * One-off cleanup: remove Contacts that are actually OUR OWN mailbox addresses
 * (our domain) — they should never have been created. Early webhook builds
 * upserted a contact for every inbound sender, including self/internal copies.
 *
 * Safe: every relation to Contact is `onDelete: SetNull`, so the linked stored
 * emails / tasks / meetings / deals simply lose the contact link, nothing is
 * deleted with it. Idempotent.
 *
 *   OWN_DOMAIN=myautogate.com npm run cleanup:own-contacts   (default below)
 */
const prisma = new PrismaClient();

const OWN_DOMAIN = (process.env.OWN_DOMAIN || "myautogate.com")
  .toLowerCase()
  .replace(/^@/, "");

async function main() {
  const suffix = `@${OWN_DOMAIN}`;
  const matches = await prisma.contact.findMany({
    where: { email: { contains: suffix } },
    select: { id: true, email: true, name: true },
  });

  if (matches.length === 0) {
    console.log(`No own-domain contacts found (looking for *${suffix}).`);
  } else {
    console.log(`Found ${matches.length} own-domain contact(s) to remove:`);
    for (const c of matches) console.log(`  - ${c.name || "(no name)"} <${c.email}>`);
    const { count } = await prisma.contact.deleteMany({
      where: { email: { contains: suffix } },
    });
    console.log(`✓ Deleted ${count} contact(s).`);
  }

  // Also purge archived StoredEmails that are self/internal — i.e. the
  // COUNTERPARTY is our own domain. This is scoped precisely so it NEVER touches
  // a genuine reply to a customer (an OUTBOUND email whose fromAddress is our
  // domain but whose toAddress is the customer is not matched):
  //   - INBOUND  from our own domain  (a self/internal message we received)
  //   - OUTBOUND to   our own domain  (a self/internal message we sent)
  const { count: emailCount } = await prisma.storedEmail.deleteMany({
    where: {
      OR: [
        { direction: "INBOUND", fromAddress: { contains: suffix } },
        { direction: "OUTBOUND", toAddress: { contains: suffix } },
      ],
    },
  });
  console.log(`✓ Deleted ${emailCount} internal/self archived email(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
