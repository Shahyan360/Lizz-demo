import Link from "next/link";
import type { ZohoAccount } from "../../../lib/schemas/zoho";
import { initials, avatarGradient, folderIcon, LIGHT } from "./ui";
import { ComposeButton } from "./ComposeButton";

/**
 * Light top bar for the mailbox window: mailbox identity on the left, the
 * current folder in the middle, and an account switcher on the right.
 */
export function ZohoAccountHeader({
  accounts,
  activeAccountId,
  folderName,
}: {
  accounts: ZohoAccount[];
  activeAccountId: string;
  folderName?: string;
}) {
  const active =
    accounts.find((a) => a.accountId === activeAccountId) ?? accounts[0];
  const name =
    active.displayName ?? active.primaryEmailAddress ?? active.accountId;

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        padding: "0.7rem 1rem",
        background: LIGHT.panelAlt,
        borderBottom: `1px solid ${LIGHT.border}`,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: avatarGradient(active.primaryEmailAddress ?? name),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: "0.85rem",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          {initials(name)}
        </div>
        <div>
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: LIGHT.text }}>
            {name}
          </div>
          <div style={{ fontSize: "0.75rem", color: LIGHT.textMuted }}>
            {active.primaryEmailAddress ?? "Zoho mailbox"}
          </div>
        </div>
      </div>

      {folderName && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.45rem",
            fontSize: "0.95rem",
            fontWeight: 700,
            color: LIGHT.text,
          }}
        >
          <span>{folderIcon(folderName)}</span>
          {folderName}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <ComposeButton />
        {accounts.length > 1 &&
          accounts.map((account) => {
            const isActive = account.accountId === activeAccountId;
            const label =
              account.primaryEmailAddress ??
              account.displayName ??
              account.accountId;
            return (
              <Link
                key={account.accountId}
                href={`/zoho?accountId=${account.accountId}`}
                style={{
                  padding: "0.35rem 0.8rem",
                  borderRadius: 999,
                  fontSize: "0.8rem",
                  border: `1px solid ${LIGHT.border}`,
                  background: isActive ? LIGHT.accent : LIGHT.panel,
                  color: isActive ? "#fff" : LIGHT.textSecondary,
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {label}
              </Link>
            );
          })}
      </div>
    </header>
  );
}
