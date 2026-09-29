"use server";

import { prisma } from "../../../lib/prisma";
import { requireUser } from "../../../lib/auth/session";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "../../../lib/auth/password";
import { bumpSessionVersion } from "../../../lib/auth/session-version";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/** Change password for the currently signed-in user. */
export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  const sessionUser = await requireUser();

  const currentPassword = input.currentPassword ?? "";
  const newPassword = input.newPassword ?? "";
  const confirmPassword = input.confirmPassword ?? "";

  if (!currentPassword) {
    return { ok: false, error: "Enter your current password." };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, error: "New passwords do not match." };
  }
  if (currentPassword === newPassword) {
    return {
      ok: false,
      error: "New password must be different from your current password.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, password: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return { ok: false, error: "Account not found or deactivated." };
  }

  const valid = await verifyPassword(currentPassword, user.password);
  if (!valid) {
    return { ok: false, error: "Current password is incorrect." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await hashPassword(newPassword) },
  });
  await bumpSessionVersion(user.id);

  return { ok: true, message: "Your password has been updated." };
}
