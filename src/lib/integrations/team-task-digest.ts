import type { Task } from "@prisma/client";
import { ZohoService } from "../../services/zoho.service";
import { appBaseUrl } from "../auth/password-reset";
import {
  emailForRouteTo,
  memberAgendaPath,
  type RouteToTeammate,
} from "../reply/business-knowledge";

type DigestTask = Pick<Task, "title" | "priority" | "dueDate" | "status"> & {
  contact?: { email: string; name: string | null } | null;
};

type DailyDigestBuckets = {
  overdue: DigestTask[];
  dueToday: DigestTask[];
};

function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDueDate(date: Date | null): string {
  if (!date) return "No due date";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function plannerAgendaUrl(routeTo: RouteToTeammate): string {
  return `${appBaseUrl()}${memberAgendaPath(routeTo)}`;
}

function plainTextToHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const urlMatch = line.match(/^(Planner: )(https?:\/\/.+)$/);
      if (urlMatch) {
        return `<p>${escapeHtml(urlMatch[1])}<a href="${escapeHtml(urlMatch[2])}">${escapeHtml(urlMatch[2])}</a></p>`;
      }
      return `<p>${escapeHtml(line) || "&nbsp;"}</p>`;
    })
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isOpenTask(task: Pick<Task, "status">): boolean {
  return task.status === "TODO" || task.status === "IN_PROGRESS";
}

export function splitDailyDigestTasks(
  tasks: DigestTask[],
  now: Date = new Date()
): DailyDigestBuckets {
  const today = toLocalISODate(now);
  const openTasks = tasks.filter(isOpenTask);

  const overdue = openTasks
    .filter((task) => task.dueDate && toLocalISODate(task.dueDate) < today)
    .sort((a, b) => {
      const dueA = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const dueB = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return dueA - dueB;
    });

  const dueToday = openTasks
    .filter((task) => task.dueDate && toLocalISODate(task.dueDate) === today)
    .sort((a, b) => {
      const dueA = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const dueB = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return dueA - dueB;
    });

  return { overdue, dueToday };
}

function buildDigestLines(input: {
  routeTo: RouteToTeammate;
  tenantName: string;
  todayLabel: string;
  plannerUrl: string;
  overdue: DigestTask[];
  dueToday: DigestTask[];
}): string[] {
  const lines = [
    `Hi ${input.routeTo},`,
    "",
    `Here is your planner digest for ${input.todayLabel} in ${input.tenantName}.`,
    "",
  ];

  if (input.dueToday.length === 0 && input.overdue.length === 0) {
    lines.push(
      "Today's tasks: none due today.",
      "",
      "Delayed tasks: none overdue.",
      "",
      `Planner: ${input.plannerUrl}`,
      "",
      "- Lizzz"
    );
    return lines;
  }

  lines.push(`Today's tasks (${input.dueToday.length}):`);
  if (input.dueToday.length === 0) {
    lines.push("- None due today");
  } else {
    for (const task of input.dueToday) {
      const contactStr = task.contact?.email ? ` (Contact: ${task.contact.email})` : "";
      lines.push(
        `- ${task.title} [${task.priority}] (${task.status}) - due ${formatDueDate(task.dueDate)}${contactStr}`
      );
    }
  }

  lines.push("", `Delayed tasks (${input.overdue.length}):`);
  if (input.overdue.length === 0) {
    lines.push("- None overdue");
  } else {
    for (const task of input.overdue) {
      const contactStr = task.contact?.email ? ` (Contact: ${task.contact.email})` : "";
      lines.push(
        `- ${task.title} [${task.priority}] (${task.status}) - due ${formatDueDate(task.dueDate)}${contactStr}`
      );
    }
  }

  lines.push(
    "",
    "Open the planner to review or update these tasks:",
    `Planner: ${input.plannerUrl}`,
    "",
    "- Lizzz"
  );
  return lines;
}

export async function sendDailyTaskDigest(input: {
  routeTo: RouteToTeammate;
  tasks: DigestTask[];
  now?: Date;
}): Promise<string | null> {
  const toAddress = emailForRouteTo(input.routeTo);
  if (!toAddress) {
    console.warn(`[task-digest] No roster email for assignee "${input.routeTo}"`);
    return null;
  }

  const now = input.now ?? new Date();
  const todayLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const { overdue, dueToday } = splitDailyDigestTasks(input.tasks, now);
  const plannerUrl = plannerAgendaUrl(input.routeTo);
  const subject = `[Daily task digest] ${input.routeTo} - ${todayLabel}`.slice(0, 200);
  const content = plainTextToHtml(
    buildDigestLines({
      routeTo: input.routeTo,
      tenantName: "Primary Workspace",
      todayLabel,
      plannerUrl,
      overdue,
      dueToday,
    }).join("\n")
  );

  await ZohoService.sendEmail({
    toAddress,
    subject,
    content,
  });

  return toAddress;
}
