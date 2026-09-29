"use client";

import { useState, useTransition } from "react";
import { ModalShell } from "../../planner/_components/ModalShell";
import { inputStyle, fieldLabel, primaryBtn, ghostBtn } from "../../planner/_components/planner-ui";
import { LIGHT } from "../../zoho/_components/ui";
import {
  createTeamMemberAction,
  updateTeamMemberAction,
} from "./actions";
import type { TeamRoleKey } from "../../../lib/reply/team-routing";
import type { TeamMemberRow, TeamRoleOption } from "./types";

export function TeamMemberFormModal({
  initial,
  roleOptions,
  onClose,
  onDone,
}: {
  initial: TeamMemberRow | null;
  roleOptions: TeamRoleOption[];
  onClose: () => void;
  onDone: (ok: boolean, message: string) => void;
}) {
  const editing = Boolean(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [roleKey, setRoleKey] = useState<TeamRoleKey>(
    initial?.roleKey ?? roleOptions[0]?.key ?? "proposal_reviewer"
  );
  const [isPrimary, setIsPrimary] = useState(initial?.isPrimary ?? true);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    start(async () => {
      const res = initial
        ? await updateTeamMemberAction({
            id: initial.id,
            name,
            email,
            roleKey,
            isPrimary,
            isActive,
            notes,
          })
        : await createTeamMemberAction({
            name,
            email,
            roleKey,
            isPrimary,
            isActive,
            notes,
          });

      if (res.ok) {
        onDone(true, res.message ?? (editing ? "Member updated." : "Member added."));
        onClose();
      } else {
        setError(res.error ?? "Something went wrong.");
        onDone(false, res.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <ModalShell
      title={editing ? "Edit team member" : "Add team member"}
      onClose={onClose}
      busy={pending}
      closeOnBackdrop={false}
    >
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
        <label style={fieldLabel}>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} required />
        </label>

        <label style={fieldLabel}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            required
          />
        </label>

        <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
          <label style={{ ...fieldLabel, flex: 1, minWidth: 180 }}>
            Role
            <select
              value={roleKey}
              onChange={(e) => setRoleKey(e.target.value as TeamRoleKey)}
              style={inputStyle}
            >
              {roleOptions.map((role) => (
                <option key={role.key} value={role.key}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ ...fieldLabel, flex: 1, minWidth: 180 }}>
            Status
            <select
              value={isActive ? "active" : "inactive"}
              onChange={(e) => setIsActive(e.target.value === "active")}
              style={inputStyle}
            >
              <option value="active">Active</option>
              <option value="inactive">Archived</option>
            </select>
          </label>
        </div>

        <label style={fieldLabel}>
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
            placeholder="Internal notes"
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: "0.55rem", fontSize: "0.88rem", color: LIGHT.text }}>
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
          Primary routing target for this role
        </label>

        {error && (
          <div style={{ color: LIGHT.danger, fontSize: "0.82rem" }}>{error}</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
          <button type="button" onClick={onClose} disabled={pending} style={ghostBtn}>
            Cancel
          </button>
          <button type="submit" disabled={pending} style={{ ...primaryBtn, opacity: pending ? 0.7 : 1 }}>
            {pending ? "Saving…" : editing ? "Save changes" : "Add member"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
