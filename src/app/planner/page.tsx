import { PlannerView } from "./_components/PlannerView";
import type { TaskRow, MeetingRow } from "./_components/types";
import { getOrCreateTenant } from "../../lib/tenant";
import { listTasks } from "../../lib/tools/task.tool";
import { listMeetings } from "../../lib/tools/meeting.tool";
import { jsonStringArray } from "../../lib/json-array";
import { resolveTaskAssignee } from "../../lib/integrations/handoff-task";
import { getTeamRoster } from "../../lib/reply/team-roster";

/**
 * /planner — the Tasks & Meetings screen. Loads both lists from the DB, maps
 * them to serializable rows (including ISO values for the edit forms), and hands
 * them to the interactive client shell.
 */
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

/** Local YYYY-MM-DDTHH:mm for datetime-local inputs. */
function toDateTimeLocal(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${toDateInput(d)}T${h}:${min}`;
}

export default async function PlannerPage() {
  const [tasks, meetings, roster] = await Promise.all([
    listTasks(),
    listMeetings(),
    getTeamRoster(),
  ]);
  const teamMembers = roster.map((member) => member.name);
  
  const taskRows: TaskRow[] = tasks.map((t) => ({
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
  }));

  const meetingRows: MeetingRow[] = meetings.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    location: m.location,
    startLabel: m.startTime.toLocaleString(),
    startISO: toDateTimeLocal(m.startTime),
    endISO: m.endTime ? toDateTimeLocal(m.endTime) : null,
    attendees: jsonStringArray(m.attendees),
    status: m.status,
    contactLabel: contactLabel(m.contact),
  }));

  return <PlannerView tasks={taskRows} meetings={meetingRows} teamMembers={teamMembers} />;
}
