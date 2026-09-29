import { prisma } from "../prisma";
import type { RouteToTeammate } from "../reply/business-knowledge";

export type TaskAuditAction =
  | "CREATED"
  | "ASSIGNED"
  | "UNASSIGNED"
  | "REASSIGNED"
  | "NOTIFIED";

export interface TaskAuditEntry {
  id: string;
  actorName: string;
  action: string;
  message: string;
  assignee: string | null;
  createdAtISO: string;
}

export function assignmentMessage(
  actorName: string,
  assignee: string,
  taskTitle: string
): string {
  return `${actorName} assigned ${assignee} the task "${taskTitle}"`;
}

export function assigneeInboxMessage(
  actorName: string,
  taskTitle: string
): string {
  return `${actorName} assigned you the task "${taskTitle}"`;
}

export async function logTaskAudit(input: {
  taskId: string;
  actorId?: string | null;
  actorName: string;
  action: TaskAuditAction;
  message: string;
  assignee?: string | null;
}): Promise<void> {
  await prisma.taskAuditLog.create({
    data: {
      taskId: input.taskId,
      actorId: input.actorId ?? null,
      actorName: input.actorName,
      action: input.action,
      message: input.message,
      assignee: input.assignee ?? null,
    },
  });
}

export async function logTaskAssignment(input: {
  taskId: string;
  actorId?: string | null;
  actorName: string;
  assignee: RouteToTeammate;
  taskTitle: string;
  previousAssignee?: string | null;
}): Promise<void> {
  const action: TaskAuditAction = input.previousAssignee
    ? input.previousAssignee === input.assignee
      ? "ASSIGNED"
      : "REASSIGNED"
    : "ASSIGNED";

  const message =
    action === "REASSIGNED"
      ? `${input.actorName} reassigned the task "${input.taskTitle}" from ${input.previousAssignee} to ${input.assignee}`
      : assignmentMessage(input.actorName, input.assignee, input.taskTitle);

  await logTaskAudit({
    taskId: input.taskId,
    actorId: input.actorId,
    actorName: input.actorName,
    action,
    message,
    assignee: input.assignee,
  });
}

export async function listTaskAuditLogs(
  taskId: string
): Promise<TaskAuditEntry[]> {
  const rows = await prisma.taskAuditLog.findMany({
    where: { taskId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((row: (typeof rows)[number]) => ({
    id: row.id,
    actorName: row.actorName,
    action: row.action,
    message: row.message,
    assignee: row.assignee,
    createdAtISO: row.createdAt.toISOString(),
  }));
}
