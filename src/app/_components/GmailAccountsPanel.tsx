import type { GmailAccount } from "@prisma/client";
import {
  disconnectGmailAccount,
  setActiveGmailAccount,
} from "../actions/gmail.actions";
import { PendingForm } from "./PendingForm";
import { SubmitButton } from "./SubmitButton";

interface GmailAccountsPanelProps {
  accounts: GmailAccount[];
}

const CONNECT_URL = "/api/auth/gmail";

/** Sidebar panel for connecting, switching, and disconnecting Gmail mailboxes. */
export function GmailAccountsPanel({ accounts }: GmailAccountsPanelProps) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "0.75rem",
        padding: "1.5rem",
        backdropFilter: "blur(8px)",
      }}
    >
      <h3
        className="font-display"
        style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.35rem" }}
      >
        Gmail Mailboxes
      </h3>
      <p
        style={{
          color: "var(--text-muted)",
          fontSize: "0.75rem",
          lineHeight: 1.4,
          marginBottom: "1.25rem",
        }}
      >
        Live sync always runs against the active mailbox. The 6-agent pipeline
        drafts replies only for genuine personal mail.
      </p>

      {accounts.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {accounts.map((account) => (
            <AccountRow key={account.id} account={account} />
          ))}
          <a
            href={CONNECT_URL}
            className="transition-all"
            style={{
              display: "block",
              textAlign: "center",
              border: "1px dashed var(--border-color)",
              color: "var(--text-secondary)",
              padding: "0.5rem",
              borderRadius: "0.375rem",
              fontWeight: 600,
              fontSize: "0.75rem",
              marginTop: "0.25rem",
            }}
          >
            + Connect another Gmail
          </a>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div>
      <a
        href={CONNECT_URL}
        className="transition-all"
        style={{
          display: "block",
          textAlign: "center",
          background: "linear-gradient(135deg, #8B5CF6, var(--color-primary))",
          color: "#FFF",
          padding: "0.6rem",
          borderRadius: "0.375rem",
          fontWeight: 600,
          fontSize: "0.75rem",
          boxShadow: "0 2px 10px rgba(139, 92, 246, 0.2)",
        }}
      >
        🔗 Connect Gmail Account
      </a>
      <span
        style={{
          fontSize: "0.65rem",
          color: "var(--text-muted)",
          marginTop: "0.4rem",
          display: "block",
        }}
      >
        No mailbox connected yet. Link a real inbox to start drafting replies.
      </span>
    </div>
  );
}

function AccountRow({ account }: { account: GmailAccount }) {
  return (
    <div
      style={{
        border: `1px solid ${
          account.isActive
            ? "rgba(16, 185, 129, 0.35)"
            : "var(--border-color)"
        }`,
        background: account.isActive
          ? "rgba(16, 185, 129, 0.06)"
          : "rgba(255, 255, 255, 0.02)",
        borderRadius: "0.5rem",
        padding: "0.75rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <span
          style={{
            fontWeight: 600,
            color: "#FFF",
            fontSize: "0.75rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {account.email}
        </span>
        {account.isActive && (
          <span
            style={{
              fontSize: "0.6rem",
              fontWeight: 700,
              color: "var(--color-success)",
              background: "rgba(16, 185, 129, 0.12)",
              padding: "0.15rem 0.4rem",
              borderRadius: "0.25rem",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Active
          </span>
        )}
      </div>

      <p
        style={{
          fontSize: "0.65rem",
          color:
            account.syncStatus === "ERROR"
              ? "var(--color-danger)"
              : "var(--text-muted)",
          margin: "0.3rem 0 0.1rem",
        }}
      >
        Sync status: {account.syncStatus}
      </p>
      <p
        style={{
          fontSize: "0.6rem",
          color: "var(--text-muted)",
          margin: "0 0 0.6rem",
        }}
      >
        Last synced: {formatLastSynced(account.lastSyncedAt)}
      </p>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        {!account.isActive && (
          <PendingForm
            action={setActiveGmailAccount.bind(null, account.id)}
            style={{ flex: 1 }}
          >
            <SubmitButton
              pendingLabel="Switching…"
              className="transition-all"
              style={{
                width: "100%",
                background: "rgba(99, 102, 241, 0.12)",
                border: "1px solid rgba(99, 102, 241, 0.25)",
                color: "var(--color-primary)",
                padding: "0.35rem 0.5rem",
                borderRadius: "0.3rem",
                fontSize: "0.7rem",
                fontWeight: 600,
              }}
            >
              Set as active
            </SubmitButton>
          </PendingForm>
        )}
        <PendingForm
          action={disconnectGmailAccount.bind(null, account.id)}
          style={{ flex: 1 }}
        >
          <SubmitButton
            pendingLabel="Removing…"
            className="transition-all"
            style={{
              width: "100%",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              color: "var(--color-danger)",
              padding: "0.35rem 0.5rem",
              borderRadius: "0.3rem",
              fontSize: "0.7rem",
              fontWeight: 600,
            }}
          >
            Disconnect
          </SubmitButton>
        </PendingForm>
      </div>
    </div>
  );
}

/** Formats a mailbox's last-sync timestamp for display. */
function formatLastSynced(date: Date | null): string {
  if (!date) {
    return "Never";
  }
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
