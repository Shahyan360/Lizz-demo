"use client";

import { useState, useTransition } from "react";
import { LIGHT } from "../../zoho/_components/ui";
import { useToast } from "../../_components/Toast";
import { saveContactNotes } from "../actions";

/** Editable freeform notes for a contact (CRM-style). Saves via server action. */
export function ContactNotes({
  contactId,
  initialNotes,
}: {
  contactId: string;
  initialNotes: string;
}) {
  const toast = useToast();
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(initialNotes);
  const [pending, start] = useTransition();
  const dirty = notes !== saved;

  function save() {
    start(async () => {
      const res = await saveContactNotes(contactId, notes);
      if (res.ok) {
        setSaved(notes);
        toast.success("Notes saved.");
      } else {
        toast.error(res.error ?? "Could not save notes.");
      }
    });
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.5rem",
        }}
      >
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: LIGHT.textMuted,
          }}
        >
          Notes
        </span>
        {dirty && (
          <button
            type="button"
            onClick={save}
            disabled={pending}
            style={{
              border: "none",
              background: LIGHT.accent,
              color: "#fff",
              fontSize: "0.76rem",
              fontWeight: 700,
              padding: "0.3rem 0.75rem",
              borderRadius: 7,
              cursor: pending ? "default" : "pointer",
              opacity: pending ? 0.6 : 1,
            }}
          >
            {pending ? "Saving…" : "Save"}
          </button>
        )}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes about this contact — preferences, account details, anything the team should know…"
        rows={4}
        style={{
          width: "100%",
          resize: "vertical",
          padding: "0.7rem 0.8rem",
          borderRadius: 10,
          border: `1px solid ${LIGHT.borderStrong}`,
          background: "#fff",
          color: LIGHT.text,
          fontSize: "0.88rem",
          lineHeight: 1.5,
          fontFamily: "inherit",
          outline: "none",
        }}
      />
    </div>
  );
}
