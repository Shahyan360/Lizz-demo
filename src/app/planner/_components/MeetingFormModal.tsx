"use client";

import { useTransition } from "react";
import { ModalShell } from "./ModalShell";
import { addMeetingAction, updateMeetingAction } from "../actions";
import { inputStyle, fieldLabel, primaryBtn, ghostBtn } from "./planner-ui";
import type { MeetingRow } from "./types";

const STATUSES = ["SCHEDULED", "CONFIRMED", "CANCELLED", "COMPLETED"] as const;

const nice = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** Add (initial=null) or edit a meeting. Writes via server actions. */
export function MeetingFormModal({
  initial,
  onClose,
}: {
  initial: MeetingRow | null;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const editing = Boolean(initial);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      if (initial) await updateMeetingAction(initial.id, fd);
      else await addMeetingAction(fd);
      onClose();
    });
  }

  return (
    <ModalShell title={editing ? "Edit meeting" : "New meeting"} onClose={onClose} busy={pending}>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
        <label style={fieldLabel}>
          Title
          <input
            name="title"
            required
            autoFocus
            defaultValue={initial?.title ?? ""}
            placeholder="Meeting title"
            style={inputStyle}
          />
        </label>

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <label style={{ ...fieldLabel, flex: 1, minWidth: 160 }}>
            Starts
            <input
              type="datetime-local"
              name="startTime"
              required
              defaultValue={initial?.startISO ?? ""}
              style={inputStyle}
            />
          </label>
          <label style={{ ...fieldLabel, flex: 1, minWidth: 160 }}>
            Ends (optional)
            <input
              type="datetime-local"
              name="endTime"
              defaultValue={initial?.endISO ?? ""}
              style={inputStyle}
            />
          </label>
        </div>

        <label style={fieldLabel}>
          Location
          <input
            name="location"
            defaultValue={initial?.location ?? ""}
            placeholder="Address or video-call link"
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

        {editing && (
          <label style={{ ...fieldLabel, maxWidth: 200 }}>
            Status
            <select name="status" defaultValue={initial?.status ?? "SCHEDULED"} style={inputStyle}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {nice(s)}
                </option>
              ))}
            </select>
          </label>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "0.4rem" }}>
          <button type="button" onClick={onClose} disabled={pending} style={ghostBtn}>
            Cancel
          </button>
          <button type="submit" disabled={pending} style={{ ...primaryBtn, opacity: pending ? 0.6 : 1 }}>
            {pending ? "Saving…" : editing ? "Save changes" : "Add meeting"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
