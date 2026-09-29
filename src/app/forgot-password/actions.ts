"use server";

import { prisma } from "../../lib/prisma";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../../lib/auth/password";
import { hashResetToken } from "../../lib/auth/password-reset";
import { isResetRateLimited, recordResetAttempt } from "../../lib/auth/reset-rate-limit";
import { sendSetPasswordEmail } from "../../lib/auth/send-set-password-email";
import { bumpSessionVersion } from "../../lib/auth/session-version";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

const FORGOT_PASSWORD_SUCCESS =
  "If an account exists for that email, we've sent a password reset link. Check your inbox (and spam folder).";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Request a password-reset email. Always returns the same success message so
 * attackers can't probe for registered emails. Rate-limited per email address.
 */
export async function requestPasswordResetAction(input: {
  email: string;
}): Promise<ActionResult> {
  const email = normalizeEmail(input.email);

  if (!isValidEmail(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  if (isResetRateLimited(email)) {
    return {
      ok: false,
      error: "Too many attempts. Please wait a few minutes and try again.",
    };
  }
  recordResetAttempt(email);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    return { ok: true, message: FORGOT_PASSWORD_SUCCESS };
  }

  const sent = await sendSetPasswordEmail({
    userId: user.id,
    email: user.email,
    name: user.name,
    purpose: "reset",
  });
  if (!sent.ok) {
    console.error("[password-reset] failed to send email for", email);
  }

  return { ok: true, message: FORGOT_PASSWORD_SUCCESS };
}

/**
 * Consumes a valid reset token and sets a new password. Invalid / expired /
 * used tokens all return the same error.
 */
export async function resetPasswordAction(input: {
  token: string;
  password: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  const rawToken = input.token?.trim() ?? "";
  if (!rawToken) {
    return { ok: false, error: "This reset link is invalid or has expired." };
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (input.password !== input.confirmPassword) {
    return { ok: false, error: "Passwords do not match." };
  }

  const tokenHash = hashResetToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.expiresAt.getTime() < Date.now()) {
    if (record) {
      await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => {});
    }
    return { ok: false, error: "This reset link is invalid or has expired." };
  }

  if (!record.user.isActive) {
    await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => {});
    return { ok: false, error: "This account is deactivated. Contact an admin." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { password: await hashPassword(input.password) },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);
  await bumpSessionVersion(record.userId);

  return { ok: true };
}

/** Returns true when the token exists and has not expired (for UI messaging). */
export async function isResetTokenValid(rawToken: string): Promise<boolean> {
  const token = rawToken?.trim() ?? "";
  if (!token) return false;
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
  });
  return Boolean(record && record.expiresAt.getTime() >= Date.now());
}
