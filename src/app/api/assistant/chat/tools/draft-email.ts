import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { AUTOGATE_TEAM } from "../../../../../lib/reply/business-knowledge";

export async function handleDraftEmail(
  args: any,
  sessionUser?: { name?: string | null; email?: string | null }
): Promise<NextResponse> {
  let emailToUse = args.recipientEmail?.trim().toLowerCase() || "";
  let nameToUse = args.recipientName?.trim() || "";

  if (!emailToUse && nameToUse.includes("@")) {
    emailToUse = nameToUse.toLowerCase();
    nameToUse = "";
  }

  if (!emailToUse && nameToUse) {
    // 1. Check CRM contacts (case-insensitive)
    const contacts = await prisma.contact.findMany({
      take: 200,
    });
    const target = nameToUse.toLowerCase();
    const contact = contacts.find((c) =>
      (c.name || "").toLowerCase().includes(target) ||
      c.email.toLowerCase().includes(target)
    );
    if (contact) {
      emailToUse = contact.email;
      nameToUse = contact.name || nameToUse;
    }
  }

  if (!emailToUse && nameToUse) {
    // 2. Check AUTOGATE_TEAM roster
    const teamMember = AUTOGATE_TEAM.find((u) =>
      u.name.toLowerCase().includes(nameToUse.toLowerCase())
    );
    if (teamMember) {
      emailToUse = teamMember.email;
      nameToUse = teamMember.name;
    }
  }

  if (!emailToUse && nameToUse) {
    // 3. Check User table
    const user = await prisma.user.findFirst({
      where: {
        name: {
          contains: nameToUse,
        },
      },
    });
    if (user && user.email) {
      emailToUse = user.email;
      nameToUse = user.name || nameToUse;
    }
  }

  if (!emailToUse && nameToUse) {
    // 4. Check current session user
    if (sessionUser?.name && sessionUser.name.toLowerCase().includes(nameToUse.toLowerCase())) {
      emailToUse = sessionUser.email || "";
      nameToUse = sessionUser.name;
    } else if (sessionUser?.email) {
      emailToUse = sessionUser.email;
    }
  }

  if (!emailToUse) {
    const reply = `I couldn't find an email address for **${nameToUse || "specified contact"}** in your workspace contacts or team list. Please provide their email address so I can prepare the email for you.`;
    const speakReply = `I couldn't find an email address for ${nameToUse || "that contact"}. Please tell me their email address.`;
    return NextResponse.json({ reply, speakReply });
  }

  const subject = args.subject?.trim() || `Greetings for ${nameToUse || "you"}`;
  // Safety net: replace any "[Your Name]" placeholder the LLM may accidentally include.
  const rawBody = args.body?.trim() || `Hi ${nameToUse || "there"},\n\nI hope you are having a great day! I wanted to reach out and send you a warm greeting.\n\nBest regards,\nLizzz`;
  const body = rawBody.replace(/\[Your Name\]/gi, "Lizzz");

  // Present the email to the user for review — no Zoho write yet.
  const reply = `📧 Here is the email I've prepared for **${nameToUse || emailToUse}** (${emailToUse}):

**Subject**: ${subject}

**Body**:
${body}

<!-- ZOHO_DRAFT_META: email="${emailToUse}" name="${nameToUse}" subject="${subject}" -->

[AWAITING_EMAIL_DECISION]
Is this email correct? Would you like me to **send** it or **save it as a draft**?`;
  const speakReply = `Here is the email I prepared for ${nameToUse || emailToUse}. Subject: ${subject}. Is this correct, and would you like me to send it or save it as a draft?`;
  return NextResponse.json({ reply, speakReply });
}
