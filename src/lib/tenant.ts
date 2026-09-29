import { ensureDefaultTeamMembers } from "./repositories/team-members";

export async function getOrCreateTenant(): Promise<{ id: string; name: string }> {
  await ensureDefaultTeamMembers();
  return { id: "single-account", name: "Primary Workspace" };
}
