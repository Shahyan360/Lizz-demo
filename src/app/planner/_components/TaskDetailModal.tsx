"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { LIGHT } from "../../zoho/_components/ui";
import { useConfirm } from "../../_components/ConfirmDialog";
import { ModalShell } from "./ModalShell";
import {
  deleteTaskAction,
  getTaskAuditLogsAction,
  toggleTaskDoneAction,
} from "../actions";
import { priorityBadge, statusChip, ghostBtn, primaryBtn } from "./planner-ui";
import { TrashIcon, EditIcon } from "./icons";
import type { TaskAuditRow, TaskRow } from "./types";
import { toTaskAuditRow } from "./types";

/** Read-only detail view for a task, with quick actions (edit / delete / done). */
export function TaskDetailModal({
  task,
  onClose,
  onEdit,
}: {
  task: TaskRow;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [pending, start] = useTransition();
  const [auditLogs, setAuditLogs] = useState<TaskAuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const confirm = useConfirm();
  const done = task.status === "DONE";

  useEffect(() => {
    let cancelled = false;
    setAuditLoading(true);
    getTaskAuditLogsAction(task.id)
      .then((entries) => {
        if (!cancelled) setAuditLogs(entries.map(toTaskAuditRow));
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  return (
    <ModalShell
      title="Task details"
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: "Delete task",
                message: `Delete "${task.title}"? This can't be undone.`,
                confirmLabel: "Delete",
                danger: true,
              });
              if (!ok) return;
              start(async () => {
                await deleteTaskAction(task.id);
                onClose();
              });
            }}
            disabled={pending}
            style={{ ...ghostBtn, color: LIGHT.danger, borderColor: "#f3c2c2" }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <TrashIcon /> Delete
            </span>
          </button>
          <button
            type="button"
            onClick={() =>
              start(() => void toggleTaskDoneAction(task.id, !done))
            }
            disabled={pending}
            style={ghostBtn}
          >
            {done ? "Mark as to-do" : "Mark as done"}
          </button>
          <button type="button" onClick={onEdit} disabled={pending} style={primaryBtn}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <EditIcon /> Edit
            </span>
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              color: done ? LIGHT.textMuted : LIGHT.text,
              textDecoration: done ? "line-through" : "none",
            }}
          >
            {task.title}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <span style={priorityBadge(task.priority)}>{task.priority}</span>
            <span style={statusChip(task.status)}>{task.status.replace("_", " ")}</span>
            {task.assignee ? (
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: "#4338ca",
                  background: "#eef2ff",
                  padding: "0.15rem 0.45rem",
                  borderRadius: 999,
                }}
              >
                {task.assignee}
              </span>
            ) : null}
          </div>
        </div>

        {task.description && (
          <Field label="Description">
            <p style={{ margin: 0, fontSize: "0.88rem", color: LIGHT.textSecondary, whiteSpace: "pre-wrap" }}>
              {task.description}
            </p>
          </Field>
        )}

        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          <Field label="Due date">
            <span style={{ fontSize: "0.88rem", color: task.dueDateLabel ? LIGHT.text : LIGHT.textMuted }}>
              {task.dueDateLabel ? `📅 ${task.dueDateLabel}` : "No due date"}
            </span>
          </Field>
          <Field label="Assignee">
            <span style={{ fontSize: "0.88rem", color: task.assignee ? LIGHT.text : LIGHT.textMuted }}>
              {task.assignee ? task.assignee : "Unassigned"}
            </span>
          </Field>
          <Field label="Contact">
            <span style={{ fontSize: "0.88rem", color: task.contactLabel ? LIGHT.text : LIGHT.textMuted }}>
              {task.contactLabel ? `👤 ${task.contactLabel}` : "—"}
            </span>
          </Field>
        </div>

        <Field label="Activity log">
          {auditLoading ? (
            <span style={{ fontSize: "0.85rem", color: LIGHT.textMuted }}>Loading…</span>
          ) : auditLogs.length === 0 ? (
            <span style={{ fontSize: "0.85rem", color: LIGHT.textMuted }}>No activity yet.</span>
          ) : (
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: "0.65rem",
              }}
            >
              {auditLogs.map((entry) => (
                <li
                  key={entry.id}
                  style={{
                    borderLeft: `3px solid ${LIGHT.border}`,
                    paddingLeft: "0.75rem",
                  }}
                >
                  <div style={{ fontSize: "0.84rem", color: LIGHT.text }}>
                    {entry.message}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: LIGHT.textMuted, marginTop: 2 }}>
                    {entry.createdAtLabel}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Field>
      </div>
    </ModalShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
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
