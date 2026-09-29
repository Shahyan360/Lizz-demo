import { ZohoService } from "../../services/zoho.service";

/** IDs needed to deep-link a Zoho message in the web UI or Lizzz mailbox. */
export interface EmailLinkTarget {
  accountId: string;
  folderId: string;
  /** Zoho web hash folder segment when needed (e.g. inbox, sales/sales - inbox). */
  folderSlug: string;
  messageId: string;
  threadId?: string;
}

/** Incoming email shown at the bottom of drafts for human reviewers. */
export interface DraftEmailReference {
  fromAddress: string;
  fromName?: string | null;
  subject: string;
  bodyText: string;
  receivedAt?: Date;
}

export function zohoMailDomain(): string {
  return process.env.ZOHO_MAIL_DOMAIN?.trim() || "mail.zoho.com";
}

/**
 * Maps a Zoho folder path/name to the hash segment Zoho uses in the main UI.
 * Prefer folder `path` over `folderType` — many custom folders share type "Inbox".
 */
export function folderToZohoWebSlug(folder: {
  folderName?: string;
  folderType?: string;
  path?: string;
}): string {
  const path = folder.path?.trim().replace(/^\/+/, "");
  if (path) {
    if (path.toLowerCase() === "inbox") return "inbox";
    return path.toLowerCase();
  }

  const known: Record<string, string> = {
    inbox: "inbox",
    sent: "sent",
    drafts: "drafts",
    trash: "trash",
    spam: "spam",
    templates: "templates",
    outbox: "outbox",
  };

  const name = folder.folderName?.trim().toLowerCase();
  if (name && known[name]) return known[name];

  const type = folder.folderType?.trim().toLowerCase();
  if (type && known[type]) return known[type];

  if (name) return name.replace(/\s+/g, "-");
  return "inbox";
}

function encodeFolderSlug(slug: string): string {
  return slug
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Hash-route URL (what Zoho shows in the main window address bar).
 * Example: #mail/folder/inbox/p/{messageId}
 */
export function buildZohoEmailHashUrl(target: EmailLinkTarget): string {
  const domain = zohoMailDomain();
  const slug = encodeFolderSlug(target.folderSlug);
  const threadSeg =
    target.threadId && target.threadId !== "0" ? `/t/${target.threadId}` : "";
  return `https://${domain}/zm/#mail/folder/${slug}${threadSeg}/p/${target.messageId}`;
}

/**
 * Opens the full conversation thread in Zoho Mail (all messages in the chat).
 * Example: #mail/folder/inbox/t/{threadId}
 */
export function buildZohoThreadUrl(target: EmailLinkTarget): string | null {
  const threadId = target.threadId?.trim();
  if (!threadId || threadId === "0") return null;
  const domain = zohoMailDomain();
  const slug = encodeFolderSlug(target.folderSlug);
  return `https://${domain}/zm/#mail/folder/${slug}/t/${threadId}`;
}

/**
 * Opens a specific message in Zoho Mail (the parent email the bot replied to).
 * Uses popMail.do with accId + msgId — the format Zoho documents for
 * "Open in new window" ([Mail Options](https://www.zoho.com/mail/help/mail-options.html)).
 */
export function buildZohoEmailUrl(target: EmailLinkTarget): string {
  const domain = zohoMailDomain();
  const params = new URLSearchParams({
    accId: target.accountId,
    msgId: target.messageId,
  });
  return `https://${domain}/zm/popMail.do?${params.toString()}`;
}

async function folderSlugForId(
  folderId: string,
  accountId: string
): Promise<string> {
  const folder = await ZohoService.getFolderById(folderId, accountId);
  return folder ? folderToZohoWebSlug(folder) : "inbox";
}

async function targetWithFolderSlug(
  accountId: string,
  folderId: string,
  messageId: string,
  threadId?: string
): Promise<EmailLinkTarget> {
  return {
    accountId,
    folderId,
    folderSlug: await folderSlugForId(folderId, accountId),
    messageId,
    threadId,
  };
}

/**
 * Resolves canonical folder/account ids for the parent message the bot replied to.
 */
export async function resolveEmailLinkTarget(input: {
  messageId: string;
  folderId?: string;
  threadId?: string;
  accountId?: string;
}): Promise<EmailLinkTarget | null> {
  const messageId = input.messageId?.trim();
  if (!messageId) return null;

  const accountId = input.accountId ?? (await ZohoService.getAccountId());
  const inboxId = await ZohoService.getFolderIdByName("Inbox", accountId);

  const folderCandidates = [
    input.folderId,
    input.folderId === accountId ? inboxId : null,
    inboxId,
  ].filter((id, i, arr): id is string => !!id && arr.indexOf(id) === i);

  for (const folderId of folderCandidates) {
    const meta = await ZohoService.getEmailMeta(messageId, folderId, accountId);
    if (meta) {
      return targetWithFolderSlug(
        accountId,
        meta.folderId,
        meta.messageId,
        meta.threadId ?? input.threadId
      );
    }
  }

  const fallbackFolderId =
    input.folderId && input.folderId !== accountId
      ? input.folderId
      : inboxId;
  if (!fallbackFolderId) return null;

  return targetWithFolderSlug(
    accountId,
    fallbackFolderId,
    messageId,
    input.threadId
  );
}

/** Plain-text footer appended to draft replies for internal reference. */
export function draftReferenceBlock(ref: DraftEmailReference): string {
  const from = ref.fromName?.trim()
    ? `${ref.fromName.trim()} <${ref.fromAddress}>`
    : ref.fromAddress;
  const dateLine = ref.receivedAt
    ? `Date: ${ref.receivedAt.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })}\n`
    : "";
  const body = ref.bodyText.trim() || "(empty body)";

  return (
    `\n\n=================================\nreference ( remove before sending )\n` +
    `From: ${from}\n` +
    `Subject: ${ref.subject}\n` +
    dateLine +
    `\n---\n${body}\n` +
    `==================================`
  );
}

/** HTML footer appended to draft replies for internal reference. */
export function draftReferenceBlockHtml(ref: DraftEmailReference): string {
  const from = ref.fromName?.trim()
    ? `${escapeHtml(ref.fromName.trim())} &lt;${escapeHtml(ref.fromAddress)}&gt;`
    : escapeHtml(ref.fromAddress);
  const dateLine = ref.receivedAt
    ? `Date: ${escapeHtml(
        ref.receivedAt.toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      )}<br>`
    : "";
  const body = escapeHtml(ref.bodyText.trim() || "(empty body)").replace(
    /\n/g,
    "<br>"
  );

  return (
    `<br><br><p style="color:#666;font-size:13px;line-height:1.4">` +
    `=================================<br>` +
    `reference ( remove before sending )<br>` +
    `From: ${from}<br>` +
    `Subject: ${escapeHtml(ref.subject)}<br>` +
    dateLine +
    `<br>---<br>${body}<br>` +
    `==================================</p>`
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function hasDraftReferenceBlock(text: string): boolean {
  return text.includes("reference ( remove before sending )");
}
