import { prisma } from "../prisma";

/**
 * "Companies" are derived from contact email domains — no separate table. Free
 * email providers (gmail, outlook, …) are treated as individuals, not companies,
 * so they don't pollute the company view.
 */

export const FREE_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "live.com",
  "msn.com",
  "protonmail.com",
  "proton.me",
  "myautogate.com",
]);

export function domainOf(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

export interface Company {
  domain: string;
  contactCount: number;
  customerCount: number;
  openDealValue: number;
  lastActivity: Date;
}

/** Roll all real-company contacts up by email domain, with quick stats. */
export async function listCompanies(): Promise<Company[]> {
  const contacts = await prisma.contact.findMany({
    where: { isCompanyExcluded: false },
    select: {
      email: true,
      lifecycleStage: true,
      lastInteractionAt: true,
      deals: { select: { stage: true, value: true } },
    },
  });

  const map = new Map<string, Company>();
  for (const c of contacts) {
    const domain = domainOf(c.email);
    if (!domain || FREE_DOMAINS.has(domain)) continue;
    const entry =
      map.get(domain) ??
      {
      domain,
      contactCount: 0,
      customerCount: 0,
      openDealValue: 0,
      lastActivity: c.lastInteractionAt,
    };
    entry.contactCount += 1;
    if (c.lifecycleStage === "CUSTOMER") entry.customerCount += 1;
    for (const d of c.deals) {
      if (d.stage === "NEW" || d.stage === "QUOTED") entry.openDealValue += d.value ?? 0;
    }
    if (c.lastInteractionAt > entry.lastActivity) entry.lastActivity = c.lastInteractionAt;
    map.set(domain, entry);
  }

  // 2. Roll up explicitly created DB companies
  const dbCompanies = await prisma.company.findMany();

  for (const comp of dbCompanies) {
    const domain = comp.domain.toLowerCase();
    if (!map.has(domain)) {
      map.set(domain, {
        domain,
        contactCount: 0,
        customerCount: 0,
        openDealValue: 0,
        lastActivity: comp.updatedAt,
      });
    }
  }

  return [...map.values()].sort(
    (a, b) =>
      b.contactCount - a.contactCount ||
      b.lastActivity.getTime() - a.lastActivity.getTime()
  );
}

/** All contacts (1st, 2nd, 3rd...) under one company domain. Excludes 'NO' contacts. */
export async function getCompanyContacts(domain: string) {
  const target = domain.trim().toLowerCase();
  const contacts = await prisma.contact.findMany({
    where: { isCompanyExcluded: false },
    orderBy: { lastInteractionAt: "desc" },
    include: {
      deals: { select: { id: true, title: true, stage: true, value: true } },
    },
  });
  return contacts.filter((c) => domainOf(c.email) === target);
}
