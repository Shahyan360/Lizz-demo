import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { formatSpeakReply } from "../utils";

function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export async function handleGetTaskByTitle(
  args: { title: string }
): Promise<NextResponse> {
  const { title } = args;

  if (!title || !title.trim()) {
    const reply = "Please provide a task title or keyword to search for.";
    return NextResponse.json({ reply, speakReply: formatSpeakReply(reply) });
  }

  const searchTerm = title.trim().toLowerCase();

  // Fetch all tasks then filter JS-side (case-insensitive) — avoids Prisma mode:"insensitive" incompatibility
  const allTasks = await prisma.task.findMany({
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  const tasks = allTasks
    .filter((t) => t.title.toLowerCase().includes(searchTerm))
    .slice(0, 20);

  if (tasks.length === 0) {
    const reply = `No tasks found matching **"${searchTerm}"**. Try a different keyword or check the exact title.`;
    const speakReply = `No tasks found matching "${searchTerm}".`;
    return NextResponse.json({ reply, speakReply: formatSpeakReply(speakReply) });
  }

  const taskBlocks = tasks.map((t, i) => {
    const dueStr = t.dueDate ? toISODate(t.dueDate) : "No due date";
    const assigneeStr = t.assignee || "Unassigned";
    const statusStr = t.status || "TODO";

    const lines = [`${i + 1}. ${t.title}`];
    if (t.description) lines.push(`- Description: ${t.description}`);
    if (t.sourceSubject) lines.push(`- Subject: ${t.sourceSubject}`);
    lines.push(`- Status: ${statusStr}`);
    lines.push(`- Assignee: ${assigneeStr}`);
    lines.push(`- Due: ${dueStr}`);
    if (t.sourceFrom) lines.push(`- From: ${t.sourceFrom}`);

    return lines.join("\n");
  });

  const countLabel = tasks.length === 1 ? "1 task found" : `${tasks.length} tasks found`;
  const reply =
    `### Tasks matching "${searchTerm}" (${countLabel})\n\n` +
    taskBlocks.join("\n\n---\n\n");

  const speakReply =
    tasks.length === 1
      ? `Found 1 task matching "${searchTerm}": ${tasks[0].title}. Status: ${tasks[0].status || "TODO"}. Assigned to ${tasks[0].assignee || "nobody"}.`
      : `Found ${tasks.length} tasks matching "${searchTerm}". The first one is: ${tasks[0].title}.`;

  return NextResponse.json({ reply, speakReply: formatSpeakReply(speakReply) });
}
