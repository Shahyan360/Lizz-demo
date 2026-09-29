import { NextResponse } from "next/server";
import { createCompany } from "../../../../companies/action";
import { createContact } from "../../../../contacts/actions";

export async function handleCompanyFollowup({
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
    !lastAssistantMsg.content.includes("associated with the company")
  ) {
    return null;
  }

  const isYes = /^(yes|yeah|yep|sure|ok|true)/i.test(message.trim());
  const isNo = /^(no|nope|nah|false)/i.test(message.trim());

  const nameMatch = lastAssistantMsg.content.match(/\*\*([^*]+)\*\*/);
  const emailMatch = lastAssistantMsg.content.match(
    /\(([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\)/
  );
  const domainMatch = lastAssistantMsg.content.match(/company \*\*([^*]+)\*\*/);

  if (nameMatch && emailMatch && domainMatch) {
    const name = nameMatch[1];
    const email = emailMatch[1];
    const domain = domainMatch[1];

    if (isYes) {
      const compRes = await createCompany({ name: domain, domain });
      const res = await createContact({
        name,
        email,
        stage: "NEW",
        companyId: compRes.id || null,
        isCompanyExcluded: false,
      });
      if (res.ok) {
        const reply = `✅ Contact **${name}** (${email}) has been created and added to the people list of company **${domain}**!`;
        const speakReply = `Contact ${name} has been added to ${domain}.`;
        return NextResponse.json({ reply, speakReply });
      }
    } else if (isNo) {
      const res = await createContact({
        name,
        email,
        stage: "NEW",
        companyId: null,
        isCompanyExcluded: true,
      });
      if (res.ok) {
        const reply = `✅ Contact **${name}** (${email}) has been created as an individual contact without adding to any company.`;
        const speakReply = `Contact ${name} has been created as an individual contact.`;
        return NextResponse.json({ reply, speakReply });
      }
    }
  }

  return null;
}
