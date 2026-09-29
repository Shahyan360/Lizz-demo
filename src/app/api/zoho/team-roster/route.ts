import { NextResponse } from "next/server";
import { getTeamRoster } from "../../../../lib/reply/team-roster";
import { ZohoService } from "../../../../services/zoho.service";
import { getOrCreateTenant } from "../../../../lib/tenant";

/**
 * Diagnostic: shows the resolved internal team roster (name + email) used for
 * @-mention → CC, plus the raw Zoho-contacts count, so you can confirm it's
 * pulling from Zoho. Auth-protected (returns internal addresses). No side effects.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  let ourDomain = "";
  let zohoContactCount = 0;
  let zohoError: string | null = null;

  try {
    const primary = (await ZohoService.getPrimaryEmailAddress()).toLowerCase();
    ourDomain = primary.split("@")[1] ?? "";
    const contacts = await ZohoService.getContacts();
    zohoContactCount = contacts.length;
  } catch (err) {
    zohoError = err instanceof Error ? err.message : String(err);
  }

  const roster = await getTeamRoster();

  return NextResponse.json({
    ourDomain,
    zohoContactCount,
    zohoError,
    rosterSize: roster.length,
    roster,
    note:
      roster.length === 0
        ? "Empty roster → no CC will be added. Check AUTOGATE_TEAM in business-knowledge.ts."
        : "These teammates will be CC'd when @-mentioned or on scheduling handoffs.",
  });
}
