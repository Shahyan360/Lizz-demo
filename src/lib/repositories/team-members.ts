import { prisma } from "../prisma";

export interface DefaultTeamMember {
  name: string;
  email: string;
  roleKey: string;
  isPrimary: boolean;
}

export const DEFAULT_TEAM_MEMBERS: DefaultTeamMember[] = [
  { name: "Dave", email: "adnanzahidpro@gmail.com", roleKey: "owner_review", isPrimary: true },
  { name: "Mathew", email: "adnanzahidpro@gmail.com", roleKey: "proposal_reviewer", isPrimary: true },
  { name: "Sarah", email: "adnanzahidpro@gmail.com", roleKey: "scheduler", isPrimary: true },
  { name: "Beverly", email: "adnanzahidpro@gmail.com", roleKey: "admin_handler", isPrimary: true },
];

export interface TeamMemberRecord {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  isPrimary: boolean;
  isActive: boolean;
}

export async function listActiveTeamMembers(): Promise<TeamMemberRecord[]> {
  const rows = await prisma.teamMember.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ roleKey: "asc" }, { isPrimary: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      roleKey: true,
      isPrimary: true,
      isActive: true,
    },
  });

  return rows;
}

export async function listPrimaryTeamMembers(): Promise<TeamMemberRecord[]> {
  const rows = await prisma.teamMember.findMany({
    where: {
      isActive: true,
      isPrimary: true,
    },
    orderBy: [{ roleKey: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      roleKey: true,
      isPrimary: true,
      isActive: true,
    },
  });

  return rows;
}

export async function ensureDefaultTeamMembers(): Promise<void> {
  for (const member of DEFAULT_TEAM_MEMBERS) {
    const exists = await prisma.teamMember.findUnique({
      where: {
        email: member.email,
      },
      select: { id: true },
    });

    if (exists) continue;

    await prisma.teamMember.create({
      data: {
        name: member.name,
        email: member.email,
        roleKey: member.roleKey,
        isPrimary: member.isPrimary,
        isActive: true,
      },
    });
  }
}
