"use client";

import { useState, useTransition } from "react";
import { ModalShell } from "../../planner/_components/ModalShell";
import { inputStyle, fieldLabel, primaryBtn, ghostBtn } from "../../planner/_components/planner-ui";
import { LIGHT } from "../../zoho/_components/ui";
import { createUserAction, updateUserAction } from "./actions";
import type { UserRow } from "./types";

/**
 * Create (initial = null) or edit a user. New users are invited by email — no
 * admin-chosen password. On edit the email is fixed and password is optional.
 */
export function UserFormModal({
  initial,
  isSelf,
  onClose,
  onDone,
}: {
  initial: UserRow | null;
  isSelf: boolean;
  onClose: () => void;
  onDone: (ok: boolean, message: string) => void;
}) {
  const editing = Boolean(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(initial?.role ?? "USER");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = initial
        ? await updateUserAction({
            id: initial.id,
            name,
            role,
            isActive,
            password: password || undefined,
          })
        : await createUserAction({ name, email, role });

      if (res.ok) {
        onDone(
          true,
          res.message ?? (editing ? "User updated." : "Invite sent.")
        );
        onClose();
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <ModalShell
      title={editing ? "Edit user" : "Invite user"}
      onClose={onClose}
      busy={pending}
      closeOnBackdrop={false}
    >
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
        <label style={fieldLabel}>
          Name
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name (optional)"
            style={inputStyle}
            autoFocus
          />
        </label>

        <label style={fieldLabel}>
          Email
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            style={{ ...inputStyle, opacity: editing ? 0.6 : 1 }}
            required={!editing}
            disabled={editing}
          />
          {editing ? (
            <span style={{ fontSize: "0.68rem", color: LIGHT.textMuted, fontWeight: 500 }}>
              Email is the login identity and can't be changed here.
            </span>
          ) : (
            <span style={{ fontSize: "0.68rem", color: LIGHT.textMuted, fontWeight: 500 }}>
              We'll email a link to set their password.
            </span>
          )}
        </label>

        {editing && (
          <label style={fieldLabel}>
            New password
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              style={inputStyle}
              autoComplete="new-password"
            />
          </label>
        )}

        <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
          <label style={{ ...fieldLabel, flex: 1, minWidth: 140 }}>
            Role
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRow["role"])}
              style={inputStyle}
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>

          {editing && (
            <label style={{ ...fieldLabel, flex: 1, minWidth: 140 }}>
              Status
              <select
                value={isActive ? "active" : "inactive"}
                onChange={(e) => setIsActive(e.target.value === "active")}
                style={inputStyle}
                disabled={isSelf}
              >
                <option value="active">Active</option>
                <option value="inactive">Deactivated</option>
              </select>
              {isSelf && (
                <span style={{ fontSize: "0.68rem", color: LIGHT.textMuted, fontWeight: 500 }}>
                  You can't deactivate your own account.
                </span>
              )}
            </label>
          )}
        </div>

        {error && (
          <div
            role="alert"
            style={{
              fontSize: "0.8rem",
              color: LIGHT.danger,
              background: LIGHT.dangerSoft,
              border: `1px solid ${LIGHT.danger}`,
              borderRadius: 8,
              padding: "0.5rem 0.7rem",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "0.2rem" }}>
          <button type="button" onClick={onClose} disabled={pending} style={ghostBtn}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            style={{ ...primaryBtn, opacity: pending ? 0.6 : 1 }}
          >
            {pending ? "Saving…" : editing ? "Save changes" : "Send invite"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
