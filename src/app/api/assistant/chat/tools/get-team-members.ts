import { NextResponse } from "next/server";
import { AUTOGATE_TEAM } from "../../../../../lib/reply/business-knowledge";

export async function handleGetTeamMembers(): Promise<NextResponse> {
  const team = AUTOGATE_TEAM;
  const formattedReply =
    `Team Roster\n\nYour workspace active team members are:\n\n` +
    team.map((u, i) => `${i + 1}. **${u.name}** (${u.email})`).join("\n");

  const namesList = team.map((u) => u.name).join(", ");
  const speakReply = `You have ${team.length} team members: ${namesList}.`;

  return NextResponse.json({ reply: formattedReply, speakReply });
}
