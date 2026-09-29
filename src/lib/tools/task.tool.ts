import type { Task, TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { ZohoService } from "../../services/zoho.service";
function zohoPriority(priority: TaskPriority): "high" | "medium" | "low" {
  if (priority === "URGENT" || priority === "HIGH") return "high";
  if (priority === "LOW") return "low";
  return "medium";
}

/** A Task with its linked sender contact (email/name) eager-loaded. */
export type TaskWithContact = Task & {
  contact: { email: string; name: string | null } | null;
};

/**
 * All tasks — most-recently-updated first, then soonest due. This
 * makes any task that was just updated bubble to the top of the list.
 */
export function listTasks(): Promise<TaskWithContact[]> {
  return prisma.task.findMany({
    orderBy: [{ updatedAt: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: { contact: { select: { email: true, name: true } } },
  });
}

export function getTaskById(id: string): Promise<Task | null> {
  return prisma.task.findUnique({ where: { id } });
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: Date | null;
  contactId?: string | null;
  threadId?: string | null;
  assignee?: string | null;
  sourceFrom?: string | null;
  sourceSubject?: string | null;
  sourceBody?: string | null;
}

const ZOHO_SOURCE_BODY_LIMIT = 1200;

function buildZohoTaskDescription(task: Task): string {
  const parts: string[] = [];
  if (task.description) parts.push(task.description);

  const src: string[] = [];
  if (task.sourceFrom) src.push(`From: ${task.sourceFrom}`);
  if (task.sourceSubject) src.push(`Subject: ${task.sourceSubject}`);
  if (task.sourceBody) {
    const body = task.sourceBody.trim().slice(0, ZOHO_SOURCE_BODY_LIMIT);
    const truncated = task.sourceBody.trim().length > ZOHO_SOURCE_BODY_LIMIT;
    src.push(`\n${body}${truncated ? "…" : ""}`);
  }
  if (src.length > 0) {
    parts.push(`──────────\nWhy this task (from the email):\n${src.join("\n")}`);
  }

  return parts.join("\n\n");
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const dueDate = input.dueDate ?? new Date();
  const priority = input.priority ?? "MEDIUM";

  let task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      priority,
      status: input.status ?? "TODO",
      dueDate,
      contactId: input.contactId ?? null,
      threadId: input.threadId ?? null,
      assignee: input.assignee ?? null,
      sourceFrom: input.sourceFrom ?? null,
      sourceSubject: input.sourceSubject ?? null,
      sourceBody: input.sourceBody ?? null,
    },
  });

  try {
    const zohoTaskId = await ZohoService.createTask({
      title: task.title,
      description: buildZohoTaskDescription(task),
      priority: zohoPriority(priority),
      dueDate,
      assignee: task.assignee,
    });
    if (zohoTaskId) {
      task = await prisma.task.update({
        where: { id: task.id },
        data: { zohoTaskId },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[task.tool] Zoho task sync failed for "${task.title}": ${message}`);
  }

  return task;
}

function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");
}

export async function upsertEmailTask(
  input: CreateTaskInput
): Promise<{ task: Task; created: boolean }> {
  const target = normalizeTitle(input.title);

  const open = await prisma.task.findMany({
    where: {
      contactId: input.contactId ?? null,
      status: { notIn: ["DONE", "CANCELLED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const existing = open.find((t) => normalizeTitle(t.title) === target);

  if (existing) {
    const task = await updateTask(existing.id, {
      description: input.description ?? existing.description,
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.dueDate ? { dueDate: input.dueDate } : {}),
      ...(input.assignee !== undefined ? { assignee: input.assignee } : {}),
    });
    return { task, created: false };
  }

  return { task: await createTask(input), created: true };
}

export async function setTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  const task = await prisma.task.update({
    where: { id },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });

  if (task.zohoTaskId) {
    try {
      await ZohoService.updateTask(task.zohoTaskId, {
        status: status === "DONE" ? "completed" : "open",
        completed: status === "DONE",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[task.tool] Zoho task status update failed for "${task.title}": ${message}`);
    }
  }

  return task;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: Date | null;
  assignee?: string | null;
}

export async function updateTask(
  id: string,
  data: UpdateTaskInput
): Promise<Task> {
  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
      ...(data.assignee !== undefined ? { assignee: data.assignee } : {}),
      ...(data.status !== undefined
        ? {
            status: data.status,
            completedAt: data.status === "DONE" ? new Date() : null,
          }
        : {}),
    },
  });

  if (task.zohoTaskId) {
    try {
      await ZohoService.updateTask(task.zohoTaskId, {
        title: task.title,
        description: buildZohoTaskDescription(task),
        priority: zohoPriority(task.priority),
        dueDate: task.dueDate,
        ...(data.status !== undefined
          ? {
              status: data.status === "DONE" ? "completed" : "open",
              completed: data.status === "DONE",
            }
          : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[task.tool] Zoho task update failed for "${task.title}": ${message}`);
    }
  }

  return task;
}

export function deleteTask(id: string): Promise<Task> {
  return prisma.task.delete({ where: { id } });
}

export function deleteTasks(ids: string[]): Promise<{ count: number }> {
  return prisma.task.deleteMany({ where: { id: { in: ids } } });
}
