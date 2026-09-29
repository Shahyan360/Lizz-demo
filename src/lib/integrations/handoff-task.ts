import type { TaskPriority } from "@prisma/client";
import type { RouteToTeammate } from "../reply/business-knowledge";

const ASSIGNEE_TITLE_PREFIX = /^([^:]+):\s*/;

/** Infer assignee from legacy task titles like "Sarah: Schedule site visit — Pat". */
export function inferAssigneeFromTitle(title: string): RouteToTeammate | null {
  const match = title.match(ASSIGNEE_TITLE_PREFIX);
  if (!match) return null;
  const name = match[1];
  const normalized =
    name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  return normalized || null;
}

export function resolveTaskAssignee(
  assignee: string | null | undefined,
  title: string
): RouteToTeammate | null {
  if (assignee?.trim()) return assignee.trim();
  return inferAssigneeFromTitle(title);
}

const HANDOFF_FIELD = (field: string) =>
  new RegExp(`^${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(.+)$`, "m");

/** Reads a single `Field: value` line from an Evernote / handoff body. */
export function parseHandoffField(
  body: string,
  field: string
): string | null {
  return body.match(HANDOFF_FIELD(field))?.[1]?.trim() ?? null;
}

/** Maps Evernote handoff priority labels to Prisma TaskPriority. */
export function handoffPriorityToTaskPriority(
  priority: string | null | undefined
): TaskPriority {
  const p = (priority ?? "").trim().toLowerCase();
  if (p === "high") return "HIGH";
  if (p === "low") return "LOW";
  return "MEDIUM";
}

/** Builds a task title for a routed handoff. */
export function buildHandoffTaskTitle(input: {
  routeTo: RouteToTeammate;
  customerSubject: string;
  customerName?: string | null;
  handoffKind?: "proposal" | "scheduling" | "admin" | "decline";
}): string {
  const customer = input.customerName?.trim() || "Customer";
  const kindLabel =
    input.handoffKind === "scheduling"
      ? "Schedule follow-up"
      : input.handoffKind === "admin"
        ? "Admin follow-up"
        : input.handoffKind === "decline"
          ? "Declined opportunity review"
          : "Proposal follow-up";
  const subjectSnippet = input.customerSubject.trim().slice(0, 80);
  return `${input.routeTo}: ${kindLabel} — ${customer} (${subjectSnippet})`;
}
