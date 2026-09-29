import { prisma } from "../prisma";

/** Invalidates all existing JWTs for a user (deactivate, password change, etc.). */
export async function bumpSessionVersion(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });
}

export interface SessionValidation {
  ok: boolean;
  reason?: "missing" | "inactive" | "stale";
}

/** Confirms the user is still allowed to use an existing JWT. */
export async function validateUserSession(
  userId: string,
  sessionVersion: number
): Promise<SessionValidation> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, sessionVersion: true },
  });
  if (!user) return { ok: false, reason: "missing" };
  if (!user.isActive) return { ok: false, reason: "inactive" };
  if (user.sessionVersion !== sessionVersion) return { ok: false, reason: "stale" };
  return { ok: true };
}
