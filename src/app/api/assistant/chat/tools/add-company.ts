import { NextResponse } from "next/server";
import { createCompany } from "../../../../companies/action";

export async function handleAddCompany(args: any): Promise<NextResponse | null> {
  let domain = args.domain?.trim().toLowerCase() || null;
  const compName = args.name || domain;

  if (domain) {
    const res = await createCompany({ name: compName, domain });
    if (res.ok) {
      const reply = `✅ Company **${compName}** (${domain}) has been successfully created!`;
      const speakReply = `Company ${compName} has been created.`;
      return NextResponse.json({ reply, speakReply });
    }
  }

  return null;
}
