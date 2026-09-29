import { NextResponse } from "next/server";
import { domainOf, FREE_DOMAINS } from "../../../../../lib/repositories/company.repository";
import { createContact } from "../../../../contacts/actions";

export async function handleAddContact(args: any): Promise<NextResponse | null> {
  const name = args.name?.trim();
  const email = args.email?.trim().toLowerCase();
  const stage = args.stage || "NEW";

  if (!name || !email) return null;

  const domain = domainOf(email);

  if (domain === "myautogate.com") {
    const reply = `**${email}** is a personal/team internal email and cannot be added to the CRM contacts list.`;
    const speakReply = `That is a team internal email and cannot be added to the CRM contacts list.`;
    return NextResponse.json({ reply, speakReply });
  }

  const isPersonalEmail = !domain || FREE_DOMAINS.has(domain);

  if (isPersonalEmail) {
    const res = await createContact({ name, email, stage, companyId: null });
    if (res.ok) {
      const reply = `✅ Contact **${name}** (${email}) has been successfully added with stage **${stage}**!`;
      const speakReply = `Contact ${name} has been added.`;
      return NextResponse.json({ reply, speakReply });
    }
  } else {
    const reply = `Is **${name}** (${email}) associated with the company **${domain}**?\n\nPlease reply **Yes** or **No**.`;
    const speakReply = `Is ${name} associated with ${domain}? Please reply Yes or No.`;
    return NextResponse.json({ reply, speakReply });
  }

  return null;
}
