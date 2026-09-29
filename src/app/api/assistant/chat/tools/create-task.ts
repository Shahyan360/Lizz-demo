import { NextResponse } from "next/server";
import { createTask } from "../../../../../lib/tools/task.tool";

export async function handleCreateTask(
  args: any
): Promise<NextResponse | null> {
  const title = args.title?.trim();
  if (!title) return null;

  const priority = args.priority || "MEDIUM";
  let parsedDueDate: Date | undefined = undefined;
  if (args.dueDate) {
    const d = new Date(args.dueDate);
    if (!isNaN(d.getTime())) parsedDueDate = d;
  }

  await createTask({
    title,
    priority,
    dueDate: parsedDueDate,
  });

  const dueDateDisplay = parsedDueDate ? ` for ${parsedDueDate.toISOString().slice(0, 10)}` : "";
  const reply = `✅ Task **"${title}"** has been created with priority **${priority}**${dueDateDisplay}!`;
  const speakReply = `Task ${title} has been created with ${priority} priority.`;
  return NextResponse.json({ reply, speakReply });
}
