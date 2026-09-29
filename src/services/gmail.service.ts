import { google, gmail_v1 } from "googleapis";
import { CryptoService } from "./crypto.service";
import { gmailMessageSchema, type GmailHeaders } from "../lib/schemas/gmail";
import {
  parseGmailHeaders,
  normalizeSubject,
  NO_SUBJECT,
} from "../lib/gmail-helpers";

/** Encrypted-at-rest OAuth credentials for a Gmail mailbox. */
export interface GmailCredentials {
  accessToken: string; // Encrypted
  refreshToken: string; // Encrypted
  tokenExpiry: Date;
}

/** A single parsed Gmail message. */
export interface SyncMessageResult {
  id: string;
  threadId: string;
  sender: string;
  recipients: string[];
  /** Raw per-message subject (NOT normalized). */
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  receivedAt: Date;
  isIncoming: boolean;
  /** Gmail's short preview snippet for this message. */
  snippet: string;
  /** Parsed, lower-cased header lookup map. */
  headers: GmailHeaders;
  /** Gmail label ids on this message (e.g. CATEGORY_PROMOTIONS). */
  labelIds: string[];
}

/** Result of fetching a full Gmail thread. */
export interface ThreadFetchResult {
  /** Normalized subject taken from the chronologically-first message. */
  threadSubject: string;
  /** Preview snippet from the most recent message. */
  threadSnippet: string;
  /** Messages ordered oldest-first. */
  messages: SyncMessageResult[];
}

export class GmailService {
  public static async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI || `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/auth/callback/gmail`
    );
    const { tokens } = await oauth2Client.getToken(code);
    return {
      accessToken: tokens.access_token ?? "",
      refreshToken: tokens.refresh_token ?? "",
      expiresIn: tokens.expiry_date ? Math.max(0, Math.floor((tokens.expiry_date - Date.now()) / 1000)) : 3600,
    };
  }

  public static async getUserProfile(accessToken: string): Promise<{ emailAddress: string }> {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    return { emailAddress: profile.data.emailAddress ?? "" };
  }


  private static getOAuth2Client(credentials: GmailCredentials) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: CryptoService.decrypt(credentials.accessToken),
      refresh_token: CryptoService.decrypt(credentials.refreshToken),
      expiry_date: credentials.tokenExpiry.getTime(),
    });

    return oauth2Client;
  }

  /**
   * Lists thread ids matching a Gmail search query (e.g.
   * `newer_than:1d in:inbox -category:promotions`), newest first.
   */
  public static async listThreadIds(
    credentials: GmailCredentials,
    query: string,
    maxResults = 25
  ): Promise<string[]> {
    const auth = this.getOAuth2Client(credentials);
    const gmail = google.gmail({ version: "v1", auth });

    const res = await gmail.users.threads.list({
      userId: "me",
      maxResults,
      q: query,
    });

    return (res.data.threads ?? [])
      .map((thread) => thread.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  }

  /**
   * Fetches the user's recent "Sent" mail (newer than `windowDays`), fully
   * parsed. Used once per batch sync to build the cold-start style corpus.
   * Per-message fetch failures are skipped, not thrown.
   */
  public static async listSentMessages(
    credentials: GmailCredentials,
    windowDays: number,
    maxResults = 50
  ): Promise<SyncMessageResult[]> {
    const auth = this.getOAuth2Client(credentials);
    const gmail = google.gmail({ version: "v1", auth });

    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults,
      q: `in:sent newer_than:${windowDays}d`,
    });

    const ids = (listRes.data.messages ?? [])
      .map((message) => message.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const messages: SyncMessageResult[] = [];
    for (const id of ids) {
      try {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "full",
        });
        const parsed = this.parseRawMessage(detail.data, id);
        if (parsed) {
          messages.push(parsed);
        }
      } catch (error) {
        console.warn(`[GmailService] Could not fetch sent message ${id}:`, error);
      }
    }
    return messages;
  }

  /**
   * Fetches a full Gmail thread, returning the normalized thread subject, a
   * preview snippet, and every message ordered chronologically.
   */
  public static async fetchThreadMessages(
    threadId: string,
    credentials: GmailCredentials,
    userEmail: string
  ): Promise<ThreadFetchResult> {
    const auth = this.getOAuth2Client(credentials);
    const gmail = google.gmail({ version: "v1", auth });

    const threadRes = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });

    const rawMessages = threadRes.data.messages ?? [];
    const parsedMessages: SyncMessageResult[] = [];

    for (const msg of rawMessages) {
      const parsed = this.parseRawMessage(msg, threadId, userEmail);
      if (parsed) {
        parsedMessages.push(parsed);
      }
    }

    parsedMessages.sort(
      (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()
    );

    const earliest = parsedMessages[0];
    const latest = parsedMessages[parsedMessages.length - 1];

    return {
      threadSubject: normalizeSubject(earliest?.subject),
      threadSnippet: latest?.snippet ?? "",
      messages: parsedMessages,
    };
  }

  /**
   * Sends an email reply on a thread via the Gmail API. `inReplyTo`/`references`
   * carry the RFC `Message-ID` of the message being replied to so the reply
   * threads correctly in every client. Returns the new message's Gmail id.
   */
  public static async sendDraft(
    params: {
      threadId?: string;
      to: string;
      subject: string;
      bodyText: string;
      bodyHtml?: string;
      /** RFC `Message-ID` of the message being replied to (NOT the thread id). */
      inReplyTo?: string;
      references?: string;
    },
    credentials: GmailCredentials
  ): Promise<string> {
    const auth = this.getOAuth2Client(credentials);
    const gmail = google.gmail({ version: "v1", auth });

    const boundary = "boundary_" + Math.random().toString(36).substring(2);
    const headerLines = [
      `To: ${params.to}`,
      `Subject: ${this.encodeHeaderWord(params.subject)}`,
      "MIME-Version: 1.0",
    ];
    // Threading headers carry the real Message-ID, not the Gmail thread id.
    if (params.inReplyTo) {
      headerLines.push(`In-Reply-To: ${params.inReplyTo}`);
    }
    if (params.references) {
      headerLines.push(`References: ${params.references}`);
    }
    headerLines.push(`Content-Type: multipart/alternative; boundary=${boundary}`);

    const messageParts = [
      ...headerLines,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      params.bodyText,
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      params.bodyHtml ||
        `<html><body>${params.bodyText.replace(/\n/g, "<br>")}</body></html>`,
      "",
      `--${boundary}--`,
    ];

    const rawMessage = Buffer.from(messageParts.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const sendRes = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: rawMessage,
        ...(params.threadId ? { threadId: params.threadId } : {}),
      },
    });

    // Validate the Gmail response shape via the shared message schema.
    const parsed = gmailMessageSchema.safeParse(sendRes.data);
    if (!parsed.success) {
      throw new Error("Gmail send returned an unrecognized response shape");
    }
    return parsed.data.id;
  }

  /**
   * Force-refreshes a mailbox's OAuth access token and returns NEW
   * encrypted-at-rest credentials. The send pipeline calls this when a send
   * fails with 401 because the cached access token expired in memory and the
   * client's lazy auto-refresh did not catch it.
   */
  public static async refreshAccessToken(
    credentials: GmailCredentials
  ): Promise<GmailCredentials> {
    const oauth2Client = this.getOAuth2Client(credentials);
    const { credentials: refreshed } = await oauth2Client.refreshAccessToken();

    if (!refreshed.access_token) {
      throw new Error("Gmail token refresh returned no access token");
    }
    return {
      accessToken: CryptoService.encrypt(refreshed.access_token),
      // Google usually omits a new refresh token — keep the existing one.
      refreshToken: refreshed.refresh_token
        ? CryptoService.encrypt(refreshed.refresh_token)
        : credentials.refreshToken,
      tokenExpiry: refreshed.expiry_date
        ? new Date(refreshed.expiry_date)
        : new Date(Date.now() + 3600 * 1000),
    };
  }

  /**
   * Revokes a mailbox's OAuth grant at Google. Accepts the encrypted access
   * token as stored on `GmailAccount`. Throws on a non-2xx response so callers
   * can decide whether to treat revocation failure as fatal.
   */
  public static async revokeAccess(
    encryptedAccessToken: string
  ): Promise<void> {
    const token = CryptoService.decrypt(encryptedAccessToken);
    const res = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    if (!res.ok) {
      throw new Error(
        `Google token revocation failed with status ${res.status}`
      );
    }
  }

  /**
   * Validates and parses a single raw Gmail message into a `SyncMessageResult`.
   * Returns `null` when the message is missing fields the system requires.
   * When `userEmail` is supplied, `isIncoming` is computed from the `From`
   * header; otherwise it defaults to `false` (e.g. messages from "Sent").
   */
  private static parseRawMessage(
    msg: gmail_v1.Schema$Message,
    fallbackThreadId: string,
    userEmail?: string
  ): SyncMessageResult | null {
    const meta = gmailMessageSchema.safeParse(msg);
    if (!meta.success) {
      return null; // Skip messages missing the fields we require.
    }

    const headers = parseGmailHeaders(msg.payload?.headers);
    const sender = headers["from"] ?? "";
    const recipients = [
      ...(headers["to"] ?? "").split(","),
      ...(headers["cc"] ?? "").split(","),
    ]
      .map((value) => value.trim())
      .filter(Boolean);

    const { text, html } = this.extractBodyParts(msg.payload);
    const dateHeader = headers["date"] ?? "";
    const normalizedEmail = userEmail?.toLowerCase() ?? "";

    return {
      id: meta.data.id,
      threadId: meta.data.threadId ?? fallbackThreadId,
      sender,
      recipients,
      subject: headers["subject"] ?? NO_SUBJECT,
      bodyText: text || meta.data.snippet || "",
      bodyHtml: html,
      receivedAt: dateHeader ? new Date(dateHeader) : new Date(),
      isIncoming: normalizedEmail
        ? !sender.toLowerCase().includes(normalizedEmail)
        : false,
      snippet: meta.data.snippet ?? "",
      headers,
      labelIds: meta.data.labelIds ?? [],
    };
  }

  /**
   * Encodes a header value as an RFC 2047 MIME encoded-word when it contains
   * non-ASCII characters (emoji, accents). Pure-ASCII values pass through.
   */
  private static encodeHeaderWord(value: string): string {
    if (/^[\x00-\x7F]*$/.test(value)) {
      return value;
    }
    return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
  }

  /**
   * Recursively walks a Gmail MIME part tree, collecting decoded text/plain and
   * text/html bodies.
   */
  private static extractBodyParts(
    payload: gmail_v1.Schema$MessagePart | undefined
  ): { text: string; html?: string } {
    let text = "";
    let html = "";

    const traverse = (part: gmail_v1.Schema$MessagePart): void => {
      if (part.mimeType === "text/plain" && part.body?.data) {
        text += Buffer.from(part.body.data, "base64").toString("utf-8");
      } else if (part.mimeType === "text/html" && part.body?.data) {
        html += Buffer.from(part.body.data, "base64").toString("utf-8");
      }

      for (const child of part.parts ?? []) {
        traverse(child);
      }
    };

    if (payload) {
      traverse(payload);
    }

    return { text, html: html || undefined };
  }
}
