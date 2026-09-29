import { notFound } from "next/navigation";
import { MemberAgenda } from "./MemberAgenda";
import type { TaskRow } from "../../_components/types";
import { getOrCreateTenant } from "../../../../lib/tenant";
import { listTasks } from "../../../../lib/tools/task.tool";
import { resolveTaskAssignee } from "../../../../lib/integrations/handoff-task";
import { getTeamRoster } from "../../../../lib/reply/team-roster";

export const dynamic = "force-dynamic";

function contactLabel(
  contact: { email: string; name: string | null } | null
): string | null {
  if (!contact) return null;
  return contact.name || contact.email;
}

/** Local YYYY-MM-DD (server clock = the user's machine in this single-user app). */
function toDateInput(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * /planner/team/[memberId] — date-wise agenda for one routed teammate
 * (overdue, today, and upcoming tasks).
 */
export default async function MemberAgendaPage({
  params,
}: {
  params: { memberId: string };
}) {
   const roster = await getTeamRoster();

  const normalizedSlug = decodeURIComponent(params.memberId)
    .trim()
    .toLowerCase();

  const member = roster.find(
    (teamMember) =>
      teamMember.name.trim().toLowerCase() === normalizedSlug
  );
  if (!member) {
    notFound();
  }

  const routeTo = member.name;
  const tasks = await listTasks();

  const taskRows: TaskRow[] = tasks
    .map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDateLabel: t.dueDate ? t.dueDate.toLocaleDateString() : null,
      dueDateISO: t.dueDate ? toDateInput(t.dueDate) : null,
      contactLabel: contactLabel(t.contact),
      assignee: resolveTaskAssignee(t.assignee, t.title),
      sourceFrom: t.sourceFrom,
      sourceSubject: t.sourceSubject,
      sourceBody: t.sourceBody,
      createdAtISO: t.createdAt.toISOString(),
      updatedAtISO: t.updatedAt.toISOString(),
    }))
    .filter((t) => t.assignee && t.assignee.toLowerCase() === routeTo.toLowerCase());

  return (
    <MemberAgenda
      routeTo={member.name as any}
      name={member.name}
      email={member.email}
      tasks={taskRows}
    />
  );
}
