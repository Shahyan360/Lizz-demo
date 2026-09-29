"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type CSSProperties } from "react";
import { LIGHT } from "../zoho/_components/ui";
import { useToast } from "../_components/Toast";
import { ModalShell } from "../planner/_components/ModalShell";
import { inputStyle, fieldLabel, primaryBtn, ghostBtn } from "../planner/_components/planner-ui";
import { PlusIcon } from "../_components/icons";
import { createContact } from "./actions";

const STAGES = [
  { value: "NEW", label: "New lead" },
  { value: "ACTIVE", label: "Active" },
  { value: "CUSTOMER", label: "Customer" },
];

/** "Add contact" button that opens a modal to create a contact manually. */
export function AddContactButton() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState("NEW");
  const [pending, start] = useTransition();

  function reset() {
    setName("");
    setEmail("");
    setStage("NEW");
  }

  function close() {
    if (pending) return;
    setOpen(false);
    reset();
  }

  function submit() {
    start(async () => {
      const res = await createContact({ name, email, stage });
      if (!res.ok) {
        toast.error(res.error ?? "Could not add contact.");
        return;
      }
      toast.success("Contact added.");
      setOpen(false);
      reset();
      if (res.id) router.push(`/contacts/${res.id}`);
      else router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={addBtn}>
        <PlusIcon width={16} height={16} />
        Add contact
      </button>

      {open && (
        <ModalShell
          title="Add contact"
          onClose={close}
          busy={pending}
          closeOnBackdrop={false}
          footer={
            <>
              <button type="button" onClick={close} disabled={pending} style={ghostBtn}>
                Cancel
              </button>
              <button type="button" onClick={submit} disabled={pending} style={primaryBtn}>
                {pending ? "Adding…" : "Add contact"}
              </button>
            </>
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}
          >
            <div>
              <label style={fieldLabel}>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                autoFocus
                disabled={pending}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={fieldLabel}>
                Email <span style={{ color: LIGHT.danger }}>*</span>
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@company.com"
                type="email"
                disabled={pending}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={fieldLabel}>Lifecycle stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                disabled={pending}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                {STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Hidden submit so Enter submits the form. */}
            <button type="submit" style={{ display: "none" }} aria-hidden />
          </form>
        </ModalShell>
      )}
    </>
  );
}

const addBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  padding: "0.5rem 0.9rem",
  fontSize: "0.85rem",
  fontWeight: 700,
  color: "#fff",
  background: LIGHT.accent,
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
