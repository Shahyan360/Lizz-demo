import { requireAdmin } from "../../../lib/auth/session";
import { prisma } from "../../../lib/prisma";
import { UsersManager } from "./UsersManager";
import type { UserRow } from "./types";

/**
 * /admin/users — the user management panel (ADMIN only). Middleware already
 * gates /admin, but requireAdmin() re-checks here so a direct hit can't slip
 * through. Loads all workspace users and hands them to the client manager.
 */
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const admin = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    createdAtLabel: u.createdAt.toLocaleDateString(),
    lastLoginAtLabel: u.lastLoginAt
      ? u.lastLoginAt.toLocaleString()
      : "Never",
  }));

  return <UsersManager initialUsers={rows} currentUserId={admin.id} />;
}
