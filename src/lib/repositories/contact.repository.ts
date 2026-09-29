import type { Contact, EmailMessage, LeadStage } from "@prisma/client";
import { prisma } from "../prisma";
import {
  FINGERPRINT_SAMPLE_LIMIT,
  THREAD_SUMMARY_LIMIT,
} from "../context-builder/constants";

/**
 * Contact-scoped Prisma queries shared by the orchestrator and the
 * conversation-context builder.
 */

/**
 * One page of contacts (most recently interacted-with first), optionally scoped
 * to a lifecycle stage. Returns the rows plus the total count for that filter so
 * the caller can render pagination.
 */
export async function getContactsPage(opts: {
  stage?: LeadStage;
  query?: string;
  skip: number;
  take: number;
}): Promise<{ contacts: Contact[]; total: number }> {
  const q = opts.query?.trim();
  const where = {
    ...(opts.stage ? { lifecycleStage: opts.stage } : {}),
    ...(q
      ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] }
      : {}),
  };
  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { lastInteractionAt: "desc" },
      skip: opts.skip,
      take: opts.take,
    }),
    prisma.contact.count({ where }),
  ]);
  return { contacts, total };
}

/** Contact counts per lifecycle stage (plus ALL) for the filter chips. */
export async function contactStageCounts(): Promise<Record<string, number>> {
  const groups = await prisma.contact.groupBy({
    by: ["lifecycleStage"],
    _count: { _all: true },
  });
  const counts: Record<string, number> = { ALL: 0, NEW: 0, ACTIVE: 0, CUSTOMER: 0 };
  for (const g of groups) {
    counts[g.lifecycleStage] = g._count._all;
    counts.ALL += g._count._all;
  }
  return counts;
}

/** Finds a contact by email (case-insensitive on the stored value). */
export function findContactByEmail(email: string): Promise<Contact | null> {
  return prisma.contact.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
}

/**
 * Last `limit` messages the USER sent to a contact (`isIncoming: false`),
 * newest first. Drives Tier 1 history.
 */
export function getUserSentMessagesToContact(
  contactId: string,
  limit: number = FINGERPRINT_SAMPLE_LIMIT
): Promise<EmailMessage[]> {
  return prisma.emailMessage.findMany({
    where: { contactId, isIncoming: false },
    orderBy: { receivedAt: "desc" },
    take: limit,
  });
}

/** Recent thread summaries for threads involving a contact, newest first. */
export async function getThreadSummariesForContact(
  contactId: string,
  limit: number = THREAD_SUMMARY_LIMIT
): Promise<string[]> {
  const threads = await prisma.emailThread.findMany({
    where: { messages: { some: { contactId } } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { summary: true },
  });
  return threads
    .map((thread) => thread.summary)
    .filter((summary): summary is string => Boolean(summary));
}
