import { prisma } from "../prisma";

/**
 * Blocked-sender list. A blocked address is treated like spam on arrival: moved
 * to Spam and never drafted/replied to. Backed by the `BlockedSender` table so
 * it survives restarts and is shared across processes. Addresses are normalized
 * to lowercase.
 */

function norm(email: string): string {
  return email.trim().toLowerCase();
}

export async function isSenderBlocked(email: string): Promise<boolean> {
  const addr = norm(email);
  if (!addr) return false;
  try {
    const row = await prisma.blockedSender.findUnique({ where: { email: addr } });
    return row !== null;
  } catch (err) {
    // A DB hiccup must not break inbound processing — treat as not blocked.
    console.warn("[blocklist] lookup failed:", err);
    return false;
  }
}

export async function blockSender(email: string, reason?: string): Promise<void> {
  const addr = norm(email);
  if (!addr) return;
  await prisma.blockedSender.upsert({
    where: { email: addr },
    update: { reason: reason ?? null },
    create: { email: addr, reason: reason ?? null },
  });
}

export async function unblockSender(email: string): Promise<void> {
  const addr = norm(email);
  if (!addr) return;
  await prisma.blockedSender.deleteMany({ where: { email: addr } });
}
