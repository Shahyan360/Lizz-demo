import {
  zohoTokenResponseSchema,
  zohoAccountsResponseSchema,
  zohoFoldersResponseSchema,
  zohoMessagesResponseSchema,
  zohoMessageContentResponseSchema,
  zohoMessageHeaderResponseSchema,
  zohoAttachmentInfoResponseSchema,
  type ZohoAccount,
  type ZohoFolder,
  type ZohoEmail,
  type ZohoEmailDetail,
  type ZohoAttachmentItem,
  type ZohoMessageSummary,
} from "../lib/schemas/zoho";
import { prisma } from "../lib/prisma";
import { CryptoService } from "./crypto.service";

/** Zoho Mail client. Env: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN; optional ZOHO_ACCOUNTS_DOMAIN / ZOHO_MAIL_DOMAIN for non-US regions. */
export class ZohoService {
  private static cachedToken: { value: string; expiresAt: number } | null =
    null;
  private static refreshInFlight: Promise<string> | null = null;
  private static cachedAccountId: string | null = null;
  private static cachedFromAddress: string | null = null;
  private static cachedSignatureHtml: string | null = null;

  private static readonly EXPIRY_BUFFER_MS = 60_000;
  private static readonly TOKEN_MINT_ATTEMPTS = 3;
  private static readonly TOKEN_MINT_RETRY_MS = 1_500;

  private static normalizeDomain(value: string, fallback: string): string {
    const host = value
      .trim()
      .replace(/^["']|["']$/g, "") // stray surrounding quotes
      .replace(/^[a-z]+:\/\//i, "") // leading protocol (https://, http://)
      .replace(/\/.*$/, "") // any path/trailing slash
      .trim();
    return host || fallback;
  }

  private static accountsDomain(): string {
    return this.normalizeDomain(
      process.env.ZOHO_ACCOUNTS_DOMAIN ?? "",
      "accounts.zoho.com"
    );
  }

  private static mailDomain(): string {
    return this.normalizeDomain(
      process.env.ZOHO_MAIL_DOMAIN ?? "",
      "mail.zoho.com"
    );
  }

  private static requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(
        `${name} is not configured. Add it to your .env to use the Zoho integration.`
      );
    }
    return value;
  }

  public static async getActiveAccessToken(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.cachedToken && now < this.cachedToken.expiresAt) {
      return this.cachedToken.value;
    }

    if (!forceRefresh) {
      const stored = await this.loadStoredToken();
      if (stored && now < stored.expiresAt) {
        this.cachedToken = stored;
        return stored.value;
      }
    }

    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.mintAccessToken().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  private static readonly TOKEN_PROVIDER = "zoho";

  private static async loadStoredToken(): Promise<{
    value: string;
    expiresAt: number;
  } | null> {
    try {
      const row = await prisma.serviceToken.findUnique({
        where: { provider: this.TOKEN_PROVIDER },
      });
      if (!row) return null;
      return {
        value: CryptoService.decrypt(row.accessToken),
        expiresAt: row.expiresAt.getTime(),
      };
    } catch (error) {
      console.warn("[ZohoService] could not read persisted token:", error);
      return null;
    }
  }

  private static async persistToken(token: {
    value: string;
    expiresAt: number;
  }): Promise<void> {
    try {
      const expiresAt = new Date(token.expiresAt);
      const accessToken = CryptoService.encrypt(token.value);
      await prisma.serviceToken.upsert({
        where: { provider: this.TOKEN_PROVIDER },
        update: { accessToken, expiresAt },
        create: {
          provider: this.TOKEN_PROVIDER,
          accessToken,
          expiresAt,
        },
      });
    } catch (error) {
      console.warn("[ZohoService] could not persist token:", error);
    }
  }

  private static async mintAccessToken(): Promise<string> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.TOKEN_MINT_ATTEMPTS; attempt++) {
      try {
        return await this.mintAccessTokenOnce();
      } catch (error) {
        lastError = error;
        const msg = error instanceof Error ? error.message : String(error);
        const transient = /access denied|too many|rate limit|try again|timeout/i.test(
          msg
        );
        if (!transient || attempt === this.TOKEN_MINT_ATTEMPTS) {
          break;
        }
        const waitMs = this.TOKEN_MINT_RETRY_MS * attempt;
        console.warn(
          `[ZohoService] token mint attempt ${attempt}/${this.TOKEN_MINT_ATTEMPTS} ` +
            `failed (${msg}) — retrying in ${waitMs}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
    throw lastError;
  }

  private static async mintAccessTokenOnce(): Promise<string> {
    const params = new URLSearchParams({
      refresh_token: this.requireEnv("ZOHO_REFRESH_TOKEN"),
      client_id: this.requireEnv("ZOHO_CLIENT_ID"),
      client_secret: this.requireEnv("ZOHO_CLIENT_SECRET"),
      grant_type: "refresh_token",
    });

    const tokenUrl = `https://${this.accountsDomain()}/oauth/v2/token`;
    console.log("[ZohoService] POST", tokenUrl);
    let res: Response;
    try {
      res = await fetch(`${tokenUrl}?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        cache: "no-store",
      });
    } catch (error) {
      console.error("[ZohoService] token fetch threw:", error);
      throw error;
    }
    console.log("[ZohoService] token response status", res.status);

    const json = zohoTokenResponseSchema.parse(await res.json());

    if (json.error || !json.access_token) {
      throw new Error(
        `Zoho token refresh failed: ${json.error ?? "no access_token returned"}`
      );
    }

    const ttlMs = (json.expires_in ?? 3600) * 1000;
    this.cachedToken = {
      value: json.access_token,
      expiresAt: Date.now() + ttlMs - this.EXPIRY_BUFFER_MS,
    };
    await this.persistToken(this.cachedToken);
    return this.cachedToken.value;
  }

  private static async mailFetch(
    path: string,
    accept = "application/json"
  ): Promise<Response> {
    const url = `https://${this.mailDomain()}/api${path}`;

    const attempt = async (forceRefresh: boolean): Promise<Response> => {
      const token = await this.getActiveAccessToken(forceRefresh);
      try {
        return await fetch(url, {
          method: "GET",
          headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: accept },
          cache: "no-store",
        });
      } catch (error) {
        console.error("[ZohoService] mail fetch threw:", error);
        throw error;
      }
    };

    let res = await attempt(false);

    if (res.status === 401) {
      console.log("[ZohoService] 401 — refreshing token and retrying once");
      this.cachedToken = null;
      res = await attempt(true);
    }

    if (!res.ok) {
      throw new Error(
        `Zoho Mail API GET ${path} failed with status ${res.status}`
      );
    }
    return res;
  }

  private static async mailGet(path: string): Promise<unknown> {
    const res = await this.mailFetch(path, "application/json");
    return res.json();
  }

  private static async mailPost(path: string, body: unknown): Promise<unknown> {
    const url = `https://${this.mailDomain()}/api${path}`;
    const payload = JSON.stringify(body);

    const attempt = async (forceRefresh: boolean): Promise<Response> => {
      const token = await this.getActiveAccessToken(forceRefresh);
      return fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: payload,
        cache: "no-store",
      });
    };

    let res = await attempt(false);
    if (res.status === 401) {
      console.log("[ZohoService] 401 on POST — refreshing token, retrying once");
      this.cachedToken = null;
      res = await attempt(true);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Zoho Mail API POST ${path} failed with status ${res.status}: ${text}`
      );
    }
    return res.json();
  }

  private static async mailPut(path: string, body: unknown): Promise<unknown> {
    const url = `https://${this.mailDomain()}/api${path}`;
    const payload = JSON.stringify(body);

    const attempt = async (forceRefresh: boolean): Promise<Response> => {
      const token = await this.getActiveAccessToken(forceRefresh);
      return fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: payload,
        cache: "no-store",
      });
    };

    let res = await attempt(false);
    if (res.status === 401) {
      this.cachedToken = null;
      res = await attempt(true);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Zoho Mail API PUT ${path} failed with status ${res.status}: ${text}`
      );
    }
    return res.json().catch(() => ({}));
  }

  private static async mailDelete(path: string): Promise<void> {
    const url = `https://${this.mailDomain()}/api${path}`;

    const attempt = async (forceRefresh: boolean): Promise<Response> => {
      const token = await this.getActiveAccessToken(forceRefresh);
      return fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });
    };

    let res = await attempt(false);
    if (res.status === 401) {
      this.cachedToken = null;
      res = await attempt(true);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Zoho Mail API DELETE ${path} failed with status ${res.status}: ${text}`
      );
    }
  }

  public static async getAccounts(): Promise<ZohoAccount[]> {
    const parsed = zohoAccountsResponseSchema.parse(
      await this.mailGet("/accounts")
    );
    return parsed.data;
  }

  public static async getAccountId(): Promise<string> {
    if (this.cachedAccountId) {
      return this.cachedAccountId;
    }

    const accounts = await this.getAccounts();
    const account = accounts[0];
    if (!account) {
      throw new Error("Zoho returned no mail accounts for these credentials.");
    }

    this.cachedAccountId = account.accountId;
    this.cachedFromAddress = account.primaryEmailAddress ?? null;
    return this.cachedAccountId;
  }

  public static async getPrimaryEmailAddress(): Promise<string> {
    if (this.cachedFromAddress) {
      return this.cachedFromAddress;
    }
    await this.getAccountId(); // populates cachedFromAddress
    if (!this.cachedFromAddress) {
      const accounts = await this.getAccounts();
      this.cachedFromAddress = accounts[0]?.primaryEmailAddress ?? "";
    }
    return this.cachedFromAddress;
  }

  public static async getContacts(
    limit = 500
  ): Promise<{ name: string; email: string }[]> {
    const id = await this.getAccountId();
    const json = (await this.mailGet(
      `/accounts/${id}/contacts?limit=${limit}`
    )) as { data?: unknown };

    const rows = Array.isArray(json?.data) ? (json.data as unknown[]) : [];
    const out: { name: string; email: string }[] = [];
    for (const raw of rows) {
      const c = raw as Record<string, unknown>;
      const email = pickContactEmail(c);
      if (!email) continue;
      out.push({ name: pickContactName(c) || email, email });
    }
    return out;
  }

  /** Zoho send/draft APIs do not apply the web UI signature; fetch and append manually. */
  public static async getSignatureHtml(): Promise<string> {
    if (this.cachedSignatureHtml !== null) return this.cachedSignatureHtml;
    try {
      const json = (await this.mailGet("/accounts/signature")) as {
        data?: Array<{ name?: string; id?: string | number; content?: string }>;
      };
      const sigs = json?.data ?? [];
      if (sigs.length === 0) {
        this.cachedSignatureHtml = "";
        return "";
      }
      const wantId = process.env.ZOHO_SIGNATURE_ID?.trim();
      const wantName = process.env.ZOHO_SIGNATURE_NAME?.trim().toLowerCase();
      let chosen = sigs[0];
      if (wantId) {
        chosen = sigs.find((s) => String(s.id) === wantId) ?? chosen;
      } else if (wantName) {
        chosen = sigs.find((s) => (s.name ?? "").toLowerCase() === wantName) ?? chosen;
      }
      this.cachedSignatureHtml = chosen?.content ?? "";
      return this.cachedSignatureHtml;
    } catch (err) {
      console.warn("[ZohoService] could not fetch signature:", err);
      this.cachedSignatureHtml = "";
      return "";
    }
  }

  private static async postMessage(
    params: {
      toAddress: string;
      subject: string;
      content: string; // HTML body
      fromAddress?: string;
      ccAddress?: string;
      inReplyTo?: string;
      refHeader?: string;
      accountId?: string;
    },
    mode: "draft" | "send"
  ): Promise<unknown> {
    const id = params.accountId ?? (await this.getAccountId());
    const from = params.fromAddress ?? (await this.getPrimaryEmailAddress());

    const body: Record<string, string> = {
      fromAddress: from,
      toAddress: params.toAddress,
      subject: params.subject,
      content: params.content,
      mailFormat: "html",
    };
    if (mode === "draft") body.mode = "draft";
    if (params.ccAddress) body.ccAddress = params.ccAddress;
    if (params.inReplyTo) {
      body.inReplyTo = params.inReplyTo;
      body.action = "reply";
    }
    if (params.refHeader) {
      body.refHeader = params.refHeader;
      body.action = "reply";
    }

    return this.mailPost(`/accounts/${id}/messages`, body);
  }

  public static saveDraft(params: {
    toAddress: string;
    subject: string;
    content: string;
    fromAddress?: string;
    ccAddress?: string;
    inReplyTo?: string;
    refHeader?: string;
    accountId?: string;
  }): Promise<unknown> {
    return this.postMessage(params, "draft");
  }

  public static sendEmail(params: {
    toAddress: string;
    subject: string;
    content: string;
    fromAddress?: string;
    ccAddress?: string;
    inReplyTo?: string;
    refHeader?: string;
    accountId?: string;
  }): Promise<unknown> {
    return this.postMessage(params, "send");
  }

  public static async replyToMessage(params: {
    originalMessageId: string;
    toAddress: string;
    subject: string;
    content: string; // HTML body
    fromAddress?: string;
    ccAddress?: string;
    accountId?: string;
    action?: "reply" | "replyall";
    mode?: "draft" | "send";
  }): Promise<unknown> {
    const id = params.accountId ?? (await this.getAccountId());
    const from = params.fromAddress ?? (await this.getPrimaryEmailAddress());

    const body: Record<string, string> = {
      fromAddress: from,
      toAddress: params.toAddress,
      subject: params.subject,
      content: params.content,
      mailFormat: "html",
      action: params.action ?? "reply",
    };
    if (params.mode === "draft") body.mode = "draft";
    if (params.ccAddress) body.ccAddress = params.ccAddress;

    return this.mailPost(
      `/accounts/${id}/messages/${params.originalMessageId}`,
      body
    );
  }

  // --- Group-member cache for task assignee resolution -----------------------
  private static groupMembersCache: {
    at: number;
    members: { displayName: string; email: string; zuid: string }[];
  } | null = null;
  private static readonly GROUP_MEMBERS_TTL_MS = 30 * 60 * 1000; // 30 min

  /**
   * Fetches group members (displayName + email + zuid) from Zoho Mail Tasks.
   * Requires scope: ZohoMail.tasks.ALL or ZohoMail.tasks.READ.
   */
  public static async getGroupMembers(): Promise<
    { displayName: string; email: string; zuid: string }[]
  > {
    const now = Date.now();
    if (
      this.groupMembersCache &&
      now - this.groupMembersCache.at < this.GROUP_MEMBERS_TTL_MS
    ) {
      return this.groupMembersCache.members;
    }

    const groupId = process.env.ZOHO_TASK_GROUP_ID?.trim();
    if (!groupId) {
      console.warn("[ZohoService] ZOHO_TASK_GROUP_ID not set — cannot fetch group members");
      return [];
    }

    try {
      const json = (await this.mailGet(
        `/tasks/groups/${groupId}/members`
      )) as { data?: unknown };

      const rows = Array.isArray((json as any)?.data?.members)
        ? (json as any).data.members
        : [];

      const members = rows.map((raw: any) => ({
        displayName: raw.name,
        email: "",            // API doesn't return email
        zuid: String(raw.id), // use id as the assignee id
      }));

      this.groupMembersCache = { at: now, members };
      console.log(
        `[ZohoService] cached ${members.length} group member(s) for task assignment`
      );
      return members;
    } catch (err) {
      console.warn("[ZohoService] failed to fetch group members:", err);
      return this.groupMembersCache?.members ?? [];
    }
  }

  /**
   * Resolves a team member name (e.g. "Sarah") or email to their Zoho `zuid`.
   * Falls back to null if the member can't be matched.
   */
  public static async resolveAssigneeZuid(
    nameOrEmail: string | null | undefined
  ): Promise<string | null> {
    if (!nameOrEmail) return null;
    const q = nameOrEmail.trim().toLowerCase();
    if (!q) return null;

    const members = await this.getGroupMembers();
    const byName = members.find((m) => {
      const full = m.displayName.trim().toLowerCase();
      const first = full.split(/\s+/)[0];
  
      return (
        full === q ||              // "dave white"
        first === q ||             // "dave"
        full.includes(q)           // optional: "dave" matches "dave white"
      );
    });
    return byName?.zuid ?? null;
  }

  /** Env: ZOHO_TASK_GROUP_ID, optional ZOHO_TASK_PROJECT_ID. */
  public static async createTask(params: {
    title: string;
    description?: string | null;
    priority?: "high" | "medium" | "low";
    dueDate?: Date | null;
    /** Team member name (e.g. "Sarah") — resolved to a Zoho zuid for assignment. */
    assignee?: string | null;
  }): Promise<string | null> {

    console.log("assignee", params.assignee, "\n\n\n\n\n");
    
    const body: Record<string, unknown> = { title: params.title };
    if (params.description) body.description = params.description;
    if (params.priority) body.priority = params.priority;
    if (params.dueDate) body.dueDate = this.formatTaskDueDate(params.dueDate);

    // Resolve assignee name → Zoho zuid
    if (params.assignee) {
      const zuid = await this.resolveAssigneeZuid(params.assignee);
      if (zuid) {
        body.assignee = zuid;
        console.log(
          `[ZohoService] task assignee resolved: "${params.assignee}" → zuid ${zuid}`
        );
      } else {
        console.warn(
          `[ZohoService] could not resolve assignee "${params.assignee}" to a Zoho zuid`
        );
      }
    }

    const groupId = process.env.ZOHO_TASK_GROUP_ID?.trim();
    const projectId = process.env.ZOHO_TASK_PROJECT_ID?.trim();
    let path = "/tasks/me";
    if (groupId) {
      path = `/tasks/groups/${groupId}`;
      if (projectId) body.projectId = projectId;
    }

    const res = (await this.mailPost(path, body)) as {
      data?: { id?: string | number };
    };
    const id = res?.data?.id;
    return id != null ? String(id) : null;
  }

  public static async updateTask(
    taskId: string,
    params: {
      title?: string;
      description?: string | null;
      priority?: "high" | "medium" | "low";
      dueDate?: Date | null;
      /** Team member name — resolved to a Zoho zuid for reassignment. */
      assignee?: string | null;
      status?: string;
      completed?: boolean;
    }
  ): Promise<void> {
    const body: Record<string, unknown> = {};
    if (params.title) body.title = params.title;
    if (params.description != null) body.description = params.description;
    if (params.priority) body.priority = params.priority;
    if (params.dueDate) body.dueDate = this.formatTaskDueDate(params.dueDate);
    if (params.status) {
      const isCompleted =
        params.status === "completed" ||
        params.status === "closed" ||
        params.status === "close" ||
        params.status === "DONE";
      body.status = isCompleted ? "completed" : "open";
    } else if (params.completed !== undefined) {
      body.status = params.completed ? "completed" : "open";
    }
    if (params.assignee) {
      const zuid = await this.resolveAssigneeZuid(params.assignee);
      if (zuid) body.assignee = zuid;
    }
    if (Object.keys(body).length === 0) return;

    const groupId = process.env.ZOHO_TASK_GROUP_ID?.trim();
    const path = groupId
      ? `/tasks/groups/${groupId}/${taskId}`
      : `/tasks/me/${taskId}`;
    await this.mailPut(path, body);
  }

  private static formatTaskDueDate(date: Date): string {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${date.getFullYear()}`;
  }

  public static async deleteMessage(
    messageId: string,
    folderId: string,
    accountId?: string,
    expunge = false
  ): Promise<void> {
    const id = accountId ?? (await this.getAccountId());
    const query = expunge ? "?expunge=true" : "";
    await this.mailDelete(
      `/accounts/${id}/folders/${folderId}/messages/${messageId}${query}`
    );
  }

  /** Zoho emptyFolder API fails on Trash; delete messages individually instead. */
  public static async emptyFolder(
    folderId: string,
    accountId?: string
  ): Promise<void> {
    const id = accountId ?? (await this.getAccountId());
    for (let batch = 0; batch < 50; batch++) {
      const emails = await this.getEmails({
        accountId: id,
        folderId,
        limit: 200,
      });
      if (emails.length === 0) break;
      for (const email of emails) {
        try {
          await this.deleteMessage(email.messageId, folderId, id, true);
        } catch (err) {
          console.warn(
            `[ZohoService] emptyFolder: could not delete ${email.messageId}:`,
            err
          );
        }
      }
    }
  }

  public static async moveMessage(
    messageId: string,
    destFolderId: string,
    accountId?: string
  ): Promise<void> {
    const id = accountId ?? (await this.getAccountId());
    await this.mailPut(`/accounts/${id}/updatemessage`, {
      mode: "moveMessage",
      messageId: [messageId],
      destfolderId: destFolderId,
    });
  }

  public static async restoreMessage(
    messageId: string,
    accountId?: string
  ): Promise<void> {
    const id = accountId ?? (await this.getAccountId());
    const inboxId = await this.getFolderIdByName("Inbox", id);
    if (!inboxId) {
      throw new Error("Inbox folder not found for restore.");
    }
    await this.moveMessage(messageId, inboxId, id);
  }

  public static async getFolders(accountId?: string): Promise<ZohoFolder[]> {
    const id = accountId ?? (await this.getAccountId());
    const parsed = zohoFoldersResponseSchema.parse(
      await this.mailGet(`/accounts/${id}/folders`)
    );
    return parsed.data;
  }

  public static async getFolderIdByName(
    name: string,
    accountId?: string
  ): Promise<string | null> {
    const folders = await this.getFolders(accountId);
    const match = folders.find(
      (f) => f.folderName?.toLowerCase() === name.toLowerCase()
    );
    return match?.folderId ?? null;
  }

  public static async getFolderById(
    folderId: string,
    accountId?: string
  ): Promise<ZohoFolder | null> {
    const folders = await this.getFolders(accountId);
    return folders.find((f) => f.folderId === folderId) ?? null;
  }

  public static async createFolder(
    folderName: string,
    accountId?: string
  ): Promise<string> {
    const id = accountId ?? (await this.getAccountId());
    const res = (await this.mailPost(`/accounts/${id}/folders`, {
      folderName,
    })) as { data?: { folderId?: string | number } };
    const folderId = res?.data?.folderId;
    if (folderId == null) {
      throw new Error(
        `Zoho createFolder returned no folderId for "${folderName}"`
      );
    }
    return String(folderId);
  }

  public static async getOrCreateFolderIdByName(
    name: string,
    accountId?: string
  ): Promise<string> {
    const id = accountId ?? (await this.getAccountId());
    const existing = await this.getFolderIdByName(name, id);
    if (existing) return existing;
    return this.createFolder(name, id);
  }

  public static async getEmails(options?: {
    accountId?: string;
    folderId?: string;
    folderName?: string;
    limit?: number;
    start?: number;
    threadedMails?: boolean;
    includeTo?: boolean;
    includeBody?: boolean;
  }): Promise<ZohoEmail[]> {
    const limit = options?.limit ?? 10;
    const start = options?.start ?? 1;
    const accountId = options?.accountId ?? (await this.getAccountId());

    let folderId = options?.folderId;
    if (!folderId && options?.folderName) {
      folderId =
        (await this.getFolderIdByName(options.folderName, accountId)) ??
        undefined;
    }

    const query = new URLSearchParams({
      limit: String(limit),
      start: String(start),
      threadedMails: String(options?.threadedMails ?? false),
      includeto: String(options?.includeTo ?? true),
    });
    if (folderId) {
      query.set("folderId", folderId);
    }
    const parsed = zohoMessagesResponseSchema.parse(
      await this.mailGet(`/accounts/${accountId}/messages/view?${query}`)
    );

    const emails: ZohoEmail[] = parsed.data.map((m) => this.toZohoEmail(m));

    if (!options?.includeBody) {
      return emails;
    }

    for (const email of emails) {
      try {
        email.content = await this.getEmailContent(
          email.messageId,
          email.folderId
        );
      } catch (error) {
        console.warn(
          `[ZohoService] Could not fetch content for message ${email.messageId}:`,
          error
        );
      }
    }
    return emails;
  }


  public static async getAllEmails(options?: {
    accountId?: string;
    folderId?: string;
    folderName?: string;
    threadedMails?: boolean;
    includeTo?: boolean;
    includeBody?: boolean;
    perPage?: number;
  }): Promise<ZohoEmail[]> {
    const perPage = Math.min(options?.perPage ?? 200, 200); // Zoho max limit per_page is 200
    let allEmails: ZohoEmail[] = [];
    let start = 1;
    let hasMoreRecords = true;
    let pageCount = 0;
    const maxPages = 50; // Safety cap to avoid infinite loops

    const accountId = options?.accountId ?? (await this.getAccountId());
    let folderId = options?.folderId;
    if (!folderId && options?.folderName) {
      folderId =
        (await this.getFolderIdByName(options.folderName, accountId)) ??
        undefined;
    }

    while (hasMoreRecords && pageCount < maxPages) {
      pageCount++;
      const query = new URLSearchParams({
        limit: String(perPage),
        start: String(start),
        threadedMails: String(options?.threadedMails ?? false),
        includeto: String(options?.includeTo ?? true),
      });
      if (folderId) {
        query.set("folderId", folderId);
      }

      const res = await this.mailGet(`/accounts/${accountId}/messages/view?${query}`);
      const parsed = zohoMessagesResponseSchema.parse(res);
      const emailsBatch: ZohoEmail[] = parsed.data.map((m) => this.toZohoEmail(m));

      if (emailsBatch.length > 0) {
        allEmails.push(...emailsBatch);
      }

      if (parsed.info?.more_records !== undefined) {
        hasMoreRecords = parsed.info.more_records === true;
      } else {
        hasMoreRecords = emailsBatch.length === perPage;
      }

      start += perPage;
    }

    if (options?.includeBody) {
      for (const email of allEmails) {
        try {
          email.content = await this.getEmailContent(
            email.messageId,
            email.folderId
          );
        } catch (error) {
          console.warn(
            `[ZohoService] Could not fetch content for message ${email.messageId}:`,
            error
          );
        }
      }
    }

    return allEmails;
  }

  private static toZohoEmail(m: ZohoMessageSummary): ZohoEmail {
    return {
      messageId: m.messageId,
      folderId: m.folderId,
      senderName: this.decodeEntities(m.sender ?? m.fromAddress ?? ""),
      from: this.decodeEntities(m.fromAddress ?? ""),
      to: this.decodeEntities(m.toAddress ?? ""),
      subject: this.decodeEntities(m.subject ?? "(no subject)"),
      summary: this.decodeEntities(m.summary ?? ""),
      receivedAt: this.parseZohoDate(m.receivedTime ?? m.sentDateInGMT),
    };
  }

  /** Zoho search requires operator syntax, e.g. `entire:invoice` or `subject:foo`. */
  public static async searchMessages(options: {
    searchKey: string;
    accountId?: string;
    limit?: number;
    start?: number;
  }): Promise<ZohoEmail[]> {
    const accountId = options.accountId ?? (await this.getAccountId());
    const query = new URLSearchParams({
      searchKey: options.searchKey,
      limit: String(options.limit ?? 30),
      start: String(options.start ?? 1),
      includeto: "true",
    });
    const parsed = zohoMessagesResponseSchema.parse(
      await this.mailGet(`/accounts/${accountId}/messages/search?${query}`)
    );
    return parsed.data.map((m) => this.toZohoEmail(m));
  }

  private static async resolveFolderIdForMessage(
    messageId: string,
    folderId: string
  ): Promise<string> {
    try {
      const stored = await prisma.storedEmail.findFirst({
        where: { OR: [{ id: messageId }, { messageId }] },
        select: { folderId: true },
      });
      if (stored?.folderId) return stored.folderId;
    } catch {
      // fallback
    }
    return folderId;
  }

  public static async getEmailContent(
    messageId: string,
    folderId: string,
    accountId?: string
  ): Promise<string> {
    const id = accountId ?? (await this.getAccountId());
    try {
      const parsed = zohoMessageContentResponseSchema.parse(
        await this.mailGet(
          `/accounts/${id}/folders/${folderId}/messages/${messageId}/content`
        )
      );
      return parsed.data.content ?? "";
    } catch (err) {
      const resolvedFolder = await this.resolveFolderIdForMessage(messageId, folderId);
      if (resolvedFolder && resolvedFolder !== folderId) {
        try {
          const parsed = zohoMessageContentResponseSchema.parse(
            await this.mailGet(
              `/accounts/${id}/folders/${resolvedFolder}/messages/${messageId}/content`
            )
          );
          return parsed.data.content ?? "";
        } catch {
          // ignore fallback
        }
      }
      try {
        const stored = await prisma.storedEmail.findFirst({
          where: { OR: [{ id: messageId }, { messageId }] },
          select: { bodyHtml: true, bodyText: true },
        });
        if (stored?.bodyHtml) return stored.bodyHtml;
        if (stored?.bodyText) return `<p>${stored.bodyText.replace(/\n/g, "<br>")}</p>`;
      } catch {
        // ignore
      }
      console.warn(`[ZohoService] getEmailContent failed for ${messageId}:`, err);
      return "";
    }
  }

  public static async getEmailMeta(
    messageId: string,
    folderId: string,
    accountId?: string
  ): Promise<{
    messageId: string;
    folderId: string;
    threadId?: string;
  } | null> {
    const id = accountId ?? (await this.getAccountId());
    try {
      const json = (await this.mailGet(
        `/accounts/${id}/folders/${folderId}/messages/${messageId}/details`
      )) as { data?: Record<string, unknown> };
      const data = json?.data;
      if (!data) return null;
      return {
        messageId: String(data.messageId ?? messageId),
        folderId: String(data.folderId ?? folderId),
        threadId:
          data.threadId != null && String(data.threadId) !== "0"
            ? String(data.threadId)
            : undefined,
      };
    } catch {
      return null;
    }
  }

  public static async getEmailHeader(
    messageId: string,
    folderId: string,
    accountId?: string
  ): Promise<string> {
    const id = accountId ?? (await this.getAccountId());
    try {
      const parsed = zohoMessageHeaderResponseSchema.parse(
        await this.mailGet(
          `/accounts/${id}/folders/${folderId}/messages/${messageId}/header`
        )
      );
      return parsed.data.headerContent ?? "";
    } catch (err) {
      const resolvedFolder = await this.resolveFolderIdForMessage(messageId, folderId);
      if (resolvedFolder && resolvedFolder !== folderId) {
        try {
          const parsed = zohoMessageHeaderResponseSchema.parse(
            await this.mailGet(
              `/accounts/${id}/folders/${resolvedFolder}/messages/${messageId}/header`
            )
          );
          return parsed.data.headerContent ?? "";
        } catch {
          // ignore
        }
      }
      console.warn(`[ZohoService] getEmailHeader failed for ${messageId}:`, err);
      return "";
    }
  }

  public static async getEmailAttachments(
    messageId: string,
    folderId: string,
    accountId?: string
  ): Promise<ZohoAttachmentItem[]> {
    const id = accountId ?? (await this.getAccountId());
    try {
      const parsed = zohoAttachmentInfoResponseSchema.parse(
        await this.mailGet(
          `/accounts/${id}/folders/${folderId}/messages/${messageId}/attachmentinfo?includeInline=true`
        )
      );
      return [
        ...parsed.data.attachments.map((a) => ({ ...a, isInline: false })),
        ...parsed.data.inline.map((a) => ({ ...a, isInline: true })),
      ];
    } catch (err) {
      const resolvedFolder = await this.resolveFolderIdForMessage(messageId, folderId);
      if (resolvedFolder && resolvedFolder !== folderId) {
        try {
          const parsed = zohoAttachmentInfoResponseSchema.parse(
            await this.mailGet(
              `/accounts/${id}/folders/${resolvedFolder}/messages/${messageId}/attachmentinfo?includeInline=true`
            )
          );
          return [
            ...parsed.data.attachments.map((a) => ({ ...a, isInline: false })),
            ...parsed.data.inline.map((a) => ({ ...a, isInline: true })),
          ];
        } catch {
          // ignore
        }
      }
      console.warn(`[ZohoService] getEmailAttachments failed for ${messageId}:`, err);
      return [];
    }
  }

  public static async getAttachmentResponse(
    messageId: string,
    folderId: string,
    attachmentId: string,
    accountId?: string
  ): Promise<Response> {
    const id = accountId ?? (await this.getAccountId());
    return this.mailFetch(
      `/accounts/${id}/folders/${folderId}/messages/${messageId}/attachments/${attachmentId}`,
      "application/octet-stream"
    );
  }
 
  public static async getEmailDetail(
    messageId: string,
    folderId: string,
    accountId?: string
  ): Promise<ZohoEmailDetail> {
    const id = accountId ?? (await this.getAccountId());
    const [header, content] = await Promise.all([
      this.getEmailHeader(messageId, folderId, id),
      this.getEmailContent(messageId, folderId, id),
    ]);
    return { messageId, header, content };
  }

  private static decodeEntities(text: string): string {
    return text
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/&amp;/g, "&");
  }

  private static parseZohoDate(raw: string | undefined): Date {
    if (raw) {
      const ms = Number(raw);
      if (Number.isFinite(ms) && ms > 0) {
        return new Date(ms);
      }
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return new Date();
  }
}

/* ── Zoho contact field extractors ── */

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickContactEmail(c: Record<string, unknown>): string | null {
  const direct = firstString(c.email, c.emailId, c.contactEmail, c.primaryEmail);
  if (direct) return direct.toLowerCase();

  const list = c.emailList ?? c.emailIds ?? c.emails;
  if (Array.isArray(list)) {
    for (const item of list) {
      if (typeof item === "string" && item.includes("@")) return item.toLowerCase();
      if (item && typeof item === "object") {
        const e = firstString(
          (item as Record<string, unknown>).mailId,
          (item as Record<string, unknown>).email,
          (item as Record<string, unknown>).value,
          (item as Record<string, unknown>).address
        );
        if (e) return e.toLowerCase();
      }
    }
  }
  return null;
}

function pickContactName(c: Record<string, unknown>): string {
  const full = firstString(c.contactName, c.displayName, c.name);
  if (full) return full;
  const fn = firstString(c.firstName, c.fname) ?? "";
  const ln = firstString(c.lastName, c.lname) ?? "";
  return `${fn} ${ln}`.trim();
}
