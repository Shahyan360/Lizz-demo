import { z } from "zod";

/**
 * Zod schemas for data coming back from the Zoho APIs.
 *
 * Like the Gmail schemas, these are the single validation boundary for Zoho
 * payloads: parse once, fail loudly if the shape drifts, and hand typed data to
 * the rest of the system.
 */

/**
 * The OAuth token-refresh response from `accounts.zoho.*`. Zoho returns
 * `expires_in` in SECONDS. An `error` field appears instead on failure (e.g.
 * `invalid_client`), so it is captured to surface a clear message.
 */
export const zohoTokenResponseSchema = z.object({
  access_token: z.string().min(1).optional(),
  expires_in: z.number().optional(),
  api_domain: z.string().optional(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  error: z.string().optional(),
});

export type ZohoTokenResponse = z.infer<typeof zohoTokenResponseSchema>;

/** A single mailbox entry from `GET /api/accounts`. */
export const zohoAccountSchema = z.object({
  accountId: z.union([z.string(), z.number()]).transform(String),
  primaryEmailAddress: z.string().optional(),
  displayName: z.string().optional(),
});

export type ZohoAccount = z.infer<typeof zohoAccountSchema>;

/** The envelope wrapping `GET /api/accounts`. */
export const zohoAccountsResponseSchema = z.object({
  status: z.object({ code: z.number() }).passthrough().optional(),
  data: z.array(zohoAccountSchema),
});

/** A single folder from `GET /api/accounts/{id}/folders`. */
export const zohoFolderSchema = z.object({
  folderId: z.union([z.string(), z.number()]).transform(String),
  folderName: z.string().optional(),
  folderType: z.string().optional(),
  path: z.string().optional(),
  // Zoho returns these as strings; kept raw for the caller to interpret.
  unreadCount: z.union([z.string(), z.number()]).optional(),
  messageCount: z.union([z.string(), z.number()]).optional(),
});

export type ZohoFolder = z.infer<typeof zohoFolderSchema>;

/** The envelope wrapping `GET /api/accounts/{id}/folders`. */
export const zohoFoldersResponseSchema = z.object({
  status: z.object({ code: z.number() }).passthrough().optional(),
  data: z.array(zohoFolderSchema),
});

/** A single message summary from `GET /api/accounts/{id}/messages/view`. */
export const zohoMessageSummarySchema = z.object({
  messageId: z.union([z.string(), z.number()]).transform(String),
  folderId: z.union([z.string(), z.number()]).transform(String),
  // Friendly display name of the sender (e.g. "David White").
  sender: z.string().optional(),
  fromAddress: z.string().optional(),
  toAddress: z.string().optional(),
  subject: z.string().optional(),
  summary: z.string().optional(),
  // Epoch-millis-as-string in Zoho payloads; kept raw and parsed by the caller.
  receivedTime: z.string().optional(),
  sentDateInGMT: z.string().optional(),
});

export type ZohoMessageSummary = z.infer<typeof zohoMessageSummarySchema>;

/** The envelope wrapping a message-list view. */
export const zohoMessagesResponseSchema = z.object({
  status: z.object({ code: z.number() }).passthrough().optional(),
  info: z
    .object({
      more_records: z.boolean().optional(),
      page: z.number().optional(),
      per_page: z.number().optional(),
      count: z.number().optional(),
    })
    .passthrough()
    .optional(),
  data: z.array(zohoMessageSummarySchema),
});

/** The envelope wrapping a single message's content fetch. */
export const zohoMessageContentResponseSchema = z.object({
  status: z.object({ code: z.number() }).passthrough().optional(),
  data: z
    .object({
      subject: z.string().optional(),
      content: z.string().optional(),
      fromAddress: z.string().optional(),
      toAddress: z.string().optional(),
    })
    .passthrough(),
});

/**
 * The payload Zoho posts to an OUTGOING mail webhook on each new email.
 *
 * NOTE: `messageId`/`folderId` arrive as huge integers that lose precision once
 * parsed as JS numbers — always prefer `messageIdString`. Content fields
 * (subject/sender/html/…) are strings and safe.
 */
export const zohoWebhookPayloadSchema = z.object({
  subject: z.string().optional().default(""),
  summary: z.string().optional().default(""),
  sender: z.string().optional().default(""),
  fromAddress: z.string().optional().default(""),
  toAddress: z.string().optional().default(""),
  html: z.string().optional().default(""),
  // The precision-safe message id (string). Falls back to the numeric one.
  messageIdString: z.string().optional(),
  messageId: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v == null ? undefined : String(v))),
  folderId: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v == null ? undefined : String(v))),
  threadId: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v == null ? undefined : String(v))),
  receivedTime: z.union([z.string(), z.number()]).optional(),
  hasAttachment: z.string().optional(),
});

export type ZohoWebhookPayload = z.infer<typeof zohoWebhookPayloadSchema>;

/** A single attachment (regular or inline) on a message. */
export const zohoAttachmentSchema = z.object({
  attachmentId: z.union([z.string(), z.number()]).transform(String),
  attachmentName: z.string().optional().default(""),
  attachmentSize: z.number().optional().default(0),
  // Present only on inline attachments (the Content-ID referenced by the body).
  cid: z.string().optional(),
});

export type ZohoAttachment = z.infer<typeof zohoAttachmentSchema>;

/** The envelope wrapping `.../attachmentinfo`. */
export const zohoAttachmentInfoResponseSchema = z.object({
  status: z.object({ code: z.number() }).passthrough().optional(),
  data: z
    .object({
      attachments: z.array(zohoAttachmentSchema).optional().default([]),
      inline: z.array(zohoAttachmentSchema).optional().default([]),
    })
    .passthrough(),
});

/** An attachment enriched for the UI with an `isInline` flag. */
export interface ZohoAttachmentItem extends ZohoAttachment {
  isInline: boolean;
}

/** The envelope wrapping a single message's raw header fetch. */
export const zohoMessageHeaderResponseSchema = z.object({
  status: z.object({ code: z.number() }).passthrough().optional(),
  data: z
    .object({
      headerContent: z.string().optional(),
    })
    .passthrough(),
});

/** Full detail of one message: raw headers plus the HTML/plain body. */
export interface ZohoEmailDetail {
  messageId: string;
  header: string;
  content: string;
}

/** A fully assembled Zoho email returned by `ZohoService.getEmails`. */
export interface ZohoEmail {
  messageId: string;
  folderId: string;
  /** Friendly sender name (e.g. "David White"); falls back to the address. */
  senderName: string;
  from: string;
  to: string;
  subject: string;
  /** Short preview text from the list view. */
  summary: string;
  /** Full body (HTML/plain as Zoho returns it); only set when fetched. */
  content?: string;
  receivedAt: Date;
}
