"use server";

import { revalidatePath } from "next/cache";
import type {
  TaskPriority,
  TaskStatus,
  MeetingStatus,
} from "@prisma/client";
import {
  createTask,
  setTaskStatus,
  deleteTask,
  deleteTasks,
  updateTask,
  getTaskById,
} from "../../lib/tools/task.tool";
import {
  createMeeting,
  updateMeeting,
  deleteMeeting,
} from "../../lib/tools/meeting.tool";
import { requireUser } from "../../lib/auth/session";
import { isRouteToTeammate, type RouteToTeammate } from "../../lib/reply/business-knowledge";
import {
  getTeamRoster,
  isActiveTeamMember,
} from "../../lib/reply/team-roster";
import { sendTaskAssigneeNotify } from "../../lib/integrations/teammate-handoff-email";
import {
  listTaskAuditLogs,
  logTaskAssignment,
  logTaskAudit,
  type TaskAuditEntry,
} from "../../lib/repositories/task-audit";

/** Server actions backing the interactive Tasks & Meetings UI. */

function revalidatePlanner() {
  revalidatePath("/planner", "layout");
  revalidatePath("/team");
}

const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const TASK_STATUSES: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
  "DECLINED" as TaskStatus,
];
const MEETING_STATUSES: MeetingStatus[] = [
  "SCHEDULED",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
];

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function orNull(value: string): string | null {
  return value || null;
}
function priorityOf(fd: FormData): TaskPriority {
  const v = str(fd, "priority") as TaskPriority;
  return PRIORITIES.includes(v) ? v : "MEDIUM";
}
function taskStatusOf(fd: FormData): TaskStatus {
  const v = str(fd, "status") as TaskStatus;
  return TASK_STATUSES.includes(v) ? v : "TODO";
}
function meetingStatusOf(fd: FormData): MeetingStatus {
  const v = str(fd, "status") as MeetingStatus;
  return MEETING_STATUSES.includes(v) ? v : "SCHEDULED";
}

async function assigneeOf(fd: FormData): Promise<RouteToTeammate | null> {
  const v = str(fd, "assignee");
  if (!v) {
    return null;
  }
  return (await isActiveTeamMember(v)) ? v : null;
}

function actorLabel(user: { name?: string | null; email?: string | null }): string {
  return user.name?.trim() || user.email?.trim() || "Someone";
}

async function applyAssigneeChange(input: {
  taskId: string;
  previousAssignee: string | null;
  nextAssignee: RouteToTeammate | null;
  taskTitle: string;
  actorId: string;
  actorName: string;
}): Promise<void> {
  if (input.nextAssignee === input.previousAssignee) return;

  if (input.nextAssignee) {
    await logTaskAssignment({
      taskId: input.taskId,
      actorId: input.actorId,
      actorName: input.actorName,
      assignee: input.nextAssignee,
      taskTitle: input.taskTitle,
      previousAssignee: input.previousAssignee,
    });
    return;
  }

  if (input.previousAssignee) {
    await logTaskAudit({
      taskId: input.taskId,
      actorId: input.actorId,
      actorName: input.actorName,
      action: "UNASSIGNED",
      message: `${input.actorName} unassigned ${input.previousAssignee} from the task "${input.taskTitle}"`,
      assignee: null,
    });
  }
}

/* ─── Tasks ──────────────────────────────────────────────────── */

export async function addTaskAction(formData: FormData): Promise<void> {
  const title = str(formData, "title");
  if (!title) return;
  const dueRaw = str(formData, "dueDate");
  const user = await requireUser();
  const assignee = await assigneeOf(formData);
  const actorName = actorLabel(user);

  const task = await createTask({
    title,
    description: orNull(str(formData, "description")),
    priority: priorityOf(formData),
    dueDate: dueRaw ? new Date(dueRaw) : null,
    assignee,
  });

  if (assignee) {
    await logTaskAssignment({
      taskId: task.id,
      actorId: user.id,
      actorName,
      assignee,
      taskTitle: task.title,
    });
  } else {
    await logTaskAudit({
      taskId: task.id,
      actorId: user.id,
      actorName,
      action: "CREATED",
      message: `${actorName} created the task "${task.title}"`,
    });
  }

  revalidatePlanner();
}

export async function updateTaskAction(
  id: string,
  formData: FormData
): Promise<void> {
  const title = str(formData, "title");
  if (!title) return;
  const dueRaw = str(formData, "dueDate");
  const user = await requireUser();
  const nextAssignee = await assigneeOf(formData);
  const existing = await getTaskById(id);
  if (!existing) return;

  await updateTask(id, {
    title,
    description: orNull(str(formData, "description")),
    priority: priorityOf(formData),
    status: taskStatusOf(formData),
    dueDate: dueRaw ? new Date(dueRaw) : null,
    assignee: nextAssignee,
  });

  await applyAssigneeChange({
    taskId: id,
    previousAssignee: existing.assignee,
    nextAssignee,
    taskTitle: title,
    actorId: user.id,
    actorName: actorLabel(user),
  });

  revalidatePlanner();
}

export async function assignTaskAction(
  taskId: string,
  assignee: string
): Promise<void> {
  const user = await requireUser();
  const existing = await getTaskById(taskId);
  if (!existing) return;

  const nextAssignee = (await isActiveTeamMember(assignee)) ? assignee : null;
  if (nextAssignee === existing.assignee) return;

  await updateTask(taskId, { assignee: nextAssignee });

  await applyAssigneeChange({
    taskId,
    previousAssignee: existing.assignee,
    nextAssignee,
    taskTitle: existing.title,
    actorId: user.id,
    actorName: actorLabel(user),
  });

  revalidatePlanner();
}

export async function notifyAssigneeAction(
  taskId: string
): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const existing = await getTaskById(taskId);
  if (!existing) return { ok: false, message: "Task not found." };

  if (!existing.assignee || !isRouteToTeammate(existing.assignee)) {
    return { ok: false, message: "Assign the task to a team member first." };
  }

  const dueDateLabel = existing.dueDate
    ? existing.dueDate.toLocaleDateString()
    : null;

  try {
    const sentTo = await sendTaskAssigneeNotify({
      assignee: existing.assignee,
      taskTitle: existing.title,
      description: existing.description,
      priority: existing.priority,
      dueDateLabel,
      contactLabel: null,
      sourceSubject: existing.sourceSubject,
      actorName: actorLabel(user),
    });

    if (!sentTo) {
      return {
        ok: false,
        message: `No email address found for ${existing.assignee}.`,
      };
    }

    await logTaskAudit({
      taskId: existing.id,
      actorId: user.id,
      actorName: actorLabel(user),
      action: "NOTIFIED",
      message: `${actorLabel(user)} notified ${existing.assignee} (${sentTo}) about "${existing.title}"`,
      assignee: existing.assignee,
    });

    return { ok: true, message: `Notified ${existing.assignee} at ${sentTo}.` };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[notifyAssigneeAction] failed:", detail);
    return { ok: false, message: `Could not send notification: ${detail}` };
  }
}

export async function getTaskAuditLogsAction(
  taskId: string
): Promise<TaskAuditEntry[]> {
  return listTaskAuditLogs(taskId);
}

export async function getAssigneeOptionsAction(): Promise<string[]> {
  const roster = await getTeamRoster();
  return roster.map((member) => member.name);
}

export async function toggleTaskDoneAction(
  id: string,
  done: boolean
): Promise<void> {
  await setTaskStatus(id, done ? "DONE" : "TODO");
  revalidatePlanner();
}

export async function setTaskStatusAction(
  id: string,
  status: string
): Promise<void> {
  const next = TASK_STATUSES.includes(status as TaskStatus)
    ? (status as TaskStatus)
    : "TODO";
  await setTaskStatus(id, next);
  revalidatePlanner();
}

export async function deleteTaskAction(id: string): Promise<void> {
  await deleteTask(id);
  revalidatePlanner();
}

export async function deleteTasksAction(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await deleteTasks(ids);
  revalidatePlanner();
}

/* ─── Meetings ───────────────────────────────────────────────── */

export async function addMeetingAction(formData: FormData): Promise<void> {
  const title = str(formData, "title");
  const startRaw = str(formData, "startTime");
  if (!title || !startRaw) return;
  const endRaw = str(formData, "endTime");
  await createMeeting({
    title,
    startTime: new Date(startRaw),
    endTime: endRaw ? new Date(endRaw) : null,
    location: orNull(str(formData, "location")),
    description: orNull(str(formData, "description")),
  });
  revalidatePlanner();
}

export async function updateMeetingAction(
  id: string,
  formData: FormData
): Promise<void> {
  const title = str(formData, "title");
  const startRaw = str(formData, "startTime");
  if (!title || !startRaw) return;
  const endRaw = str(formData, "endTime");
  await updateMeeting(id, {
    title,
    startTime: new Date(startRaw),
    endTime: endRaw ? new Date(endRaw) : null,
    location: orNull(str(formData, "location")),
    description: orNull(str(formData, "description")),
    status: meetingStatusOf(formData),
  });
  revalidatePlanner();
}

export async function setMeetingStatusAction(
  id: string,
  status: string
): Promise<void> {
  const next = MEETING_STATUSES.includes(status as MeetingStatus)
    ? (status as MeetingStatus)
    : "SCHEDULED";
  await updateMeeting(id, { status: next });
  revalidatePlanner();
}

export async function deleteMeetingAction(id: string): Promise<void> {
  await deleteMeeting(id);
  revalidatePlanner();
}
