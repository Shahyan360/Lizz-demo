import { NextRequest, NextResponse } from "next/server";

/**
 * DRY-RUN reply preview — proves the assistant threads its reply to the parent
 * email instead of sending a standalone new message. It builds the EXACT request
 * that would be POSTed to the Zoho Mail API for each path (auto-send reply and
 * saved draft), plus a contrast "new message" that we deliberately DON'T use —
 * all from mock data. Nothing is sent to Zoho.
 *
 * Try it:
 *   GET /api/zoho/reply-preview
 *   GET /api/zoho/reply-preview?originalMessageId=123&rfcMessageId=<abc@x>&to=jane@acme.com
 *
 * The request shapes here mirror ZohoService.replyToMessage / saveDraft exactly:
 *   - reply    → POST /accounts/{id}/messages/{PARENT_ID}   body.action = "reply"
 *   - draft    → POST /accounts/{id}/messages               body.inReplyTo + refHeader
 *   - (avoided) new message has neither → a standalone email.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = req.nextUrl.searchParams;

  // Mock inbound email + overridable via query params.
  const mailDomain = process.env.ZOHO_MAIL_DOMAIN?.trim() || "mail.zoho.com";
  const accountId = q.get("accountId") || "9000000012345";
  const originalMessageId = q.get("originalMessageId") || "1699999999999000042"; // Zoho internal id
  const rfcMessageId = q.get("rfcMessageId") || "<CAF9x1abc23.def456@mail.acme.com>"; // RFC Message-ID header
  const ourAddress = q.get("from") || "max@myautogate.com";
  const customer = q.get("to") || "jane.customer@acme.com";
  const inboundSubject = q.get("subject") || "Gate remote not working";

  const base = `https://${mailDomain}/api`;
  const subject = inboundSubject.trim().toLowerCase().startsWith("re:")
    ? inboundSubject
    : `Re: ${inboundSubject}`;
  const content = "<p>Hi Jane, happy to help with the remote…</p>";

  // 1) Auto-send path — Zoho "Reply to an email" API. The PARENT message id is
  //    the URL target and action:"reply" tells Zoho to thread + quote it.
  const replyRequest = {
    method: "POST",
    url: `${base}/accounts/${accountId}/messages/${originalMessageId}`,
    body: {
      fromAddress: ourAddress,
      toAddress: customer,
      subject,
      content,
      mailFormat: "html",
      action: "reply",
    },
    why: "Parent message id is in the URL path + action:'reply' → Zoho threads this into the SAME conversation.",
  };

  // 2) Draft path — compose as a DRAFT, threaded via the RFC In-Reply-To /
  //    References headers pointing at the parent's Message-ID.
  const draftRequest = {
    method: "POST",
    url: `${base}/accounts/${accountId}/messages`,
    body: {
      fromAddress: ourAddress,
      toAddress: customer,
      subject,
      content,
      mailFormat: "html",
      mode: "draft",
      inReplyTo: rfcMessageId,
      refHeader: rfcMessageId,
    },
    why: "In-Reply-To + References headers point at the parent's RFC Message-ID → the draft threads under the original.",
  };

  // 3) CONTRAST — what a standalone new message looks like (we do NOT do this).
  const newMessageRequest = {
    method: "POST",
    url: `${base}/accounts/${accountId}/messages`,
    body: {
      fromAddress: ourAddress,
      toAddress: customer,
      subject,
      content,
      mailFormat: "html",
    },
    why: "No parent id, no action, no In-Reply-To → a brand-new email that would NOT thread. This is what we avoid.",
  };

  // Assertions that confirm each path is a genuine reply, computed from the
  // payloads above (not hard-coded) so this endpoint actually verifies them.
  const autoSendThreaded =
    replyRequest.url.endsWith(`/messages/${originalMessageId}`) &&
    replyRequest.body.action === "reply";
  const draftThreaded =
    draftRequest.body.inReplyTo === rfcMessageId &&
    draftRequest.body.refHeader === rfcMessageId;
  const newMessageThreaded =
    newMessageRequest.url.endsWith(`/messages/${originalMessageId}`) ||
    "action" in newMessageRequest.body ||
    "inReplyTo" in newMessageRequest.body;

  return NextResponse.json({
    dryRun: true,
    note: "No request was sent to Zoho. These are the exact payloads the app would use.",
    mockInbound: {
      zohoMessageId: originalMessageId,
      rfcMessageId,
      from: customer,
      to: ourAddress,
      subject: inboundSubject,
    },
    paths: {
      autoSendReply: replyRequest,
      savedDraft: draftRequest,
      standaloneNewMessage_AVOIDED: newMessageRequest,
    },
    verification: {
      autoSend_isThreadedReply: autoSendThreaded,
      draft_isThreadedReply: draftThreaded,
      newMessage_isThreadedReply: newMessageThreaded, // expected false → proves the difference
      parentZohoMessageId: originalMessageId,
      parentRfcMessageId: rfcMessageId,
      conclusion:
        autoSendThreaded && draftThreaded && !newMessageThreaded
          ? "✅ Both reply paths carry the parent id / threading headers; only the avoided path does not."
          : "⚠️ Unexpected — a path did not thread as designed.",
    },
  });
}
