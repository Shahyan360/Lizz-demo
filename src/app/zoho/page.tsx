import { ZohoService } from "../../services/zoho.service";
import { ZohoAccountHeader } from "./_components/ZohoAccountHeader";
import { FolderSidebar } from "./_components/FolderSidebar";
import { EmailList } from "./_components/EmailList";
import { toEmailItem, EMAIL_PAGE_SIZE } from "./_components/email-item";
import { LIGHT } from "./_components/ui";
import { APP_HEADER_HEIGHT } from "../_components/app-nav";
import type {
  ZohoAccount,
  ZohoFolder,
  ZohoEmail,
} from "../../lib/schemas/zoho";
import { resolveEmailLinkTarget } from "../../lib/zoho/email-link";

// Always fetch live — never serve a cached snapshot of the mailbox.
export const dynamic = "force-dynamic";

type Search = { accountId?: string; folderId?: string; messageId?: string };

/** Everything the page needs, or a single displayable error. */
type PageData =
  | {
      ok: true;
      accounts: ZohoAccount[];
      activeAccountId: string;
      folders: ZohoFolder[];
      activeFolderId: string | null;
      emails: ZohoEmail[];
      deepLinkMessageId?: string;
      deepLinkFolderId?: string;
    }
  | { ok: false; error: string };

async function loadPage(search: Search): Promise<PageData> {
  try {
    const accounts = await ZohoService.getAccounts();
    if (accounts.length === 0) {
      return { ok: false, error: "Zoho returned no mail accounts." };
    }

    // Default to the first account when none is selected in the URL.
    const activeAccountId =
      accounts.find((a) => a.accountId === search.accountId)?.accountId ??
      accounts[0].accountId;

    const folders = await ZohoService.getFolders(activeAccountId);

    // Default to the Inbox folder (or the first folder) when none is selected.
    let activeFolderId =
      folders.find((f) => f.folderId === search.folderId)?.folderId ??
      folders.find((f) => f.folderName?.toLowerCase() === "inbox")?.folderId ??
      folders[0]?.folderId ??
      null;

    let deepLinkMessageId: string | undefined;
    let deepLinkFolderId: string | undefined;

    if (search.messageId?.trim()) {
      const target = await resolveEmailLinkTarget({
        messageId: search.messageId.trim(),
        folderId: search.folderId ?? activeFolderId ?? undefined,
        accountId: activeAccountId,
      });
      if (target) {
        deepLinkMessageId = target.messageId;
        deepLinkFolderId = target.folderId;
        if (folders.some((f) => f.folderId === target.folderId)) {
          activeFolderId = target.folderId;
        }
      } else {
        deepLinkMessageId = search.messageId.trim();
        deepLinkFolderId = search.folderId ?? activeFolderId ?? undefined;
      }
    }

    const emails = activeFolderId
      ? await ZohoService.getEmails({
          accountId: activeAccountId,
          folderId: activeFolderId,
          threadedMails: false,
          includeTo: true,
          limit: EMAIL_PAGE_SIZE,
        })
      : [];

    return {
      ok: true,
      accounts,
      activeAccountId,
      folders,
      activeFolderId,
      emails,
      deepLinkMessageId,
      deepLinkFolderId,
    };
  } catch (error) {
    // Full error (with the cause chain) goes to the server terminal.
    console.error("[ZohoPage] loadPage failed:", error);
    return { ok: false, error: describeError(error) };
  }
}

/**
 * Builds a full error description including the underlying `cause` chain.
 * Node's `fetch` throws a bare "fetch failed" whose real reason (ECONNREFUSED,
 * a TLS error, a proxy failure, DNS, …) lives on `error.cause`.
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const parts: string[] = [error.message];
  let cause: unknown = (error as { cause?: unknown }).cause;
  while (cause instanceof Error) {
    const code = (cause as { code?: string }).code;
    parts.push(`↳ ${code ? `[${code}] ` : ""}${cause.message}`);
    cause = (cause as { cause?: unknown }).cause;
  }
  return parts.join("  ");
}

export default async function ZohoPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const data = await loadPage(searchParams);

  if (!data.ok) {
    return (
      <main style={{ maxWidth: 1650, width: "100%", margin: "0 auto", padding: "2rem 1.5rem", boxSizing: "border-box" }}>
        <div style={{ marginBottom: "1.75rem" }}>
          <h1
            className="font-display"
            style={{ fontSize: "1.75rem", fontWeight: 700 }}
          >
            Zoho Mailbox
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.35rem" }}>
            Browse accounts, folders, and emails from the connected Zoho mailbox.
          </p>
        </div>
        <ErrorBox error={data.error} />
      </main>
    );
  }

  const activeFolder = data.folders.find(
    (f) => f.folderId === data.activeFolderId
  );
  const activeFolderName =
    activeFolder?.folderName ?? activeFolder?.path ?? "Mailbox";

  return (
    // Full-screen light mail app — covers the app's dark chrome entirely.
    <div
      style={{
        position: "fixed",
        top: APP_HEADER_HEIGHT,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        background: LIGHT.panel,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Light top bar: account + current folder */}
      <ZohoAccountHeader
        accounts={data.accounts}
        activeAccountId={data.activeAccountId}
        folderName={activeFolderName}
      />

      {/* 3-pane body: folders | list | reading */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px minmax(0, 1fr)",
          flex: 1,
          minHeight: 0,
        }}
      >
        <FolderSidebar
          accountId={data.activeAccountId}
          folders={data.folders}
          activeFolderId={data.activeFolderId}
        />

        <EmailList
          key={`${data.activeFolderId ?? "none"}:${data.deepLinkMessageId ?? ""}`}
          accountId={data.activeAccountId}
          folderId={data.activeFolderId ?? ""}
          initialMessageId={data.deepLinkMessageId}
          initialMessageFolderId={data.deepLinkFolderId}
          isDraftsFolder={
            (activeFolder?.folderType ?? "").toLowerCase() === "drafts" ||
            activeFolderName.toLowerCase() === "drafts"
          }
          isTrashFolder={
            (activeFolder?.folderType ?? "").toLowerCase() === "trash" ||
            activeFolderName.toLowerCase() === "trash"
          }
          initialEmails={data.emails.map(toEmailItem)}
        />
      </div>
    </div>
  );
}

function ErrorBox({ error }: { error: string }) {
  return (
    <div
      style={{
        background: "rgba(239, 68, 68, 0.08)",
        border: "1px solid rgba(239, 68, 68, 0.3)",
        borderRadius: 12,
        padding: "1.25rem 1.5rem",
      }}
    >
      <strong style={{ color: "var(--color-danger)" }}>
        Could not load the mailbox.
      </strong>
      <p
        style={{
          marginTop: "0.5rem",
          color: "var(--text-secondary)",
          fontSize: "0.9rem",
          fontFamily: "monospace",
        }}
      >
        {error}
      </p>
      <p
        style={{
          marginTop: "0.75rem",
          color: "var(--text-muted)",
          fontSize: "0.85rem",
        }}
      >
        Check the ZOHO_* values in your .env. If the mailbox is in the EU/India
        region, set ZOHO_ACCOUNTS_DOMAIN and ZOHO_MAIL_DOMAIN to the matching
        domains (e.g. accounts.zoho.eu / mail.zoho.eu).
      </p>
    </div>
  );
}
