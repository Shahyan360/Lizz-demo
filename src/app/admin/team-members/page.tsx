import { requireAdmin } from "../../../lib/auth/session";
import { getOrCreateTenant } from "../../../lib/tenant";
import { prisma } from "../../../lib/prisma";
import { TeamMembersManager } from "./TeamMembersManager";
import {
  TEAM_ROLE_DEFS,
  roleLabelForKey,
  type TeamRoleKey,
} from "../../../lib/reply/team-routing";
import type { TeamMemberRow, TeamRoleOption } from "./types";

export const dynamic = "force-dynamic";

export default async function TeamMembersPage() {
  await requireAdmin();

  const members = await prisma.teamMember.findMany({
    orderBy: [
      { roleKey: "asc" },
      { isPrimary: "desc" },
      { isActive: "desc" },
      { createdAt: "asc" },
    ],
  });

  const rows: TeamMemberRow[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    roleKey: m.roleKey as TeamRoleKey,
    roleLabel: roleLabelForKey(m.roleKey),
    isPrimary: m.isPrimary,
    isActive: m.isActive,
    notes: m.notes,
    createdAtLabel: m.createdAt.toLocaleDateString(),
    updatedAtLabel: m.updatedAt.toLocaleString(),
  }));

  const roleOptions: TeamRoleOption[] = TEAM_ROLE_DEFS.map((role) => ({
    key: role.key,
    label: role.label,
    description: role.description,
  }));

  return <TeamMembersManager initialMembers={rows} roleOptions={roleOptions} />;
}
