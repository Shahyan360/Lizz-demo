import type { TaskPriority, TaskStatus } from "@prisma/client";
import type { RouteToTeammate } from "../reply/business-knowledge";
import { getTeamRoster } from "../reply/team-roster";
import { resolveTaskAssignee } from "../integrations/handoff-task";
import { listTasks, type TaskWithContact } from "../tools/task.tool";

export interface TeamTaskRow {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDateLabel: string | null;
  contactLabel: string | null;
  sourceSubject: string | null;
  assignee: RouteToTeammate | null;
  updatedAtISO: string;
}

export interface TeamMemberBoard {
  routeTo: RouteToTeammate;
  name: string;
  email: string;
  openCount: number;
  tasks: TeamTaskRow[];
}

function contactLabel(
  contact: { email: string; name: string | null } | null
): string | null {
  if (!contact) return null;
  return contact.name || contact.email;
}

function toTeamTaskRow(task: TaskWithContact): TeamTaskRow {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDateLabel: task.dueDate ? task.dueDate.toLocaleDateString() : null,
    contactLabel: contactLabel(task.contact),
    sourceSubject: task.sourceSubject,
    assignee: resolveTaskAssignee(task.assignee, task.title),
    updatedAtISO: task.updatedAt.toISOString(),
  };
}

/** Groups tasks by routed teammate for the /team page. */
export async function getTeamTaskBoards(): Promise<{
  members: TeamMemberBoard[];
  unassigned: TeamTaskRow[];
}> {
  const tasks = (await listTasks()).map(toTeamTaskRow);
  const members = await getTeamRoster();
  const unassigned: TeamTaskRow[] = [];

  const boards: TeamMemberBoard[] = members.map((member) => {
    const memberTasks = tasks.filter((t) => t.assignee === member.name);
    const openCount = memberTasks.filter(
      (t) => t.status === "TODO" || t.status === "IN_PROGRESS"
    ).length;
    return {
      routeTo: member.name,
      name: member.name,
      email: member.email,
      openCount,
      tasks: memberTasks,
    };
  });

  for (const task of tasks) {
    if (!task.assignee) unassigned.push(task);
  }

  return { members: boards, unassigned };
}
