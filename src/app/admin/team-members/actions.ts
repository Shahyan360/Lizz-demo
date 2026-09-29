"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../../lib/prisma";
import { requireAdmin } from "../../../lib/auth/session";
import {
  isTeamRoleKey,
  roleLabelForKey,
  type TeamRoleKey,
} from "../../../lib/reply/team-routing";
import { clearTeamRosterCache } from "../../../lib/reply/team-roster";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

async function refreshTeamViews(): Promise<void> {
  clearTeamRosterCache();
  revalidatePath("/admin/team-members");
  revalidatePath("/team");
  revalidatePath("/planner");
}

export async function createTeamMemberAction(input: {
  name: string;
  email: string;
  roleKey: string;
  isPrimary: boolean;
  isActive: boolean;
  notes?: string;
}): Promise<ActionResult> {
  await requireAdmin();

  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const roleKey = input.roleKey.trim();

  if (!name) return { ok: false, error: "Name is required." };
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email." };
  if (!isTeamRoleKey(roleKey)) return { ok: false, error: "Invalid role." };

  const exists = await prisma.teamMember.findUnique({
    where: { email },
  });
  if (exists) return { ok: false, error: "A team member with that email already exists." };

  await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.teamMember.updateMany({
        where: {
          roleKey: roleKey as TeamRoleKey,
          isPrimary: true,
        },
        data: { isPrimary: false },
      });
    }

    await tx.teamMember.create({
      data: {
        name,
        email,
        roleKey: roleKey as TeamRoleKey,
        isPrimary: input.isPrimary,
        isActive: input.isActive,
        notes: input.notes?.trim() || null,
      },
    });
  });

  await refreshTeamViews();
  return { ok: true, message: `${name} added as ${roleLabelForKey(roleKey)}.` };
}

export async function updateTeamMemberAction(input: {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  isPrimary: boolean;
  isActive: boolean;
  notes?: string;
}): Promise<ActionResult> {
  await requireAdmin();

  const member = await prisma.teamMember.findUnique({
    where: { id: input.id },
  });
  if (!member) return { ok: false, error: "Team member not found." };

  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const roleKey = input.roleKey.trim();

  if (!name) return { ok: false, error: "Name is required." };
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email." };
  if (!isTeamRoleKey(roleKey)) return { ok: false, error: "Invalid role." };

  const duplicate = await prisma.teamMember.findFirst({
    where: {
      email,
      NOT: { id: member.id },
    },
  });
  if (duplicate) return { ok: false, error: "Another member already uses that email." };

  await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.teamMember.updateMany({
        where: {
          roleKey: roleKey as TeamRoleKey,
          isPrimary: true,
          NOT: { id: member.id },
        },
        data: { isPrimary: false },
      });
    }

    await tx.teamMember.update({
      where: { id: member.id },
      data: {
        name,
        email,
        roleKey: roleKey as TeamRoleKey,
        isPrimary: input.isPrimary,
        isActive: input.isActive,
        notes: input.notes?.trim() || null,
      },
    });
  });

  await refreshTeamViews();
  return { ok: true, message: `${name} updated.` };
}

export async function archiveTeamMemberAction(id: string): Promise<ActionResult> {
  await requireAdmin();

  const member = await prisma.teamMember.findUnique({
    where: { id },
  });
  if (!member) return { ok: false, error: "Team member not found." };

  await prisma.teamMember.update({
    where: { id },
    data: { isActive: false, isPrimary: false },
  });

  await refreshTeamViews();
  return { ok: true, message: `${member.name} archived.` };
}