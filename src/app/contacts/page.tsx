import { NavLink as Link } from "../_components/NavLink";
import type { CSSProperties } from "react";
import type { LeadStage } from "@prisma/client";
import { getOrCreateTenant } from "../../lib/tenant";
import { getContactsPage, contactStageCounts } from "../../lib/repositories/contact.repository";
import { LIGHT } from "../zoho/_components/ui";
import { APP_HEADER_HEIGHT } from "../_components/app-nav";
import { ContactsTable, type ContactRow } from "./ContactsTable";
import { ContactsSearch } from "./ContactsSearch";
import { AddContactButton } from "./AddContactButton";
import { ContactsIcon } from "../_components/icons";

/**
 * /contacts — everyone who has emailed the mailbox, as a lightweight CRM list.
 * Contacts are created/updated automatically by the inbound-email pipeline, carry
 * a lifecycle stage (New → Active → Customer) you can filter on, and can be edited
 * or deleted inline. The list is paginated server-side.
 */
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const FILTERS: { key: LeadStage | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "NEW", label: "New leads" },
  { key: "ACTIVE", label: "Active" },
  { key: "CUSTOMER", label: "Customers" },
];

function formatDate(date: Date): string {
  try {
    return date.toLocaleDateString();
  } catch {
    return "";
  }
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: { stage?: string; page?: string; q?: string };
}) {
  const tenant = await getOrCreateTenant();

  const active = FILTERS.some((f) => f.key === searchParams.stage)
    ? (searchParams.stage as LeadStage | "ALL")
    : "ALL";
  const query = (searchParams.q ?? "").trim();

  const counts = await contactStageCounts();
  const stage = active === "ALL" ? undefined : active;
  const requested = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  // Fetch the requested page; `total` reflects the active stage + search filter.
  let { contacts, total } = await getContactsPage({
    stage,
    query,
    skip: (requested - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  // If the page fell out of range (e.g. a stale URL), clamp and re-fetch.
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, totalPages);
  if (page !== requested) {
    ({ contacts } = await getContactsPage({
      stage,
      query,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }));
  }
  const skip = (page - 1) * PAGE_SIZE;

  const rows: ContactRow[] = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    lifecycleStage: c.lifecycleStage,
    interactionCount: c.interactionCount,
    lastContactLabel: formatDate(c.lastInteractionAt),
  }));

  const rangeStart = total === 0 ? 0 : skip + 1;
  const rangeEnd = Math.min(skip + PAGE_SIZE, total);
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (active !== "ALL") params.set("stage", active);
    if (query) params.set("q", query);
    params.set("page", String(p));
    return `/contacts?${params.toString()}`;
  };

  return (
    <div
      style={{
        position: "fixed",
        top: APP_HEADER_HEIGHT,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        background: LIGHT.appBg,
        overflow: "auto",
      }}
    >
      <div style={{ maxWidth: 1650, width: "100%", margin: "0 auto", padding: "1.5rem 2rem 3rem", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800, color: LIGHT.text, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ContactsIcon width={22} height={22} />
              Contacts
            </h1>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: LIGHT.textSecondary }}>
              {counts.ALL} contact{counts.ALL === 1 ? "" : "s"} · added automatically from incoming email
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <ContactsSearch initialQuery={query} stage={active} />
            <AddContactButton />
          </div>
        </div>

        {/* Lifecycle filter */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
          {FILTERS.map((f) => {
            const on = active === f.key;
            const params = new URLSearchParams();
            if (f.key !== "ALL") params.set("stage", f.key);
            if (query) params.set("q", query);
            const qs = params.toString();
            const href = qs ? `/contacts?${qs}` : "/contacts";
            return (
              <Link key={f.key} href={href} style={chip(on)}>
                {f.label}
                <span style={{ opacity: 0.75, fontWeight: 700 }}> · {counts[f.key] ?? 0}</span>
              </Link>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <div
            style={{
              border: `1px dashed ${LIGHT.borderStrong}`,
              borderRadius: 12,
              background: LIGHT.panel,
              padding: "3rem 1.5rem",
              textAlign: "center",
              color: LIGHT.textSecondary,
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{query ? "🔍" : "📭"}</div>
            <div style={{ fontSize: "1rem", fontWeight: 600, color: LIGHT.text }}>
              {query
                ? `No contacts match “${query}”`
                : active === "ALL"
                  ? "No contacts yet"
                  : "No contacts in this stage"}
            </div>
            <p style={{ fontSize: "0.85rem", marginTop: "0.4rem" }}>
              {query
                ? "Try a different name or email."
                : "Contacts appear here as real people email your mailbox."}
            </p>
          </div>
        ) : (
          <>
            <ContactsTable rows={rows} />

            {/* Pagination */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                marginTop: "0.9rem",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "0.8rem", color: LIGHT.textMuted }}>
                Showing <strong style={{ color: LIGHT.textSecondary }}>{rangeStart}–{rangeEnd}</strong> of {total}
              </span>
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <PageLink href={pageHref(page - 1)} disabled={page <= 1}>
                    ← Prev
                  </PageLink>
                  <span style={{ fontSize: "0.8rem", color: LIGHT.textSecondary, padding: "0 0.4rem" }}>
                    Page {page} of {totalPages}
                  </span>
                  <PageLink href={pageHref(page + 1)} disabled={page >= totalPages}>
                    Next →
                  </PageLink>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const style: CSSProperties = {
    fontSize: "0.8rem",
    fontWeight: 600,
    padding: "0.35rem 0.75rem",
    borderRadius: 8,
    border: `1px solid ${LIGHT.border}`,
    background: LIGHT.panel,
    color: disabled ? LIGHT.textMuted : LIGHT.text,
    textDecoration: "none",
    pointerEvents: disabled ? "none" : "auto",
    opacity: disabled ? 0.5 : 1,
  };
  if (disabled) return <span style={style}>{children}</span>;
  return (
    <Link href={href} style={style}>
      {children}
    </Link>
  );
}

function chip(active: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.35rem 0.8rem",
    borderRadius: 999,
    fontSize: "0.8rem",
    fontWeight: active ? 700 : 500,
    textDecoration: "none",
    border: `1px solid ${active ? LIGHT.accent : LIGHT.border}`,
    background: active ? LIGHT.accent : LIGHT.panel,
    color: active ? "#fff" : LIGHT.textSecondary,
  };
}
