export const TEAM_ROLE_DEFS = [
  {
    key: "owner_review",
    label: "Owner Review",
    description: "Complex, unusual, or high-value opportunities.",
  },
  {
    key: "proposal_reviewer",
    label: "Proposal Review",
    description: "Standard residential proposals, site visit reviews, follow-ups.",
  },
  {
    key: "scheduler",
    label: "Scheduling",
    description: "Scheduling and operations handoffs after approval.",
  },
  {
    key: "admin_handler",
    label: "Admin / CRM",
    description: "CRM, records, and admin follow-ups.",
  },
] as const;

export type TeamRoleKey = (typeof TEAM_ROLE_DEFS)[number]["key"];

export interface RoutingMember {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  isPrimary: boolean;
  isActive: boolean;
}

export function isTeamRoleKey(value: string): value is TeamRoleKey {
  return TEAM_ROLE_DEFS.some((r) => r.key === value);
}

export function roleLabelForKey(key: string): string {
  return TEAM_ROLE_DEFS.find((r) => r.key === key)?.label ?? key;
}

export function buildRoutingPromptBlock(members: RoutingMember[]): string {
  const lines = members
    .filter((m) => m.isActive)
    .map((m) => `- ${roleLabelForKey(m.roleKey)}: ${m.name}${m.isPrimary ? " (primary)" : ""}`);
  return [
    "Current routing roster:",
    ...lines,
    "",
    "Use only active primary names for routeTo unless the role has no primary and you need a manual fallback.",
  ].join("\n");
}

export function routeNamesFromMembers(members: RoutingMember[]): string[] {
  return members
    .filter((m) => m.isActive && m.isPrimary)
    .map((m) => m.name);
}
