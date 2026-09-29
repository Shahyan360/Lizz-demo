"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LIGHT } from "../../zoho/_components/ui";
import { useToast } from "../../_components/Toast";
import { useConfirm } from "../../_components/ConfirmDialog";
import { EditIcon, TrashIcon } from "../../_components/icons";
import { updateContact, deleteContact } from "../actions";

/**
 * The contact's name/email in the profile header, with inline Edit and Delete.
 * Editing swaps the display for a small form; Delete confirms, removes the
 * contact, and returns to the list. The avatar stays server-rendered and
 * refreshes with the new email on save.
 */
export function ContactEditor({
  contactId,
  initialName,
  initialEmail,
}: {
  contactId: string;
  initialName: string | null;
  initialEmail: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName ?? "");
  const [email, setEmail] = useState(initialEmail);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await updateContact(contactId, { name, email });
      if (!res.ok) {
        toast.error(res.error ?? "Could not save contact.");
        return;
      }
      toast.success("Contact updated.");
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setName(initialName ?? "");
    setEmail(initialEmail);
    setEditing(false);
  }

  async function remove() {
    const label = initialName || initialEmail;
    const ok = await confirm({
      title: "Delete contact",
      message: `Delete "${label}"? Their emails, tasks and meetings are kept but unlinked. This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      const res = await deleteContact(contactId);
      if (!res.ok) {
        toast.error(res.error ?? "Could not delete contact.");
        return;
      }
      toast.success("Contact deleted.");
      router.push("/contacts");
    });
  }

  if (editing) {
    return (
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          aria-label="Contact name"
          disabled={pending}
          style={inputStyle}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          aria-label="Contact email"
          type="email"
          disabled={pending}
          style={inputStyle}
        />
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.1rem" }}>
          <button type="button" onClick={save} disabled={pending} style={primaryBtn(pending)}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={cancel} disabled={pending} style={ghostBtn}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: LIGHT.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {initialName || "—"}
        </h1>
        <button type="button" onClick={() => setEditing(true)} title="Edit contact" aria-label="Edit contact" style={{ ...iconBtn, color: LIGHT.textSecondary }}>
          <EditIcon width={16} height={16} />
        </button>
        <button type="button" onClick={remove} disabled={pending} title="Delete contact" aria-label="Delete contact" style={{ ...iconBtn, color: LIGHT.danger }}>
          <TrashIcon width={16} height={16} />
        </button>
      </div>
      <a href={`mailto:${initialEmail}`} style={{ fontSize: "0.86rem", color: LIGHT.accent, textDecoration: "none" }}>
        {initialEmail}
      </a>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.45rem 0.6rem",
  fontSize: "0.9rem",
  color: LIGHT.text,
  background: LIGHT.panel,
  border: `1px solid ${LIGHT.borderStrong}`,
  borderRadius: 8,
  outline: "none",
};

const iconBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  lineHeight: 1,
  padding: "0.3rem",
  borderRadius: 6,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
};

function primaryBtn(pending: boolean): React.CSSProperties {
  return {
    padding: "0.4rem 0.9rem",
    fontSize: "0.82rem",
    fontWeight: 700,
    color: "#fff",
    background: LIGHT.accent,
    border: "none",
    borderRadius: 8,
    cursor: pending ? "default" : "pointer",
    opacity: pending ? 0.7 : 1,
  };
}

const ghostBtn: React.CSSProperties = {
  padding: "0.4rem 0.9rem",
  fontSize: "0.82rem",
  fontWeight: 600,
  color: LIGHT.textSecondary,
  background: LIGHT.panel,
  border: `1px solid ${LIGHT.border}`,
  borderRadius: 8,
  cursor: "pointer",
};
