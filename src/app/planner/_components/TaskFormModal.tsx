"use client";

import { useTransition } from "react";
import { ModalShell } from "./ModalShell";
import { addTaskAction, updateTaskAction } from "../actions";
import { inputStyle, fieldLabel, primaryBtn, ghostBtn } from "./planner-ui";
import { AssigneeSelect } from "./AssigneeSelect";
import type { TaskRow } from "./types";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED", "DECLINED"] as const;

const nice = (s: string) =>
  s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ");

/** Add (initial=null) or edit a task. Writes via server actions. */
export function TaskFormModal({
  initial,
  teamMembers = [],
  onClose,
  defaultAssignee = "",
}: {
  initial: TaskRow | null;
  teamMembers?: string[];
  onClose: () => void;
  /** Prefill assignee when creating (e.g. from a member agenda). */
  defaultAssignee?: string;
}) {
  const [pending, start] = useTransition();
  const editing = Boolean(initial);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      if (initial) await updateTaskAction(initial.id, fd);
      else await addTaskAction(fd);
      onClose();
    });
  }

  return (
    <ModalShell title={editing ? "Edit task" : "New task"} onClose={onClose} busy={pending}>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
        <label style={fieldLabel}>
          Title
          <input
            name="title"
            required
            autoFocus
            defaultValue={initial?.title ?? ""}
            placeholder="What needs doing?"
            style={inputStyle}
          />
        </label>

        <label style={fieldLabel}>
          Description
          <textarea
            name="description"
            rows={3}
            defaultValue={initial?.description ?? ""}
            placeholder="Optional details"
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>

        <AssigneeSelect defaultValue={initial?.assignee ?? ""} members={teamMembers} />

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <label style={{ ...fieldLabel, flex: 1, minWidth: 130 }}>
            Priority
            <select name="priority" defaultValue={initial?.priority ?? "MEDIUM"} style={inputStyle}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {nice(p)}
                </option>
              ))}
            </select>
          </label>

          <label style={{ ...fieldLabel, flex: 1, minWidth: 130 }}>
            Due date
            <input
              type="date"
              name="dueDate"
              defaultValue={initial?.dueDateISO ?? ""}
              style={inputStyle}
            />
          </label>

          {editing && (
            <label style={{ ...fieldLabel, flex: 1, minWidth: 130 }}>
              Status
              <select name="status" defaultValue={initial?.status ?? "TODO"} style={inputStyle}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {nice(s)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "0.4rem" }}>
          <button type="button" onClick={onClose} disabled={pending} style={ghostBtn}>
            Cancel
          </button>
          <button type="submit" disabled={pending} style={{ ...primaryBtn, opacity: pending ? 0.6 : 1 }}>
            {pending ? "Saving…" : editing ? "Save changes" : "Add task"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
