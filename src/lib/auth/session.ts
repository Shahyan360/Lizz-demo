import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "./options";
import { validateUserSession } from "./session-version";

/**
 * Server-side session helpers for pages and server actions. Middleware already
 * gates access broadly; these give per-page/per-action guarantees (defense in
 * depth) and a typed handle on the current user.
 */

export type SessionUser = NonNullable<
  Awaited<ReturnType<typeof getSessionUser>>
>;

/** The signed-in user, or null. */
export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id) return null;

  const valid = await validateUserSession(user.id, user.sessionVersion ?? 0);
  if (!valid.ok) return null;

  return user;
}

/** Require any signed-in user; redirect to /login otherwise. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Require an ADMIN; redirect non-admins home and anon users to /login. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
