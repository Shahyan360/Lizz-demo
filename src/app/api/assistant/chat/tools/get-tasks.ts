import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { formatSpeakReply } from "../utils";

function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseTaskFields(rawTitle: string, assigneeProp?: string | null) {
  let title = rawTitle.trim();

  // Strip "Dave: " prefix if title starts with assignee name
  if (assigneeProp && title.toLowerCase().startsWith(`${assigneeProp.toLowerCase()}:`)) {
    title = title.slice(assigneeProp.length + 1).trim();
  }

  let mainTitle = title;
  let subject = "";

  // Extract subject from parenthetical if present e.g. "Proposal follow-up — Customer (Re: Question About Gate Controller LED)"
  const match = title.match(/^(.*?)\s*\((.*?)\)$/);
  if (match) {
    mainTitle = match[1].trim();
    subject = match[2].trim();
  }

  return { mainTitle, subject };
}

export async function handleGetTasks(
  args: { assignee?: string; status?: string; dateCategory?: string; startDate?: string; endDate?: string; isSummary?: boolean; limit?: number; offset?: number }
): Promise<NextResponse> {
  const { assignee, status, dateCategory, startDate, endDate, isSummary } = args;
  const pageLimit = args.limit || 10;
  const offset = args.offset || 0;

  const whereClause: any = {};
  if (status) {
    whereClause.status = status.toUpperCase();
  }
  // Filtered in the DB (assignee is indexed) rather than in JS after a capped
  // fetch, so assignee queries aren't silently missing older rows once the
  // workspace has more tasks than the fetch cap below.
  if (assignee && assignee.trim()) {
    whereClause.assignee = { contains: assignee.trim() };
  }

  // Fetch tasks
  const tasks = await prisma.task.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const now = new Date();
  const todayStr = toISODate(now);

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = toISODate(yesterdayDate);

  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = toISODate(tomorrowDate);

  // Filter tasks by dynamic startDate/endDate or dateCategory
  const filteredTasks = tasks.filter((t) => {
    const dueStr = t.dueDate ? toISODate(t.dueDate) : null;
    const createdStr = t.createdAt ? toISODate(t.createdAt) : null;
    const isDone = t.status === "DONE" || (t.status as string) === "COMPLETED";

    // Dynamic startDate / endDate filtering calculated by AI
    if (startDate || endDate) {
      const targetDate = dueStr || createdStr;
      if (!targetDate) return false;
      if (startDate && targetDate < startDate) return false;
      if (endDate && targetDate > endDate) return false;
      return true;
    }

    if (!dateCategory || dateCategory.toLowerCase() === "all") {
      return true;
    }

    const cat = dateCategory.toLowerCase();

    if (cat === "today") {
      return dueStr === todayStr || createdStr === todayStr;
    }

    if (cat === "yesterday") {
      return dueStr === yesterdayStr || createdStr === yesterdayStr;
    }

    if (cat === "tomorrow") {
      return dueStr === tomorrowStr;
    }

    if (cat === "overdue" || cat === "expired") {
      return !isDone && dueStr !== null && dueStr < todayStr;
    }

    if (cat === "future" || cat === "upcoming") {
      return !isDone && dueStr !== null && dueStr > todayStr;
    }

    if (cat === "completed" || cat === "done") {
      return isDone;
    }

    return true;
  });

  const categoryLabel = startDate && endDate
    ? ` (${startDate} to ${endDate})`
    : dateCategory && dateCategory.toLowerCase() !== "all"
    ? ` (${dateCategory.toUpperCase().replace("_", " ")})`
    : "";
  const personLabel = assignee ? ` for ${assignee}` : "";

  if (filteredTasks.length === 0) {
    let reply = `No tasks found${personLabel}${categoryLabel.toLowerCase()}.`;
    let speakReply = `No tasks found${personLabel}${categoryLabel.toLowerCase()}.`;

    if (dateCategory?.toLowerCase() === "today" || (startDate === todayStr && endDate === todayStr)) {
      const overdueCount = tasks.filter((t) => {
        const dueStr = t.dueDate ? toISODate(t.dueDate) : null;
        const isDone = t.status === "DONE" || (t.status as string) === "COMPLETED";
        return !isDone && dueStr !== null && dueStr < todayStr;
      }).length;

      reply = `${assignee || "The user"} has 0 tasks scheduled for today (${todayStr}).`;
      speakReply = `${assignee || "The user"} has no tasks scheduled for today.`;

      if (overdueCount > 0) {
        reply += `\n\n*Note: There are ${overdueCount} overdue/past tasks assigned.*`;
        speakReply += ` However, there are ${overdueCount} overdue tasks from previous days.`;
      }
    } else if (dateCategory?.toLowerCase() === "yesterday") {
      reply = `${assignee || "The user"} has 0 tasks recorded for yesterday (${yesterdayStr}).`;
      speakReply = `${assignee || "The user"} has no tasks recorded for yesterday.`;
    }

    return NextResponse.json({ reply, speakReply: formatSpeakReply(speakReply) });
  }

  const totalCount = filteredTasks.length;

  // Handle Executive Summary mode
  if (isSummary) {
    const assigneeMap: Record<string, { total: number; overdue: number; today: number; future: number; topTitles: string[] }> = {};
    let overdueTotal = 0;
    let todayTotal = 0;
    let futureTotal = 0;

    for (const t of filteredTasks) {
      const name = t.assignee ? t.assignee.trim() : "Unassigned";
      if (!assigneeMap[name]) {
        assigneeMap[name] = { total: 0, overdue: 0, today: 0, future: 0, topTitles: [] };
      }
      const entry = assigneeMap[name];
      entry.total++;

      const dueStr = t.dueDate ? toISODate(t.dueDate) : null;
      const isDone = t.status === "DONE" || (t.status as string) === "COMPLETED";

      if (!isDone && dueStr && dueStr < todayStr) {
        entry.overdue++;
        overdueTotal++;
      } else if (dueStr === todayStr) {
        entry.today++;
        todayTotal++;
      } else {
        entry.future++;
        futureTotal++;
      }

      const { mainTitle } = parseTaskFields(t.title, t.assignee);
      if (entry.topTitles.length < 2) {
        entry.topTitles.push(mainTitle);
      }
    }

    const assigneeSummaryLines = Object.entries(assigneeMap)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, stats]) => {
        const details = [];
        if (stats.overdue > 0) details.push(`${stats.overdue} overdue`);
        if (stats.today > 0) details.push(`${stats.today} due today`);
        if (stats.future > 0) details.push(`${stats.future} upcoming`);
        const detailStr = details.length > 0 ? ` (${details.join(", ")})` : "";
        const sampleStr = stats.topTitles.length > 0 ? ` — e.g., ${stats.topTitles.join(", ")}` : "";
        return `- **${name}**: ${stats.total} task${stats.total > 1 ? "s" : ""}${detailStr}${sampleStr}`;
      });

    const reply = `### Executive Task Summary (${totalCount} Total Tasks${categoryLabel})\n\n` +
      `**Team Member Breakdown**:\n` +
      assigneeSummaryLines.join("\n") +
      `\n\n**Timeline Overview**:\n` +
      `- 🚨 **Overdue**: ${overdueTotal} tasks\n` +
      `- 📅 **Due Today**: ${todayTotal} tasks\n` +
      `- 🔮 **Upcoming/Future**: ${futureTotal} tasks`;

    const topAssignee = Object.entries(assigneeMap).sort((a, b) => b[1].total - a[1].total)[0];
    const topAssigneeText = topAssignee ? `${topAssignee[0]} has the most with ${topAssignee[1].total} tasks.` : "";
    const speakReply = `Here is the executive summary of your team's ${totalCount} tasks. ${topAssigneeText} In total, ${overdueTotal} tasks are overdue, ${todayTotal} are due today, and ${futureTotal} are upcoming.`;

    return NextResponse.json({ reply, speakReply: formatSpeakReply(speakReply) });
  }

  const displayedTasks = filteredTasks.slice(offset, offset + pageLimit);

  if (displayedTasks.length === 0) {
    const reply = `No more tasks to show (total ${totalCount}).`;
    return NextResponse.json({ reply, speakReply: formatSpeakReply(reply) });
  }

  const taskBlocks = displayedTasks.map((t, i) => {
    const itemNumber = offset + i + 1;
    const { mainTitle, subject } = parseTaskFields(t.title, t.assignee);
    const assigneeStr = t.assignee || "Unassigned";
    const statusStr = t.status || "TODO";
    const dueStr = t.dueDate ? toISODate(t.dueDate) : "No due date";

    const lines = [`${itemNumber}. ${mainTitle}`];
    if (subject) {
      lines.push(`- Subject: ${subject}`);
    }
    lines.push(`- Status: ${statusStr}`);
    lines.push(`- Assignee: ${assigneeStr}`);
    lines.push(`- Due: ${dueStr}`);

    return lines.join("\n");
  });

  const startNum = offset + 1;
  const endNum = offset + displayedTasks.length;
  const isPaged = offset > 0 || totalCount > displayedTasks.length;
  const headerLabel = isPaged ? ` (${totalCount} found — showing ${startNum} to ${endNum})` : ` (${totalCount} found)`;

  let reply = `### Tasks${personLabel}${categoryLabel}${headerLabel}\n\n` + taskBlocks.join("\n\n---\n\n");
  const subjectPrefix = assignee ? `${assignee} has` : `There are`;
  let speakReply = `${subjectPrefix} ${totalCount} ${dateCategory ? dateCategory.toLowerCase().replace("_", " ") + " " : ""}tasks in total. Showing ${startNum} to ${endNum}.`;

  if (offset + displayedTasks.length < totalCount) {
    const remaining = totalCount - (offset + displayedTasks.length);
    reply += `\n\n---\n*Showing ${startNum}-${endNum} of ${totalCount} tasks. Would you like to see the remaining ${remaining} tasks?*`;
    speakReply += ` Would you like to see the remaining ${remaining}?`;
  } else if (offset > 0) {
    reply += `\n\n---\n*You have reached the end of the tasks list (${totalCount} total).*`;
  }

  return NextResponse.json({ reply, speakReply });
}
