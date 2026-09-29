"use client";

import { LIGHT } from "../../zoho/_components/ui";
import { ModalShell } from "./ModalShell";
import type { TaskRow } from "./types";

/**
 * Shows the source email a task was extracted from — the "why was this task
 * created?" view. Reads the snapshot stored on the task (sourceFrom / subject /
 * body); rendered only when that snapshot exists.
 */
export function TaskEmailModal({
  task,
  onClose,
}: {
  task: TaskRow;
  onClose: () => void;
}) {
  return (
    <ModalShell title="Source email" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <div
          style={{
            fontSize: "0.82rem",
            color: LIGHT.textSecondary,
            background: LIGHT.panelAlt,
            border: `1px solid ${LIGHT.border}`,
            borderRadius: 10,
            padding: "0.6rem 0.75rem",
          }}
        >
          This task was created from the email below.
        </div>

        <Field label="From">
          <span style={{ fontSize: "0.9rem", color: LIGHT.text }}>
            {task.sourceFrom || "—"}
          </span>
        </Field>

        <Field label="Subject">
          <span style={{ fontSize: "0.9rem", color: LIGHT.text }}>
            {task.sourceSubject || "(no subject)"}
          </span>
        </Field>

        <Field label="Message">
          <div
            style={{
              fontSize: "0.88rem",
              color: LIGHT.text,
              whiteSpace: "pre-wrap",
              lineHeight: 1.5,
              maxHeight: "45vh",
              overflow: "auto",
              background: "#fff",
              border: `1px solid ${LIGHT.border}`,
              borderRadius: 10,
              padding: "0.75rem 0.85rem",
            }}
          >
            {task.sourceBody || "No email body was captured for this task."}
          </div>
        </Field>
      </div>
    </ModalShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: LIGHT.textMuted,
          marginBottom: "0.3rem",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
