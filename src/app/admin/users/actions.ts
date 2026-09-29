"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { requireAdmin } from "../../../lib/auth/session";
import { getOrCreateTenant } from "../../../lib/tenant";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../../../lib/auth/password";
import {
  randomUnusablePassword,
  sendSetPasswordEmail,
} from "../../../lib/auth/send-set-password-email";
import { bumpSessionVersion } from "../../../lib/auth/session-version";

/**
 * Server actions backing the /admin/users panel. Every action re-checks the
 * ADMIN role (defense in depth beyond middleware) and guards the "last active
 * admin" invariant so an admin can't lock everyone out.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

const ROLES: Role[] = ["ADMIN", "USER"];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function roleOf(value: string): Role {
  return ROLES.includes(value as Role) ? (value as Role) : "USER";
}

/** Count of accounts that can currently sign in as ADMIN. */
function countActiveAdmins(): Promise<number> {
  return prisma.user.count({ where: { role: "ADMIN", isActive: true } });
}

/** Invite a new user — no admin-chosen password; they set it via emailed link. */
export async function createUserAction(input: {
  name: string;
  email: string;
  role: string;
}): Promise<ActionResult> {
  await requireAdmin();

  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const role = roleOf(input.role);

  if (!isValidEmail(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "A user with that email already exists." };
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      password: await hashPassword(randomUnusablePassword()),
      role,
    },
  });

  const sent = await sendSetPasswordEmail({
    userId: user.id,
    email: user.email,
    name: user.name,
    purpose: "invite",
  });
  if (!sent.ok) {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    return { ok: false, error: sent.error };
  }

  revalidatePath("/admin/users");
  return { ok: true, message: `Invite sent to ${email}.` };
}

/** Resend the set-password / invite email for an existing user. */
export async function resendInviteAction(userId: string): Promise<ActionResult> {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { ok: false, error: "User not found." };
  }
  if (!user.isActive) {
    return { ok: false, error: "Reactivate this user before sending an invite." };
  }

  const sent = await sendSetPasswordEmail({
    userId: user.id,
    email: user.email,
    name: user.name,
    purpose: "invite",
  });
  if (!sent.ok) {
    return { ok: false, error: sent.error };
  }

  return { ok: true, message: `Invite resent to ${user.email}.` };
}

export async function updateUserAction(input: {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  password?: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();

  const target = await prisma.user.findUnique({ where: { id: input.id } });
  if (!target) {
    return { ok: false, error: "User not found." };
  }

  const nextRole = roleOf(input.role);
  const name = input.name.trim();
  const wasActive = target.isActive;

  const losingAdmin =
    target.role === "ADMIN" &&
    target.isActive &&
    (nextRole !== "ADMIN" || !input.isActive);
  if (losingAdmin && (await countActiveAdmins()) <= 1) {
    return {
      ok: false,
      error: "This is the last active admin — promote another admin first.",
    };
  }

  if (input.id === admin.id && !input.isActive) {
    return { ok: false, error: "You can't deactivate your own account." };
  }

  const data: {
    name: string | null;
    role: Role;
    isActive: boolean;
    password?: string;
  } = {
    name: name || null,
    role: nextRole,
    isActive: input.isActive,
  };

  let invalidateSessions = false;

  if (input.password && input.password.length > 0) {
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      return {
        ok: false,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      };
    }
    data.password = await hashPassword(input.password);
    invalidateSessions = true;
  }

  if (wasActive && !input.isActive) {
    invalidateSessions = true;
  }

  await prisma.user.update({ where: { id: input.id }, data });
  if (invalidateSessions) {
    await bumpSessionVersion(input.id);
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteUserAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();

  if (id === admin.id) {
    return { ok: false, error: "You can't delete your own account." };
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return { ok: false, error: "User not found." };
  }

  if (
    target.role === "ADMIN" &&
    target.isActive &&
    (await countActiveAdmins()) <= 1
  ) {
    return { ok: false, error: "You can't delete the last active admin." };
  }

  await prisma.user.delete({ where: { id } });

  revalidatePath("/admin/users");
  return { ok: true };
}
