import Link from "next/link";
import type { CSSProperties } from "react";
import { getOrCreateTenant } from "../../lib/tenant";
import { listCompanies } from "../../lib/repositories/company.repository";
import { LIGHT, initials, avatarGradient } from "../zoho/_components/ui";
import { APP_HEADER_HEIGHT } from "../_components/app-nav";
import { CompaniesIcon } from "../_components/icons";
import { CompaniesSearch } from "./CompaniesSearch";

/**
 * /companies — contacts rolled up by email domain. Each "company" is a domain
 * with its people, customer count, and open pipeline value, shown as a card grid.
 * Searchable by domain and paginated.
 */
export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

const money = (v: number) => `$${Math.round(v).toLocaleString()}`;

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const all = await listCompanies();

  // Companies are derived (grouped by domain), so filter + paginate in memory.
  const query = (searchParams.q ?? "").trim();
  const filtered = query
    ? all.filter((c) => c.domain.includes(query.toLowerCase()))
    : all;

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requested = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const page = Math.min(requested, totalPages);
  const skip = (page - 1) * PAGE_SIZE;
  const companies = filtered.slice(skip, skip + PAGE_SIZE);

  const totalPeople = all.reduce((s, c) => s + c.contactCount, 0);
  const totalPipeline = all.reduce((s, c) => s + c.openDealValue, 0);

  const rangeStart = total === 0 ? 0 : skip + 1;
  const rangeEnd = Math.min(skip + PAGE_SIZE, total);
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("page", String(p));
    return `/companies?${params.toString()}`;
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
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800, color: LIGHT.text, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <CompaniesIcon width={22} height={22} />
              Companies
            </h1>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: LIGHT.textSecondary }}>
              {all.length} compan{all.length === 1 ? "y" : "ies"} · {totalPeople} {totalPeople === 1 ? "person" : "people"}
              {totalPipeline > 0 && (
                <>
                  {" · "}
                  <strong style={{ color: LIGHT.success }}>{money(totalPipeline)}</strong> open pipeline
                </>
              )}
            </p>
          </div>
          <CompaniesSearch initialQuery={query} />
        </div>

        {companies.length === 0 ? (
          <div style={{ border: `1px dashed ${LIGHT.borderStrong}`, borderRadius: 14, background: LIGHT.panel, padding: "3.5rem 1.5rem", textAlign: "center", color: LIGHT.textSecondary }}>
            <div style={{ display: "inline-flex", color: LIGHT.textMuted, marginBottom: "0.6rem" }}>
              <CompaniesIcon width={34} height={34} />
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 600, color: LIGHT.text }}>
              {query ? `No companies match “${query}”` : "No companies yet"}
            </div>
            <p style={{ fontSize: "0.85rem", marginTop: "0.4rem" }}>
              {query
                ? "Try a different domain."
                : "Business contacts (non-personal email domains) will roll up here."}
            </p>
          </div>
        ) : (
          <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
              gap: "0.9rem",
            }}
          >
            {companies.map((c) => (
              <Link
                key={c.domain}
                href={`/companies/${encodeURIComponent(c.domain)}`}
                className="email-row"
                style={{
                  display: "block",
                  background: LIGHT.panel,
                  border: `1px solid ${LIGHT.border}`,
                  borderRadius: 14,
                  padding: "1rem 1.1rem",
                  textDecoration: "none",
                  boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span
                    style={{
                      width: 44,
                      height: 44,
                      flexShrink: 0,
                      borderRadius: 12,
                      background: avatarGradient(c.domain),
                      color: "#fff",
                      fontSize: "0.9rem",
                      fontWeight: 800,
                      letterSpacing: "0.02em",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {initials(c.domain)}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: LIGHT.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.domain}
                    </div>
                    <div style={{ fontSize: "0.74rem", color: LIGHT.textMuted }}>
                      Last active {c.lastActivity.toLocaleDateString()}
                    </div>
                  </div>
                  {c.customerCount > 0 && (
                    <span style={customerBadge}>
                      {c.customerCount} customer{c.customerCount === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div
                  style={{
                    display: "flex",
                    marginTop: "0.9rem",
                    paddingTop: "0.85rem",
                    borderTop: `1px solid ${LIGHT.border}`,
                  }}
                >
                  <Stat label="People" value={String(c.contactCount)} />
                  <Stat label="Customers" value={String(c.customerCount)} />
                  <Stat
                    label="Open pipeline"
                    value={c.openDealValue > 0 ? money(c.openDealValue) : "—"}
                    color={c.openDealValue > 0 ? LIGHT.success : undefined}
                  />
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              marginTop: "1rem",
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

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: "1.05rem", fontWeight: 800, color: color ?? LIGHT.text, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </div>
      <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: LIGHT.textMuted, marginTop: "0.15rem" }}>
        {label}
      </div>
    </div>
  );
}

const customerBadge: CSSProperties = {
  flexShrink: 0,
  fontSize: "0.66rem",
  fontWeight: 700,
  letterSpacing: "0.02em",
  padding: "0.16rem 0.55rem",
  borderRadius: 999,
  background: LIGHT.successSoft,
  color: LIGHT.success,
  whiteSpace: "nowrap",
};
