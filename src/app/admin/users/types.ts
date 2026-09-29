import type { Role } from "@prisma/client";

/** Serializable user row passed from the server page to the client manager. */
export interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  isActive: boolean;
  createdAtLabel: string;
  lastLoginAtLabel: string;
}
