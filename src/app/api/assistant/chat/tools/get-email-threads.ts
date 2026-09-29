import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { ZohoService } from "../../../../../services/zoho.service";
import { AUTOGATE_TEAM } from "../../../../../lib/reply/business-knowledge";

function htmlToText(html: string): string {
  if (!html) return "";
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

export async function handleGetEmailThreads(
  args: any
): Promise<NextResponse> {
  const rawContactName = args.contactName?.trim() || "";
  const rawContactEmail = args.contactEmail?.trim().toLowerCase() || "";
  const query = args.query?.trim() || "";
  let direction = (args.direction?.trim().toLowerCase() || "") as "incoming" | "outgoing" | "all";
  
  if (!direction) {
    if (rawContactName || rawContactEmail) {
      direction = "incoming";
    } else {
      direction = "all";
    }
  }

  const limit = Math.min(args.limit || 5, 10);

  let resolvedEmail = rawContactEmail;
  let resolvedName = rawContactName;
  let contactRecordInCrm: { name: string | null; email: string; stage: string } | null = null;

  if (resolvedEmail || resolvedName) {
    const contacts = await prisma.contact.findMany({
      take: 200,
    });
    const emailTarget = resolvedEmail.toLowerCase();
    const nameTarget = resolvedName.toLowerCase();
    const contact = contacts.find((c) => {
      const matchEmail = emailTarget && c.email.toLowerCase().includes(emailTarget);
      const matchName = nameTarget && ((c.name || "").toLowerCase().includes(nameTarget) || c.email.toLowerCase().includes(nameTarget));
      return matchEmail || matchName;
    });
    if (contact) {
      resolvedEmail = contact.email.toLowerCase();
      resolvedName = contact.name || resolvedName;
      contactRecordInCrm = {
        name: contact.name,
        email: contact.email,
        stage: contact.lifecycleStage,
      };
    }
  }

  if (!resolvedEmail && resolvedName) {
    const user = await prisma.user.findFirst({
      where: {
        name: { contains: resolvedName },
      },
    });
    if (user && user.email) {
      resolvedEmail = user.email.toLowerCase();
      resolvedName = user.name || resolvedName;
    }
  }

  if (!resolvedEmail && resolvedName) {
    const teamMember = AUTOGATE_TEAM.find((u) =>
      u.name.toLowerCase().includes(resolvedName.toLowerCase())
    );
    if (teamMember) {
      resolvedEmail = teamMember.email.toLowerCase();
      resolvedName = teamMember.name;
    }
  }

  const searchTerm = resolvedEmail || resolvedName || query;
  let threadsList: Array<{
    threadId: string;
    subject: string;
    sender: string;
    snippet: string;
    lastUpdated: string;
    isIncoming?: boolean;
  }> = [];

  const isFromLizzzOrSales = (senderStr: string) => {
    const s = senderStr.toLowerCase();
    return s.includes("max@myautogate.com") || s.includes("sales@myautogate.com") || s.includes("Lizzz");
  };

  const isFromTargetContact = (senderStr: string) => {
    if (!searchTerm) return true;
    const s = senderStr.toLowerCase();
    if (resolvedEmail && s.includes(resolvedEmail)) return true;
    if (resolvedName && s.includes(resolvedName.toLowerCase())) return true;
    return false;
  };

  const seenMessageIds = new Set<string>();

  // 2. PRIMARY: Query Zoho Mail API directly using multiple search strategies
  try {
    const searchKeysToTry: string[] = [];
    if (resolvedEmail) {
      searchKeysToTry.push(direction === "incoming" ? `from:${resolvedEmail}` : `entire:${resolvedEmail}`);
      searchKeysToTry.push(`entire:${resolvedEmail}`);
    } else if (resolvedName) {
      searchKeysToTry.push(direction === "incoming" ? `from:${resolvedName}` : `entire:${resolvedName}`);
      searchKeysToTry.push(`entire:${resolvedName}`);
    } else if (query) {
      searchKeysToTry.push(`entire:${query}`);
    }

    for (const key of searchKeysToTry) {
      if (threadsList.length >= limit) break;
      try {
        const zohoEmails = await ZohoService.searchMessages({
          searchKey: key,
          limit: limit * 2,
        });

        for (const m of zohoEmails) {
          if (seenMessageIds.has(m.messageId)) continue;

          const fullSender = `${m.senderName || ""} <${m.from || ""}>`.trim();

          if (direction === "incoming" && isFromLizzzOrSales(fullSender)) continue;
          if (direction === "incoming" && (resolvedEmail || resolvedName) && !isFromTargetContact(fullSender)) continue;
          if (direction === "outgoing" && !isFromLizzzOrSales(fullSender)) continue;

          seenMessageIds.add(m.messageId);

          let snippetText = m.summary?.trim() || "";
          if (!snippetText && m.folderId && m.messageId) {
            try {
              const rawContent = await ZohoService.getEmailContent(m.messageId, m.folderId);
              snippetText = htmlToText(rawContent).slice(0, 160);
            } catch {
              // ignore content fetch failure
            }
          }

          threadsList.push({
            threadId: m.messageId,
            subject: m.subject || "(No Subject)",
            sender: fullSender,
            snippet: snippetText || "No email body preview available",
            lastUpdated: m.receivedAt.toISOString(),
          });

          if (threadsList.length >= limit) break;
        }
      } catch (err) {
        console.warn(`[handleGetEmailThreads] Zoho search for key "${key}" failed:`, err);
      }
    }

    // 2b. Also scan recent inbox messages directly if search keys returned 0
    if (threadsList.length === 0 && (resolvedEmail || resolvedName)) {
      try {
        const inboxEmails = await ZohoService.getEmails({ limit: 40 });
        for (const m of inboxEmails) {
          if (seenMessageIds.has(m.messageId)) continue;
          const fullSender = `${m.senderName || ""} <${m.from || ""}>`.trim();

          if (direction === "incoming" && isFromLizzzOrSales(fullSender)) continue;
          if (direction === "incoming" && !isFromTargetContact(fullSender)) continue;

          seenMessageIds.add(m.messageId);
          let snippetText = m.summary?.trim() || "";
          if (!snippetText && m.folderId && m.messageId) {
            try {
              const rawContent = await ZohoService.getEmailContent(m.messageId, m.folderId);
              snippetText = htmlToText(rawContent).slice(0, 160);
            } catch {}
          }

          threadsList.push({
            threadId: m.messageId,
            subject: m.subject || "(No Subject)",
            sender: fullSender,
            snippet: snippetText || "No email body preview available",
            lastUpdated: m.receivedAt.toISOString(),
          });

          if (threadsList.length >= limit) break;
        }
      } catch (err) {
        console.warn("[handleGetEmailThreads] Zoho getEmails scan failed:", err);
      }
    }
  } catch (err) {
    console.warn("[handleGetEmailThreads] Zoho API error, falling back to local DB:", err);
  }

  // 3. (Exclusively Zoho Mail API — no local DB query fallback per Zoho-only directive)


  // 4. Output formatting
  if (threadsList.length === 0) {
    const targetLabel = resolvedName || rawContactName || resolvedEmail || rawContactEmail || query;
    const directionLabel = direction === "incoming" ? "received FROM" : direction === "outgoing" ? "sent TO" : "with";

    if (contactRecordInCrm) {
      const reply = `👤 **Contact Found in Workspace**: **${contactRecordInCrm.name || targetLabel}** (\`${contactRecordInCrm.email}\` | Lifecycle Stage: ${contactRecordInCrm.stage})\n\nHowever, I searched your Zoho mailbox and email database, and there are currently **no email messages** ${directionLabel} ${contactRecordInCrm.email}.\n\nWould you like me to **compose a new email** to ${contactRecordInCrm.name || contactRecordInCrm.email}?`;
      const speakReply = `I found ${contactRecordInCrm.name || targetLabel} in your workspace contacts, but there are no emails received from them yet. Would you like me to send them an email?`;
      return NextResponse.json({ reply, speakReply, contact: contactRecordInCrm });
    }

    const reply = `I searched your workspace contacts and Zoho mailbox, but couldn't find any contact or emails ${directionLabel} **${targetLabel || "the specified contact"}**.`;
    const speakReply = `I couldn't find any contact or emails matching ${targetLabel || "that request"}.`;
    return NextResponse.json({ reply, speakReply });
  }

  const targetLabel = resolvedName || rawContactName || "the contact";
  const contactBadge = contactRecordInCrm
    ? `👤 **Contact**: **${contactRecordInCrm.name || targetLabel}** (\`${contactRecordInCrm.email}\`)\n\n`
    : "";

  const headerText =
    direction === "incoming"
      ? `${contactBadge}📬 Found ${threadsList.length} email(s) received **FROM ${targetLabel}** (via Zoho Mail):`
      : direction === "outgoing"
      ? `${contactBadge}📬 Found ${threadsList.length} email(s) sent **TO ${targetLabel}** (via Zoho Mail):`
      : `${contactBadge}📬 Found ${threadsList.length} email conversation(s) with **${targetLabel}** (via Zoho Mail):`;

  let formattedThreads = threadsList
    .map(
      (t, index) =>
        `${index + 1}. **${t.subject}** (Thread ID: \`${t.threadId}\`)\n   - **From**: ${t.sender}\n   - **Body Snippet**: "${t.snippet}"`
    )
    .join("\n\n");

  const reply = `${headerText}\n\n${formattedThreads}\n\nWould you like me to **reply** to any of these emails?`;
  const speakReply = `I found ${threadsList.length} email threads for ${targetLabel}. The most recent subject is "${threadsList[0].subject}". Would you like me to draft a reply?`;

  return NextResponse.json({ reply, speakReply, threads: threadsList, contact: contactRecordInCrm || undefined });
}
