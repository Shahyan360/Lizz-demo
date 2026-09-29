import Link from "next/link";
import type { CSSProperties } from "react";
import { getOrCreateTenant } from "../../../lib/tenant";
import { getCompanyContacts } from "../../../lib/repositories/company.repository";
import { LIGHT, initials, avatarGradient } from "../../zoho/_components/ui";
import { APP_HEADER_HEIGHT } from "../../_components/app-nav";
import { CompaniesIcon } from "../../_components/icons";

/** /companies/[domain] — the people and deals under one company domain. */
export const dynamic = "force-dynamic";

const money = (v: number | null) =>
  v == null ? null : `$${Math.round(v).toLocaleString()}`;

export default async function CompanyDetailPage({
  params,
}: {
  params: { domain: string };
}) {
  const domain = decodeURIComponent(params.domain);
  const contacts = await getCompanyContacts(domain);

  const allDeals = contacts.flatMap((c) => c.deals);
  const openValue = allDeals
    .filter((d) => d.stage === "NEW" || d.stage === "QUOTED")
    .reduce((s, d) => s + (d.value ?? 0), 0);

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
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem 1.25rem 4rem" }}>
        <Link href="/companies" style={{ fontSize: "0.82rem", color: LIGHT.textSecondary, textDecoration: "none", display: "inline-block", marginBottom: "1rem" }}>
          ← All companies
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "1.25rem" }}>
          <span
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: avatarGradient(domain),
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CompaniesIcon width={22} height={22} />
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: LIGHT.text }}>{domain}</h1>
            <p style={{ margin: "0.15rem 0 0", fontSize: "0.82rem", color: LIGHT.textSecondary }}>
              {contacts.length} {contacts.length === 1 ? "person" : "people"}
              {openValue > 0 && (
                <>
                  {" · "}
                  <strong style={{ color: LIGHT.success }}>{money(openValue)}</strong> open pipeline
                </>
              )}
            </p>
          </div>
        </div>

        <h2 style={{ fontSize: "0.95rem", fontWeight: 800, color: LIGHT.text, margin: "0 0 0.7rem" }}>People</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          {contacts.map((c) => {
            const openDeals = c.deals.filter((d) => d.stage === "NEW" || d.stage === "QUOTED");
            return (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="email-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.7rem",
                  background: LIGHT.panel,
                  border: `1px solid ${LIGHT.border}`,
                  borderRadius: 11,
                  padding: "0.7rem 0.9rem",
                  textDecoration: "none",
                }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: avatarGradient(c.email),
                    color: "#fff",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {initials(c.name || c.email)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, color: LIGHT.text }}>
                    {c.name || c.email}
                  </span>
                  <span style={{ display: "block", fontSize: "0.76rem", color: LIGHT.textMuted }}>{c.email}</span>
                </span>
                <span style={stageBadge(c.lifecycleStage)}>{stageLabel(c.lifecycleStage)}</span>
                {openDeals.length > 0 && (
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: LIGHT.success, whiteSpace: "nowrap" }}>
                    {openDeals.length} deal{openDeals.length === 1 ? "" : "s"}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function stageLabel(stage: string): string {
  return stage === "NEW" ? "New" : stage === "ACTIVE" ? "Active" : "Customer";
}
function stageBadge(stage: string): CSSProperties {
  const map: Record<string, { bg: string; fg: string }> = {
    NEW: { bg: LIGHT.accentSoft, fg: LIGHT.accent },
    ACTIVE: { bg: "#fff2e0", fg: "#c2620e" },
    CUSTOMER: { bg: LIGHT.successSoft, fg: LIGHT.success },
  };
  const c = map[stage] ?? map.NEW;
  return {
    flexShrink: 0,
    fontSize: "0.66rem",
    fontWeight: 700,
    padding: "0.14rem 0.5rem",
    borderRadius: 999,
    background: c.bg,
    color: c.fg,
  };
}
