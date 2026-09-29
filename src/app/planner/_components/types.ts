/** Serializable row shapes shared by the planner page, panels, and forms. */

import type { TaskAuditEntry } from "../../../lib/repositories/task-audit";

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDateLabel: string | null;
  dueDateISO: string | null; // YYYY-MM-DD for the date input
  contactLabel: string | null;
  assignee: string | null;
  // Snapshot of the email that generated this task (null for manually-added tasks).
  sourceFrom: string | null;
  sourceSubject: string | null;
  sourceBody: string | null;
  createdAtISO: string; // for "newest first" ordering on the board
  updatedAtISO: string; // bumped on every edit → drives "updated task to top"
}

export interface TaskAuditRow {
  id: string;
  actorName: string;
  action: string;
  message: string;
  assignee: string | null;
  createdAtLabel: string;
}

export function toTaskAuditRow(entry: TaskAuditEntry): TaskAuditRow {
  return {
    id: entry.id,
    actorName: entry.actorName,
    action: entry.action,
    message: entry.message,
    assignee: entry.assignee,
    createdAtLabel: new Date(entry.createdAtISO).toLocaleString(),
  };
}

export interface MeetingRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startLabel: string;
  startISO: string; // YYYY-MM-DDTHH:mm for datetime-local
  endISO: string | null;
  attendees: string[];
  status: string;
  contactLabel: string | null;
}
