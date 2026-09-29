"use client";

import { NavLink } from "../_components/NavLink";
import { useRouter } from "next/navigation";
import { useState, useTransition, type CSSProperties } from "react";
import { LIGHT, initials, avatarGradient } from "../zoho/_components/ui";
import { useToast } from "../_components/Toast";
import { useConfirm } from "../_components/ConfirmDialog";
import { EditIcon, TrashIcon } from "../_components/icons";
import { updateContact, deleteContact } from "./actions";

export interface ContactRow {
  id: string;
  name: string | null;
  email: string;
  lifecycleStage: string;
  interactionCount: number;
  lastContactLabel: string;
}

/**
 * The contacts list — a card-style list with sender avatars, stage pills, and
 * inline Edit / Delete on every row. Editing swaps a row's name/email for inputs;
 * Delete confirms then removes the contact. Both call server actions and refresh
 * the current (paginated) view in place.
 */
export function ContactsTable({ rows }: { rows: ContactRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();

  function beginEdit(row: ContactRow) {
    setEditingId(row.id);
    setName(row.name ?? "");
    setEmail(row.email);
  }

  function save(id: string) {
    start(async () => {
      const res = await updateContact(id, { name, email });
      if (!res.ok) {
        toast.error(res.error ?? "Could not save contact.");
        return;
      }
      toast.success("Contact updated.");
      setEditingId(null);
      router.refresh();
    });
  }

  async function remove(row: ContactRow) {
    const label = row.name || row.email;
    const ok = await confirm({
      title: "Delete contact",
      message: `Delete "${label}"? Their emails, tasks and meetings are kept but unlinked. This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      const res = await deleteContact(row.id);
      if (!res.ok) {
        toast.error(res.error ?? "Could not delete contact.");
        return;
      }
      toast.success("Contact deleted.");
      router.refresh();
    });
  }

  return (
    <div
      style={{
        background: LIGHT.panel,
        border: `1px solid ${LIGHT.border}`,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
      }}
    >
      {rows.map((c, i) => {
        const editing = editingId === c.id;
        return (
          <div
            key={c.id}
            className={editing ? undefined : "email-row"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.85rem",
              padding: "0.7rem 1rem",
              borderTop: i === 0 ? "none" : `1px solid ${LIGHT.border}`,
            }}
          >
            {/* Avatar */}
            <NavLink href={`/contacts/${c.id}`} style={{ textDecoration: "none", flexShrink: 0 }}>
              <span
                style={{
                  width: 40,
                  height: 40,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: avatarGradient(c.email),
                  color: "#fff",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {initials(c.name || c.email)}
              </span>
            </NavLink>

            {editing ? (
              <>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name"
                    aria-label="Name"
                    disabled={pending}
                    style={inputStyle}
                  />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    aria-label="Email"
                    type="email"
                    disabled={pending}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.3rem", flexShrink: 0 }}>
                  <button type="button" onClick={() => save(c.id)} disabled={pending} title="Save" style={{ ...pillBtn, color: "#fff", background: LIGHT.accent, borderColor: LIGHT.accent }}>
                    {pending ? "…" : "Save"}
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} disabled={pending} title="Cancel" style={pillBtn}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Name + email */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <NavLink
                    href={`/contacts/${c.id}`}
                    style={{ display: "block", fontSize: "0.92rem", fontWeight: 700, color: LIGHT.text, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {c.name || c.email}
                  </NavLink>
                  <NavLink
                    href={`/contacts/${c.id}`}
                    style={{ display: "block", fontSize: "0.78rem", color: LIGHT.textMuted, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {c.email}
                  </NavLink>
                </div>

                {/* Stage */}
                <span style={stageBadge(c.lifecycleStage)}>{stageLabel(c.lifecycleStage)}</span>

                {/* Meta */}
                <div style={{ width: 108, textAlign: "right", flexShrink: 0 }} className="contact-meta">
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, color: LIGHT.textSecondary }}>
                    {c.interactionCount} email{c.interactionCount === 1 ? "" : "s"}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: LIGHT.textMuted }}>{c.lastContactLabel}</div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "0.15rem", flexShrink: 0 }}>
                  <button type="button" onClick={() => beginEdit(c)} title="Edit contact" aria-label="Edit contact" style={{ ...iconBtn, color: LIGHT.textSecondary }}>
                    <EditIcon width={16} height={16} />
                  </button>
                  <button type="button" onClick={() => remove(c)} disabled={pending} title="Delete contact" aria-label="Delete contact" style={{ ...iconBtn, color: LIGHT.danger }}>
                    <TrashIcon width={16} height={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function stageLabel(stage: string): string {
  return stage === "NEW" ? "New" : stage === "ACTIVE" ? "Active" : "Customer";
}

function stageBadge(stage: string): CSSProperties {
  const map: Record<string, { bg: string; fg: string }> = {
    NEW: { bg: LIGHT.accentSoft, fg: LIGHT.accent },
    ACTIVE: { bg: "#fff2e0", fg: "#c2620e" },
    CUSTOMER: { bg: LIGHT.successSoft, fg: LIGHT.success },
  };
  const c = map[stage] ?? map.NEW;
  return {
    flexShrink: 0,
    fontSize: "0.66rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
    padding: "0.16rem 0.55rem",
    borderRadius: 999,
    background: c.bg,
    color: c.fg,
  };
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.35rem 0.55rem",
  fontSize: "0.82rem",
  color: LIGHT.text,
  background: LIGHT.panel,
  border: `1px solid ${LIGHT.borderStrong}`,
  borderRadius: 7,
  outline: "none",
  minWidth: 0,
};

const iconBtn: CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  lineHeight: 1,
  padding: "0.4rem",
  borderRadius: 7,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const pillBtn: CSSProperties = {
  padding: "0.35rem 0.7rem",
  fontSize: "0.78rem",
  fontWeight: 700,
  color: LIGHT.textSecondary,
  background: LIGHT.panel,
  border: `1px solid ${LIGHT.border}`,
  borderRadius: 8,
  cursor: "pointer",
};
