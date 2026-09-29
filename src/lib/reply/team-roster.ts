import {
  listActiveTeamMembers,
  listPrimaryTeamMembers,
} from "../repositories/team-members";

export interface Teammate {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  isPrimary: boolean;
  isActive: boolean;
}

const ROSTER_TTL_MS = 10 * 60 * 1000;

type CacheEntry = {
  at: number;
  active: Teammate[];
  primary: Teammate[];
};

let cachedRoster: CacheEntry | null = null;

export function clearTeamRosterCache(): void {
  cachedRoster = null;
}

async function loadRoster(): Promise<CacheEntry> {
  if (cachedRoster && Date.now() - cachedRoster.at < ROSTER_TTL_MS) {
    return cachedRoster;
  }

  const [activeRows, primaryRows] = await Promise.all([
    listActiveTeamMembers(),
    listPrimaryTeamMembers(),
  ]);

  const active = activeRows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email.toLowerCase(),
    roleKey: row.roleKey,
    isPrimary: row.isPrimary,
    isActive: row.isActive,
  }));

  const primary = primaryRows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email.toLowerCase(),
    roleKey: row.roleKey,
    isPrimary: row.isPrimary,
    isActive: row.isActive,
  }));

  cachedRoster = { at: Date.now(), active, primary };
  return cachedRoster;
}

export async function getTeamRoster(): Promise<Teammate[]> {
  return (await loadRoster()).active;
}

export async function getTeamNames(): Promise<string[]> {
  const { active, primary } = await loadRoster();
  const routeTargets = primary.length > 0 ? primary : active;
  return routeTargets.map((t) => t.name);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nameMatches(rosterName: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  const full = rosterName.trim().toLowerCase();
  const first = full.split(/\s+/)[0] ?? full;
  return full === q || first === q;
}

async function mentionedTeammateEmails(
  replyText: string
): Promise<string[]> {
  const roster = await getTeamRoster();
  const found = new Set<string>();

  for (const t of roster) {
    const first = t.name.split(/\s+/)[0] ?? t.name;
    const re = new RegExp(
      `@(${escapeRegExp(t.name)}|${escapeRegExp(first)})\\b`,
      "i"
    );
    if (re.test(replyText)) {
      found.add(t.email);
    }
  }

  return [...found];
}

export async function teammateEmailsByNames(
  names: string[]
): Promise<string[]> {
  const roster = await getTeamRoster();
  const found = new Set<string>();

  for (const name of names) {
    const match = roster.find((t) => nameMatches(t.name, name));
    if (match) found.add(match.email);
  }

  return [...found];
}

export async function buildReplyCcEmails(
  replyText: string,
  extraTeammateNames: string[] = []
): Promise<string[]> {
  const [fromMentions, fromNames] = await Promise.all([
    mentionedTeammateEmails(replyText),
    teammateEmailsByNames(extraTeammateNames),
  ]);

  return [...new Set([...fromMentions, ...fromNames])];
}

export async function isActiveRouteTarget(
  routeTo: string
): Promise<boolean> {
  const target = routeTo.trim().toLowerCase();
  if (!target) return false;
  return (await getTeamNames()).some(
    (name) => name.trim().toLowerCase() === target
  );
}

export async function isActiveTeamMember(
  name: string
): Promise<boolean> {
  const target = name.trim().toLowerCase();

  if (!target) {
    return false;
  }

  const roster = await getTeamRoster();

  return roster.some(
    (member) =>
      member.name.trim().toLowerCase() === target
  );
}

export async function getPrimaryTeamMemberForRole(
  roleKey: string
): Promise<Teammate | null> {
  const { active, primary } = await loadRoster();
  return (
    primary.find((member) => member.roleKey === roleKey) ??
    active.find((member) => member.roleKey === roleKey) ??
    null
  );
}
