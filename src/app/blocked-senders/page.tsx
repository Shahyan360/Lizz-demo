import { requireUser } from "../../lib/auth/session";
import { prisma } from "../../lib/prisma";
import { BlockedSendersManager, type BlockedRow } from "./BlockedSendersManager";

/**
 * /blocked-senders — view and manage the blocked-sender list. Blocking happens
 * from the mailbox (🚫 Block sender); this is where you unblock or add addresses.
 */
export const dynamic = "force-dynamic";

export default async function BlockedSendersPage() {
  await requireUser();

  const rows = await prisma.blockedSender.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, reason: true, createdAt: true },
  });

  const blocked: BlockedRow[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    reason: r.reason,
    createdAtLabel: r.createdAt.toLocaleDateString(),
  }));

  return <BlockedSendersManager initial={blocked} />;
}
