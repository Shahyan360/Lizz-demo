import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { ZohoService } from "../../../../../services/zoho.service";
import { AUTOGATE_TEAM } from "../../../../../lib/reply/business-knowledge";

export async function handleReplyToEmailThread(
  args: any,
  sessionUser?: { name?: string | null; email?: string | null }
): Promise<NextResponse> {
  let zohoMessageId = args.threadId?.trim() || "";
  let nameToUse = args.recipientName?.trim() || "";
  let emailToUse = args.recipientEmail?.trim().toLowerCase() || "";

  if (!emailToUse && nameToUse.includes("@")) {
    emailToUse = nameToUse.toLowerCase();
    nameToUse = "";
  }

  // 1. Resolve contact email across CRM contacts, Users, Team roster, or session
  if (!emailToUse && nameToUse) {
    const contacts = await prisma.contact.findMany({
      take: 200,
    });
    const target = nameToUse.toLowerCase();
    const contact = contacts.find((c) =>
      (c.name || "").toLowerCase().includes(target) ||
      c.email.toLowerCase().includes(target)
    );
    if (contact) {
      emailToUse = contact.email.toLowerCase();
      nameToUse = contact.name || nameToUse;
    }
  }

  if (!emailToUse && nameToUse) {
    const teamMember = AUTOGATE_TEAM.find((u) =>
      u.name.toLowerCase().includes(nameToUse.toLowerCase())
    );
    if (teamMember) {
      emailToUse = teamMember.email.toLowerCase();
      nameToUse = teamMember.name;
    }
  }

  if (!emailToUse && nameToUse) {
    const user = await prisma.user.findFirst({
      where: { name: { contains: nameToUse } },
    });
    if (user && user.email) {
      emailToUse = user.email.toLowerCase();
      nameToUse = user.name || nameToUse;
    }
  }

  if (!emailToUse && sessionUser?.email && nameToUse) {
    if (sessionUser.name?.toLowerCase().includes(nameToUse.toLowerCase())) {
      emailToUse = sessionUser.email.toLowerCase();
      nameToUse = sessionUser.name || nameToUse;
    }
  }

  // 2. Fetch original email details directly from Zoho Mail API
  let fetchedSubject = "";

  if (zohoMessageId) {
    try {
      const messages = await ZohoService.searchMessages({
        searchKey: `entire:${zohoMessageId}`,
        limit: 1,
      });
      if (messages.length > 0) {
        fetchedSubject = messages[0].subject || "";
        if (!emailToUse && messages[0].from) {
          emailToUse = messages[0].from.toLowerCase();
          nameToUse = messages[0].senderName || nameToUse;
        }
      }
    } catch (err) {
      console.warn("[handleReplyToEmailThread] Failed to fetch Zoho message by ID:", err);
    }
  }

  // If no message ID provided, search Zoho Mail for latest message from this contact
  if (!zohoMessageId && (emailToUse || nameToUse)) {
    try {
      const searchKey = emailToUse ? `from:${emailToUse}` : `from:${nameToUse}`;
      const searchResults = await ZohoService.searchMessages({
        searchKey,
        limit: 5,
      });
      if (searchResults.length > 0) {
        const latestMsg = searchResults[0];
        zohoMessageId = latestMsg.messageId;
        fetchedSubject = latestMsg.subject || "";
        if (!emailToUse && latestMsg.from) {
          emailToUse = latestMsg.from.toLowerCase();
          nameToUse = latestMsg.senderName || nameToUse;
        }
      }
    } catch (err) {
      console.warn("[handleReplyToEmailThread] Failed to search Zoho Mail for contact message:", err);
    }
  }

  // Subject determination
  let subject = args.subject?.trim() || "";
  if (!subject) {
    if (fetchedSubject) {
      subject = fetchedSubject.startsWith("Re:") ? fetchedSubject : `Re: ${fetchedSubject}`;
    } else {
      subject = `Re: Follow up with ${nameToUse || "you"}`;
    }
  } else if (!subject.toLowerCase().startsWith("re:")) {
    subject = `Re: ${subject}`;
  }

  // Body sanitization
  const sanitizeBody = (args.replyBody || "").trim().replace(/\[Your Name\]/gi, "Lizzz");
  const textWithoutSignoff = sanitizeBody
    .replace(/best\s*regards,?\s*Lizzz/gi, "")
    .replace(/sincerely,?\s*Lizzz/gi, "")
    .replace(/thanks,?\s*Lizzz/gi, "")
    .trim();

  let replyBody = sanitizeBody;
  if (!textWithoutSignoff || textWithoutSignoff.length < 15) {
    const topic = subject.replace(/^Re:\s*/i, "").trim() || "your inquiry";
    replyBody = `Hi ${nameToUse || "there"},\n\nThank you for reaching out regarding ${topic}. I have reviewed your request and would be happy to assist you with this.\n\nPlease let me know if you need any further information or updates!\n\nBest regards,\nLizzz`;
  } else if (!replyBody.toLowerCase().includes("best regards") && !replyBody.toLowerCase().includes("sincerely")) {
    replyBody = `${replyBody}\n\nBest regards,\nLizzz`;
  }

  const recipientLabel = nameToUse || emailToUse || "the recipient";

  const replyText = `📧 **Prepared In-Thread Reply** for **${recipientLabel}** (${emailToUse || "No Email"}):
${zohoMessageId ? `\n> **Linked to Zoho Thread**: \`${fetchedSubject || subject}\` (Message ID: \`${zohoMessageId}\`)` : ""}

**Subject**: ${subject}

**Reply Body**:
${replyBody}

<!-- ZOHO_REPLY_META: messageId="${zohoMessageId}" email="${emailToUse}" name="${nameToUse}" subject="${subject}" -->

[AWAITING_EMAIL_DECISION]
This reply has been formatted as an in-thread reply carrying Zoho threading headers. Would you like me to **send it now** or **keep it saved as a draft**?`;

  const speakReply = `I have prepared an in-thread reply for ${nameToUse || emailToUse || "the conversation"}. Subject: ${subject}. Would you like me to send it now or save it as a draft?`;

  return NextResponse.json({
    reply: replyText,
    speakReply,
    threadId: zohoMessageId || undefined,
    action: args.action || "draft",
  });
}
