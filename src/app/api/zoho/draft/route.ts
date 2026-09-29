import { NextRequest, NextResponse } from "next/server";
import { ZohoService } from "../../../../services/zoho.service";
import { getOrCreateTenant } from "../../../../lib/tenant";
import {
  processEmailWithLLM,
  replyTextToHtml,
} from "../../../../lib/reply/llm-orchestrator";
import {
  draftReferenceBlockHtml,
  hasDraftReferenceBlock,
} from "../../../../lib/zoho/email-link";
import { extractEmailAddress } from "../../../../lib/gmail-helpers";

// Always run live.
export const dynamic = "force-dynamic";

/** Strips HTML tags/entities to plain text for the reply generator. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Pulls a single header value (e.g. "Subject") from raw RFC header text. */
function headerValue(header: string, name: string): string {
  const match = header.match(new RegExp(`^${name}:\\s*(.*)$`, "im"));
  return match?.[1]?.trim() ?? "";
}

/** Derives reply metadata (recipient, subject, threading) from raw headers. */
function deriveReplyMeta(header: string) {
  const fromHeader = headerValue(header, "From");
  const senderEmail = extractEmailAddress(fromHeader);
  const senderName = fromHeader.split("<")[0].trim() || senderEmail;
  const subject = headerValue(header, "Subject");
  const replySubject = subject.trim().toLowerCase().startsWith("re:")
    ? subject
    : `Re: ${subject}`;
  const originalMessageId = headerValue(header, "Message-ID");
  const references = headerValue(header, "References");
  const refHeader = [references, originalMessageId].filter(Boolean).join(" ");
  return {
    senderEmail,
    senderName,
    subject,
    replySubject,
    inReplyTo: originalMessageId || undefined,
    refHeader: refHeader || undefined,
  };
}

/** For a draft, the recipient/subject come from the draft's OWN To/Subject. */
function deriveDraftMeta(header: string) {
  const toHeader = headerValue(header, "To");
  return {
    senderEmail: extractEmailAddress(toHeader),
    replySubject: headerValue(header, "Subject"),
    inReplyTo: undefined as string | undefined,
    refHeader: undefined as string | undefined,
  };
}

type Body = {
  accountId?: string;
  folderId?: string;
  messageId?: string;
  action?: "generate" | "save" | "send" | "delete" | "restore" | "meta";
  text?: string;
  /** "reply" (default) or "draft" (edit/send an existing draft as-is). */
  context?: "reply" | "draft";
  /** For delete: permanently remove instead of moving to Trash. */
  expunge?: boolean;
};

/**
 * POST /api/zoho/draft — reply actions for one message:
 *   action "generate" → AI writes a reply, returns { replyText } (no Zoho write)
 *   action "save"     → saves the given `text` to Zoho Drafts
 *   action "send"     → sends the given `text` as a threaded reply
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    accountId,
    folderId,
    messageId,
    action = "generate",
    text,
    context = "reply",
    expunge = false,
  } = body;
  if (!folderId || !messageId) {
    return NextResponse.json(
      { error: "folderId and messageId are required" },
      { status: 400 }
    );
  }

  try {
    // Who the outgoing email will be sent FROM (this mailbox). Cached, so cheap.
    const fromAddress = await ZohoService.getPrimaryEmailAddress().catch(() => "");

    if (action === "meta") {
      // Recipient/subject preview only — no AI, no Zoho write. Lets the UI show
      // From/To before the user hits Send (esp. when editing an existing draft).
      const header = await ZohoService.getEmailHeader(
        messageId,
        folderId,
        accountId
      );
      const meta =
        context === "draft" ? deriveDraftMeta(header) : deriveReplyMeta(header);
      return NextResponse.json({
        ok: true,
        to: meta.senderEmail,
        from: fromAddress,
        subject: meta.replySubject,
      });
    }

    if (action === "generate") {
      const detail = await ZohoService.getEmailDetail(
        messageId,
        folderId,
        accountId
      );
      const meta = deriveReplyMeta(detail.header);
      const reply = await processEmailWithLLM({
        senderName: meta.senderName,
        fromAddress: meta.senderEmail,
        subject: meta.subject,
        bodyText: htmlToText(detail.content),
        messageId,
        folderId,
        accountId,
      });
      return NextResponse.json({
        ok: true,
        replyText: reply.replyText,
        to: meta.senderEmail,
        from: fromAddress,
      });
    }

    if (action === "delete") {
      // Move to Trash by default; `expunge` permanently removes (e.g. in Trash).
      await ZohoService.deleteMessage(messageId, folderId, accountId, expunge);
      return NextResponse.json({ ok: true });
    }

    if (action === "restore") {
      // Move the message back to the Inbox (e.g. out of Trash).
      await ZohoService.restoreMessage(messageId, accountId);
      return NextResponse.json({ ok: true });
    }

    // save / send both need the edited text and the original headers.
    if (!text || !text.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    const header = await ZohoService.getEmailHeader(
      messageId,
      folderId,
      accountId
    );
    // Drafts send to their own recipient/subject; replies derive from the sender.
    const meta =
      context === "draft" ? deriveDraftMeta(header) : deriveReplyMeta(header);

    // Append the Zoho signature to a FRESH reply (Zoho's API doesn't add it).
    // For context "draft" we skip it — an existing draft already carries its
    // signature (from the webhook auto-draft or a prior save), so re-appending
    // here would duplicate it.
    const signatureHtml =
      context === "reply" ? await ZohoService.getSignatureHtml() : "";
    let referenceHtml = "";
    if (
      action === "save" &&
      context === "reply" &&
      !hasDraftReferenceBlock(text) &&
      messageId
    ) {
      const detail = await ZohoService.getEmailDetail(
        messageId,
        folderId,
        accountId
      );
      const replyMeta = deriveReplyMeta(detail.header);
      referenceHtml = draftReferenceBlockHtml({
        fromAddress: replyMeta.senderEmail,
        fromName: replyMeta.senderName,
        subject: replyMeta.subject,
        bodyText: htmlToText(detail.content),
      });
    }
    const contentHtml =
      replyTextToHtml(text) +
      referenceHtml +
      (signatureHtml ? `<br><br>${signatureHtml}` : "");

    const common = {
      toAddress: meta.senderEmail,
      subject: meta.replySubject,
      content: contentHtml,
      inReplyTo: meta.inReplyTo,
      refHeader: meta.refHeader,
      accountId,
    };

    if (action === "save") {
      await ZohoService.saveDraft(common);
      return NextResponse.json({ ok: true, to: meta.senderEmail, from: fromAddress });
    }
    if (action === "send") {
      if (context === "draft") {
        // A standalone draft: send it, then remove the draft (Zoho-style).
        await ZohoService.sendEmail(common);
        try {
          await ZohoService.deleteMessage(messageId, folderId, accountId, true);
        } catch (e) {
          console.warn("[api/zoho/draft] could not remove sent draft:", e);
        }
      } else {
        // Reply: use Zoho's reply endpoint against the ORIGINAL message so it
        // threads into the same conversation.
        await ZohoService.replyToMessage({
          originalMessageId: messageId,
          toAddress: meta.senderEmail,
          subject: meta.replySubject,
          content: contentHtml,
          accountId,
        });
      }
      return NextResponse.json({ ok: true, to: meta.senderEmail, from: fromAddress });
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[api/zoho/draft] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
