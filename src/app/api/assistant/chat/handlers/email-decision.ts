import { NextResponse } from "next/server";
import { ZohoService } from "../../../../../services/zoho.service";
import { geminiChatWithRetry, getGeminiModel } from "../../../../../config/gemini";
import { buildEmailRewritePrompt } from "../prompts";

export async function handleEmailDecision({
  message,
  history,
}: {
  message: string;
  history: Array<{ role: string; content: string }>;
}): Promise<NextResponse | null> {
  const lastAssistantMsg = history.length > 0 ? history[history.length - 1] : null;
  if (
    !lastAssistantMsg ||
    lastAssistantMsg.role !== "assistant" ||
    !lastAssistantMsg.content.includes("[AWAITING_EMAIL_DECISION]")
  ) {
    return null;
  }

  const normalizedConfirmMsg = message.trim().toLowerCase();

  // Checked BEFORE isSend/isDraft: several send/draft trigger words ("correct",
  // "fine", "ok") also appear naturally inside edit instructions like "please
  // correct the subject" or "that's fine, just make it shorter" — without this
  // priority such messages would misfire a premature send instead of an edit.
  const isImprovementRequest =
    /\b(better|improve|rewrite|formal|shorter|longer|change|professional|polite|rephrase|tweak|fix|correct|modify|different)\b/i.test(
      message.trim()
    );

  const isSend =
    !isImprovementRequest &&
    (/\b(send|yes|yeah|yep|sure|ok|okay|fine|correct|perfect|looks?\s*good|fine\s*to\s*send|its?\s*fine|it's?\s*fine|go\s*ahead|do\s*it|approved?)\b/i.test(
      normalizedConfirmMsg
    ) ||
      normalizedConfirmMsg.includes("fine to send") ||
      normalizedConfirmMsg.includes("looks good") ||
      normalizedConfirmMsg.includes("go ahead") ||
      normalizedConfirmMsg.includes("send it"));

  const isDraft =
    !isImprovementRequest &&
    (/\b(draft|save|store|keep|put\s*in\s*drafts?)\b/i.test(normalizedConfirmMsg) ||
      normalizedConfirmMsg.includes("save as draft") ||
      normalizedConfirmMsg.includes("make a draft") ||
      normalizedConfirmMsg.includes("draft it"));

  const isCancel =
    /^(no|nope|nah|cancel|discard|don'?t\s*(send|draft|save))$/i.test(normalizedConfirmMsg) ||
    normalizedConfirmMsg.includes("don't send") ||
    normalizedConfirmMsg.includes("cancel");

  // 1. Try extracting structured HTML metadata tag first
  let zohoMessageId: string | undefined = undefined;
  let toEmail = "";
  let recipientName = "";
  let subjectStr = "";

  const replyMetaMatch = lastAssistantMsg.content.match(
    /<!-- ZOHO_REPLY_META:\s*messageId="([^"]*)"\s*email="([^"]*)"\s*name="([^"]*)"\s*subject="([^"]*)"\s*-->/i
  );
  const draftMetaMatch = lastAssistantMsg.content.match(
    /<!-- ZOHO_DRAFT_META:\s*email="([^"]*)"\s*name="([^"]*)"\s*subject="([^"]*)"\s*-->/i
  );

  if (replyMetaMatch) {
    zohoMessageId = replyMetaMatch[1].trim() || undefined;
    toEmail = replyMetaMatch[2].trim();
    recipientName = replyMetaMatch[3].trim() || toEmail;
    subjectStr = replyMetaMatch[4].trim();
  } else if (draftMetaMatch) {
    toEmail = draftMetaMatch[1].trim();
    recipientName = draftMetaMatch[2].trim() || toEmail;
    subjectStr = draftMetaMatch[3].trim();
  }

  // 2. Fallback regex extraction if structured metadata tag wasn't present
  if (!toEmail) {
    const emailMatch =
      lastAssistantMsg.content.match(/\*\*([^*]+)\*\*\s*\(([^)]+@[^)]+)\)/) ||
      lastAssistantMsg.content.match(/\(([^)]+@[^)]+)\)/);
    if (emailMatch) {
      toEmail = emailMatch[emailMatch.length - 1].trim();
      recipientName = emailMatch.length > 2 ? emailMatch[1].trim() : toEmail;
    }
  }

  if (!subjectStr) {
    const subjectMatch = lastAssistantMsg.content.match(/\*\*Subject\*\*:\s*([^\n]+)/);
    if (subjectMatch) subjectStr = subjectMatch[1].trim();
  }

  if (!zohoMessageId) {
    const msgIdMatch =
      lastAssistantMsg.content.match(/Message ID:?\s*`([^`]+)`/i) ||
      lastAssistantMsg.content.match(/Thread ID:?\s*`([^`]+)`/i);
    if (msgIdMatch) zohoMessageId = msgIdMatch[1].trim();
  }

  const bodyMatch =
    lastAssistantMsg.content.match(/\*\*(?:Reply\s+)?Body\*\*:\n([\s\S]+?)(?=\n\n<!--|\n\n\[AWAITING_EMAIL_DECISION\]|$)/i) ||
    lastAssistantMsg.content.match(/\*\*(?:Reply\s+)?Body\*\*:\s*([^\n]+[\s\S]+?)(?=\n\n<!--|\n\n\[AWAITING_EMAIL_DECISION\]|$)/i);

  const bodyStr = bodyMatch ? bodyMatch[1].trim() : "";

  if (toEmail && subjectStr && bodyStr) {
    // Helper to format HTML body cleanly and prevent double sign-offs
    const buildHtmlBody = async (text: string) => {
      const signatureHtml = await ZohoService.getSignatureHtml();
      let cleanText = text;
      if (signatureHtml) {
        cleanText = cleanText
          .replace(/best\s*regards,?\s*Lizzz\s*$/gi, "")
          .replace(/sincerely,?\s*Lizzz\s*$/gi, "")
          .replace(/thanks,?\s*Lizzz\s*$/gi, "")
          .trim();
      }
      const formattedBody = cleanText
        .split(/\n\s*\n/)
        .map((p: string) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");
      return signatureHtml ? `${formattedBody}<br><br>${signatureHtml}` : formattedBody;
    };

    // --- CANCEL ---
    if (isCancel) {
      return NextResponse.json({
        reply: "❌ Cancelled. The email has been discarded — nothing was sent or saved.",
        speakReply: "Cancelled. The email has been discarded.",
      });
    }

    // --- SEND ---
    if (isSend) {
      try {
        const contentHtml = await buildHtmlBody(bodyStr);

        await ZohoService.sendEmail({
          toAddress: toEmail,
          subject: subjectStr,
          content: contentHtml,
          inReplyTo: zohoMessageId,
          refHeader: zohoMessageId,
        });

        return NextResponse.json({
          reply: `✅ In-thread reply has been successfully sent via Zoho Mail to **${recipientName}** (${toEmail})!`,
          speakReply: `The email reply has been successfully sent to ${recipientName}.`,
        });
      } catch (err: any) {
        console.error("[email-decision] failed to send Zoho email:", err);
        return NextResponse.json({
          reply: `❌ Failed to send email via Zoho: ${err.message || err}`,
          speakReply: "Failed to send email.",
        });
      }
    }

    // --- SAVE AS DRAFT ---
    if (isDraft) {
      try {
        const contentHtml = await buildHtmlBody(bodyStr);

        await ZohoService.saveDraft({
          toAddress: toEmail,
          subject: subjectStr,
          content: contentHtml,
          inReplyTo: zohoMessageId,
          refHeader: zohoMessageId,
        });
      } catch (err) {
        console.error("[email-decision] failed to save Zoho draft:", err);
      }

      return NextResponse.json({
        reply: `✅ The reply has been saved as a clean draft in your Zoho Mail account for **${recipientName}** (${toEmail}). You can review and send it from Zoho Mail anytime.`,
        speakReply: `The reply has been saved as a draft in your Zoho Mail for ${recipientName}.`,
      });
    }

    // --- REWRITE / IMPROVE ---
    if (isImprovementRequest) {
      const rewritePrompt = buildEmailRewritePrompt(
        recipientName,
        toEmail,
        subjectStr,
        bodyStr,
        message
      );

      const completion = await geminiChatWithRetry({
        model: getGeminiModel(),
        messages: [{ role: "user", content: rewritePrompt }],
        temperature: 0.3,
        max_tokens: 1024,
      });

      const newBody = completion.choices?.[0]?.message?.content?.trim() || bodyStr;

      const metaTag = zohoMessageId
        ? `<!-- ZOHO_REPLY_META: messageId="${zohoMessageId}" email="${toEmail}" name="${recipientName}" subject="${subjectStr}" -->`
        : `<!-- ZOHO_DRAFT_META: email="${toEmail}" name="${recipientName}" subject="${subjectStr}" -->`;

      const reply = `📧 Here is the updated email for **${recipientName}** (${toEmail}):

**Subject**: ${subjectStr}

**Body**:
${newBody}

${metaTag}

[AWAITING_EMAIL_DECISION]
Would you like me to **send** this email or **save it as a draft**?`;
      const speakReply = `I have rewritten the email. Would you like me to send it or save it as a draft?`;
      return NextResponse.json({ reply, speakReply });
    }
  }

  return null;
}
