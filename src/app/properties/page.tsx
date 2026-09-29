import { NavLink as Link } from "../_components/NavLink";
import type { CSSProperties } from "react";
import type { PropertyType, QualificationStatus } from "@prisma/client";
import { getPropertiesPage, propertyStatusCounts } from "../../lib/repositories/property.repository";
import { LIGHT } from "../zoho/_components/ui";
import { APP_HEADER_HEIGHT } from "../_components/app-nav";
import { PropertiesListWrapper } from "./_components/PropertiesListWrapper";
import { PropertiesSearch } from "./_components/PropertiesSearch";
import { PropertyTypeFilter } from "./_components/PropertyTypeFilter";

export const metadata = {
  title: "Properties — Property Intelligence",
  description: "Browse and manage residential property prospects for the Invisible Intercom sales team.",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const STATUS_FILTERS: { key: QualificationStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All Statuses" },
  { key: "NEW_PROSPECT", label: "New Prospects" },
  { key: "RESEARCHING", label: "Researching" },
  { key: "QUALIFIED", label: "Qualified" },
  { key: "PROPOSAL_READY", label: "Proposal Ready" },
  { key: "PROPOSAL_SENT", label: "Proposal Sent" },
  { key: "CUSTOMER", label: "Customers" },
  { key: "LOST", label: "Lost" },
];

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: { status?: string; type?: string; page?: string; q?: string; view?: string };
}) {
  const activeStatus = STATUS_FILTERS.some((f) => f.key === searchParams.status)
    ? (searchParams.status as QualificationStatus | "ALL")
    : "ALL";

  const activeType = ["APARTMENT", "MULTIFAMILY", "HOA", "CONDO_COMMUNITY"].includes(searchParams.type ?? "")
    ? (searchParams.type as PropertyType | "ALL")
    : "ALL";

  const query = (searchParams.q ?? "").trim();
  const view = searchParams.view === "cards" ? "cards" : "list";
  const pageParam = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  // Status and type params for db query
  const dbStatus = activeStatus === "ALL" ? undefined : activeStatus;
  const dbType = activeType === "ALL" ? undefined : activeType;

  const counts = await propertyStatusCounts();

  // If there are zero total properties in the system, show the onboarding welcome screen
  if (counts.ALL === 0 && !query && activeStatus === "ALL" && activeType === "ALL") {
    return renderEmptyState();
  }

  // Fetch the properties matching active filters/queries
  let { properties, total } = await getPropertiesPage({
    query,
    type: dbType,
    status: dbStatus,
    skip: (pageParam - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  // Handle page clamping
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pageParam, totalPages);
  const skip = (page - 1) * PAGE_SIZE;

  if (page !== pageParam) {
    const refetched = await getPropertiesPage({
      query,
      type: dbType,
      status: dbStatus,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });
    properties = refetched.properties;
  }

  const rangeStart = total === 0 ? 0 : skip + 1;
  const rangeEnd = Math.min(skip + PAGE_SIZE, total);

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (activeStatus !== "ALL") params.set("status", activeStatus);
    if (activeType !== "ALL") params.set("type", activeType);
    if (query) params.set("q", query);
    params.set("page", String(p));
    return `/properties?${params.toString()}`;
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
      <div
        style={{
          maxWidth: 1650,
          width: "100%",
          margin: "0 auto",
          padding: "1.5rem 2rem 3rem",
          boxSizing: "border-box",
        }}
      >
        {/* Page Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "1.35rem",
                fontWeight: 800,
                color: LIGHT.text,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              🏢 Properties
            </h1>
            <p
              style={{
                margin: "0.25rem 0 0",
                fontSize: "0.85rem",
                color: LIGHT.textSecondary,
              }}
            >
              {counts.ALL} property prospect{counts.ALL === 1 ? "" : "s"} · qualified using the property intelligence wizard
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              flex: 1,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <PropertiesSearch initialQuery={query} status={activeStatus} type={activeType} />
            <PropertyTypeFilter activeType={activeType} status={activeStatus} query={query} />
            <Link href={view === "cards" ? "/properties" : "/properties?view=cards"} style={{ ...viewToggleStyle, background: view === "cards" ? LIGHT.accentSoft : LIGHT.panel }}>
              {view === "cards" ? "☷ List" : "▦ Cards"}
            </Link>
            <Link
              href="/properties/new"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.55rem 1rem",
                borderRadius: 10,
                background: LIGHT.accent,
                color: "#fff",
                fontSize: "0.85rem",
                fontWeight: 700,
                textDecoration: "none",
                whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
              }}
            >
              + Add Property
            </Link>
          </div>
        </div>

        {/* Qualification Status Filter Chips */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.4rem",
            marginBottom: "1.25rem",
          }}
        >
          {STATUS_FILTERS.map((f) => {
            const on = activeStatus === f.key;
            const params = new URLSearchParams();
            if (f.key !== "ALL") params.set("status", f.key);
            if (activeType !== "ALL") params.set("type", activeType);
            if (query) params.set("q", query);
            const qs = params.toString();
            const href = qs ? `/properties?${qs}` : "/properties";
            return (
              <Link key={f.key} href={href} style={chipStyle(on)}>
                {f.label}
                <span style={{ opacity: 0.75, fontWeight: 700 }}>
                  {" "}
                  · {counts[f.key] ?? 0}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Main Content Area */}
        {total === 0 ? (
          <div
            style={{
              border: `1px dashed ${LIGHT.borderStrong}`,
              borderRadius: 12,
              background: LIGHT.panel,
              padding: "4rem 2rem",
              textAlign: "center",
              color: LIGHT.textSecondary,
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🔍</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: LIGHT.text }}>
              No matching properties
            </div>
            <p style={{ fontSize: "0.88rem", maxWidth: 420, margin: "0.4rem auto 1.5rem" }}>
              We couldn't find any properties matching the current filters or search query. Try clearing filters or searching for something else.
            </p>
            <Link
              href="/properties"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0.55rem 1.25rem",
                borderRadius: 10,
                background: LIGHT.panelAlt,
                border: `1px solid ${LIGHT.border}`,
                color: LIGHT.textSecondary,
                fontSize: "0.85rem",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Reset All Filters
            </Link>
          </div>
        ) : (
          <>
            <PropertiesListWrapper rows={properties} view={view} />

            {/* Pagination Controls */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                marginTop: "1.25rem",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "0.8rem", color: LIGHT.textMuted }}>
                Showing{" "}
                <strong style={{ color: LIGHT.textSecondary }}>
                  {rangeStart}–{rangeEnd}
                </strong>{" "}
                of {total}
              </span>
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <PageLink href={pageHref(page - 1)} disabled={page <= 1}>
                    ← Prev
                  </PageLink>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: LIGHT.textSecondary,
                      padding: "0 0.4rem",
                    }}
                  >
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

const viewToggleStyle: CSSProperties = { display: "inline-flex", alignItems: "center", padding: "0.55rem 0.8rem", borderRadius: 10, border: `1px solid ${LIGHT.border}`, color: LIGHT.textSecondary, fontSize: "0.82rem", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" };

// ─── Onboarding / Empty State ───
function renderEmptyState() {
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
      <div
        style={{
          maxWidth: 1400,
          width: "100%",
          margin: "0 auto",
          padding: "1.5rem 2rem 3rem",
          boxSizing: "border-box",
        }}
      >
        {/* Page Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "1.35rem",
                fontWeight: 800,
                color: LIGHT.text,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              🏢 Properties
            </h1>
            <p
              style={{
                margin: "0.25rem 0 0",
                fontSize: "0.85rem",
                color: LIGHT.textSecondary,
              }}
            >
              Residential community prospect database for Invisible Intercom sales
            </p>
          </div>

          <Link
            href="/properties/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.55rem 1rem",
              borderRadius: 10,
              background: LIGHT.accent,
              color: "#fff",
              fontSize: "0.85rem",
              fontWeight: 700,
              textDecoration: "none",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
            }}
          >
            + Add Property
          </Link>
        </div>

        {/* Empty Onboarding State */}
        <div
          style={{
            border: `1px dashed ${LIGHT.borderStrong}`,
            borderRadius: 16,
            background: LIGHT.panel,
            padding: "4rem 2rem",
            textAlign: "center",
            color: LIGHT.textSecondary,
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🏢</div>
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              color: LIGHT.text,
              marginBottom: "0.4rem",
            }}
          >
            No properties yet
          </div>
          <p
            style={{
              fontSize: "0.88rem",
              maxWidth: 420,
              margin: "0 auto 1.5rem",
            }}
          >
            Start by adding your first residential property prospect. The full listing table will
            appear here once properties have been added.
          </p>
          <Link
            href="/properties/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.65rem 1.4rem",
              borderRadius: 10,
              background: LIGHT.accent,
              color: "#fff",
              fontSize: "0.88rem",
              fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
            }}
          >
            + Add First Property
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Presentational Helpers ───

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

function chipStyle(active: boolean): CSSProperties {
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
