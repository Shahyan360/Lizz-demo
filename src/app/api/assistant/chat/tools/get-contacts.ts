import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { formatSpeakReply } from "../utils";

export async function handleGetContacts(
  args: { query?: string; name?: string; email?: string; stage?: string; limit?: number; offset?: number }
): Promise<NextResponse> {
  const searchTerm = (args.query || args.name || args.email || "").trim().toLowerCase();
  const pageLimit = args.limit || 10;
  const offset = args.offset || 0;

  // Fetch contacts
  let contacts = await prisma.contact.findMany({
    include: { company: true },
    orderBy: { lastInteractionAt: "desc" },
    take: 200,
  });

  // Safe JavaScript case-insensitive search across name, email, company name, and notes
  if (searchTerm) {
    contacts = contacts.filter((c) => {
      const nameMatch = (c.name || "").toLowerCase().includes(searchTerm);
      const emailMatch = (c.email || "").toLowerCase().includes(searchTerm);
      const companyMatch = (c.company?.name || "").toLowerCase().includes(searchTerm);
      const notesMatch = (c.notes || "").toLowerCase().includes(searchTerm);
      return nameMatch || emailMatch || companyMatch || notesMatch;
    });
  }

  if (args.stage) {
    const stageTarget = args.stage.trim().toUpperCase();
    contacts = contacts.filter((c) => c.lifecycleStage === stageTarget);
  }

  if (contacts.length === 0) {
    const queryLabel = searchTerm ? ` matching "${searchTerm}"` : "";
    const reply = `No contacts found in your workspace${queryLabel}.`;
    return NextResponse.json({ reply, speakReply: formatSpeakReply(reply) });
  }

  const totalCount = contacts.length;
  const displayedContacts = contacts.slice(offset, offset + pageLimit);

  if (displayedContacts.length === 0) {
    const reply = `No more contacts to show (total ${totalCount}).`;
    return NextResponse.json({ reply, speakReply: formatSpeakReply(reply) });
  }

  const contactBlocks = displayedContacts.map((c, i) => {
    const itemNumber = offset + i + 1;
    const nameStr = c.name || "Unnamed Contact";
    const companyStr = c.company?.name ? ` (${c.company.name})` : "";
    const notesStr = c.notes ? `\n   - Notes: ${c.notes}` : "";
    return `${itemNumber}. **${nameStr}**${companyStr}\n   - Email: ${c.email}\n   - Stage: ${c.lifecycleStage}\n   - Last Interaction: ${c.lastInteractionAt ? c.lastInteractionAt.toISOString().slice(0, 10) : "N/A"}${notesStr}`;
  });

  const startNum = offset + 1;
  const endNum = offset + displayedContacts.length;
  const isPaged = offset > 0 || totalCount > displayedContacts.length;
  const headerLabel = isPaged ? ` (${totalCount} found — showing ${startNum} to ${endNum})` : ` (${totalCount} found)`;

  let reply = `## Contacts${headerLabel}\n\n` + contactBlocks.join("\n\n---\n\n");
  let speakReply = `Showing contacts ${startNum} to ${endNum} of ${totalCount} total.`;

  if (offset + displayedContacts.length < totalCount) {
    const remaining = totalCount - (offset + displayedContacts.length);
    reply += `\n\n---\n*Showing ${startNum}-${endNum} of ${totalCount} contacts. Would you like to see the remaining ${remaining} contacts?*`;
    speakReply += ` Would you like to see the remaining ${remaining}?`;
  } else if (offset > 0) {
    reply += `\n\n---\n*You have reached the end of the contacts list (${totalCount} total).*`;
  }

  return NextResponse.json({ reply, speakReply: formatSpeakReply(speakReply) });
}
