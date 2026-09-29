import type { TeamRoleKey } from "../../../lib/reply/team-routing";

export interface TeamMemberRow {
  id: string;
  name: string;
  email: string;
  roleKey: TeamRoleKey;
  roleLabel: string;
  isPrimary: boolean;
  isActive: boolean;
  notes: string | null;
  createdAtLabel: string;
  updatedAtLabel: string;
}

export interface TeamRoleOption {
  key: TeamRoleKey;
  label: string;
  description: string;
}