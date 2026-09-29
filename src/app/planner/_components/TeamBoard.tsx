"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LIGHT } from "../../zoho/_components/ui";
import type { TaskRow } from "./types";
import {
  memberAgendaPath,
} from "../../../lib/reply/business-knowledge";
import { AssigneeQuickSelect } from "./AssigneeSelect";
import { BellIcon } from "./icons";
import { priorityBadge, statusChip, iconBtn, isUrgentTask } from "./planner-ui";

const CARD_SHADOW = "0 1px 2px rgba(16,24,40,0.04)";

const STATUS_LABEL: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  CANCELLED: "Cancelled",
  DECLINED: "Declined",
};

type AssigneeFilter = "ALL" | "unassigned" | string;

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

function isOpenTask(task: TaskRow): boolean {
  return task.status === "TODO" || task.status === "IN_PROGRESS";
}

function isClosedTask(task: TaskRow): boolean {
  return task.status === "DONE" || task.status === "CANCELLED" || task.status === "DECLINED";
}

export function TeamTaskCard({
  task,
  onToggleDone,
  onAssign,
  onNotify,
  onOpen,
  busy,
  compact,
}: {
  task: TaskRow;
  onToggleDone: (id: string, done: boolean) => void;
  onAssign: (taskId: string, assignee: string) => void;
  onNotify: (task: TaskRow) => void;
  onOpen: () => void;
  busy: boolean;
  compact?: boolean;
}) {
  const done = task.status === "DONE" || task.status === "CANCELLED";
  const canNotify = Boolean(task.assignee);
  const urgent = isUrgentTask(task);

  return (
    <div
      className={urgent ? "task-urgent" : undefined}
      style={{
        background: LIGHT.panel,
        border: `1px solid ${LIGHT.border}`,
        borderRadius: 8,
        padding: compact ? "8px 10px" : "12px 14px",
        boxShadow: CARD_SHADOW,
        opacity: done ? 0.72 : 1,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <input
          type="checkbox"
          checked={task.status === "DONE"}
          disabled={busy || task.status === "CANCELLED"}
          onChange={(e) => onToggleDone(task.id, e.target.checked)}
          style={{ marginTop: 2, cursor: "pointer", flexShrink: 0 }}
          aria-label={`Mark ${task.title} done`}
        />
        <button
          type="button"
          onClick={onOpen}
          style={{
            flex: 1,
            minWidth: 0,
            padding: 0,
            border: "none",
            background: "transparent",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              fontSize: compact ? 12 : 13,
              fontWeight: 600,
              color: LIGHT.text,
              textDecoration: done ? "line-through" : "none",
              lineHeight: 1.35,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
            title={task.title}
          >
            {task.title}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              marginTop: 6,
              fontSize: 10,
              color: LIGHT.textMuted,
              alignItems: "center",
            }}
          >
            <span style={priorityBadge(task.priority)}>{task.priority}</span>
            <span style={statusChip(task.status)}>{STATUS_LABEL[task.status] ?? task.status}</span>
            {task.dueDateLabel ? <span>Due {task.dueDateLabel}</span> : null}
          </div>
        </button>
      </div>
      {!compact ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <AssigneeQuickSelect
              taskId={task.id}
              currentAssignee={task.assignee}
              busy={busy}
              onAssign={onAssign}
            />
          </div>
          <button
            type="button"
            title={canNotify ? `Notify ${task.assignee}` : "Assign a team member first"}
            disabled={busy || !canNotify}
            onClick={() => onNotify(task)}
            style={{
              ...iconBtn(canNotify ? LIGHT.accent : LIGHT.textMuted),
              width: 28,
              height: 28,
              flexShrink: 0,
              opacity: canNotify ? 1 : 0.45,
              cursor: canNotify && !busy ? "pointer" : "not-allowed",
            }}
          >
            <BellIcon />
          </button>
        </div>
      ) : canNotify ? (
        <button
          type="button"
          title={`Notify ${task.assignee}`}
          disabled={busy}
          onClick={() => onNotify(task)}
          style={{
            ...iconBtn(LIGHT.accent),
            marginTop: 8,
            width: "100%",
            height: 28,
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <BellIcon />
          Notify {task.assignee}
        </button>
      ) : null}
    </div>
  );
}

function MemberPanel({
  routeTo,
  name,
  tasks,
  onToggleDone,
  onAssign,
  onNotify,
  onOpen,
  busy,
}: {
  routeTo: string;
  name: string;
  tasks: TaskRow[];
  onToggleDone: (id: string, done: boolean) => void;
  onAssign: (taskId: string, assignee: string) => void;
  onNotify: (task: TaskRow) => void;
  onOpen: (task: TaskRow) => void;
  busy: boolean;
}) {
  const [showDone, setShowDone] = useState(false);
  const openTasks = tasks.filter(isOpenTask);
  const doneTasks = tasks.filter(isClosedTask);

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        background: LIGHT.panel,
        border: `1px solid ${LIGHT.border}`,
        borderRadius: 12,
        boxShadow: CARD_SHADOW,
        overflow: "hidden",
      }}
    >
      <Link
        href={memberAgendaPath(routeTo)}
        title={`Open ${routeTo}'s agenda`}
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${LIGHT.border}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
          textDecoration: "none",
          color: "inherit",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {memberInitials(name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: LIGHT.text, fontSize: 14 }}>{routeTo}</div>
          <div
            style={{
              fontSize: 11,
              color: LIGHT.textMuted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name} · agenda →
          </div>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: openTasks.length > 0 ? "#4338ca" : LIGHT.textMuted,
            background: openTasks.length > 0 ? "#eef2ff" : LIGHT.appBg,
            padding: "2px 8px",
            borderRadius: 999,
          }}
        >
          {openTasks.length} open
        </span>
      </Link>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minHeight: 120,
          maxHeight: "min(420px, 42vh)",
        }}
      >
        {openTasks.length === 0 ? (
          <div style={{ fontSize: 12, color: LIGHT.textMuted, fontStyle: "italic", padding: 8 }}>
            No open tasks
          </div>
        ) : (
          openTasks.map((task) => (
            <TeamTaskCard
              key={task.id}
              task={task}
              onToggleDone={onToggleDone}
              onAssign={onAssign}
              onNotify={onNotify}
              onOpen={() => onOpen(task)}
              busy={busy}
              compact
            />
          ))
        )}
        {doneTasks.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            style={{
              background: "none",
              border: "none",
              color: LIGHT.textMuted,
              fontSize: 11,
              cursor: "pointer",
              padding: "4px 0",
              textAlign: "left",
            }}
          >
            {showDone ? "Hide" : "Show"} {doneTasks.length} completed
          </button>
        ) : null}
        {showDone
          ? doneTasks.map((task) => (
              <TeamTaskCard
                key={task.id}
                task={task}
                onToggleDone={onToggleDone}
                onAssign={onAssign}
                onNotify={onNotify}
                onOpen={() => onOpen(task)}
                busy={busy}
                compact
              />
            ))
          : null}
      </div>
      <div
        style={{
          padding: "10px 12px",
          borderTop: `1px solid ${LIGHT.border}`,
          background: LIGHT.panel,
          flexShrink: 0,
        }}
      >
        <Link
          href={memberAgendaPath(routeTo)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            minHeight: 34,
            borderRadius: 8,
            border: `1px solid ${LIGHT.border}`,
            background: LIGHT.panelAlt,
            color: LIGHT.accent,
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          View agenda
        </Link>
      </div>
    </section>
  );
}

export function TeamBoard({
  tasks,
  teamMembers,
  assigneeFilter,
  onToggleDone,
  onAssign,
  onNotify,
  onOpen,
  busy,
}: {
  tasks: TaskRow[];
  teamMembers: string[];
  assigneeFilter: AssigneeFilter;
  onToggleDone: (id: string, done: boolean) => void;
  onAssign: (taskId: string, assignee: string) => void;
  onNotify: (task: TaskRow) => void;
  onOpen: (task: TaskRow) => void;
  busy: boolean;
}) {
  const memberBoards = useMemo(() => {
    return teamMembers.map((name) => ({
      routeTo: name,
      name,
      email: "",
      tasks: tasks.filter((t) => t.assignee === name),
    }));
  }, [tasks, teamMembers]);

  const unassignedTasks = useMemo(() => tasks.filter((t) => !t.assignee), [tasks]);

  const visibleMembers = memberBoards.filter((board) => {
    if (assigneeFilter === "ALL") return true;
    if (assigneeFilter === "unassigned") return false;
    return board.routeTo === assigneeFilter;
  });

  const showUnassigned =
    (assigneeFilter === "ALL" || assigneeFilter === "unassigned") && unassignedTasks.length > 0;

  if (visibleMembers.length === 0 && !showUnassigned) {
    return (
      <div
        style={{
          border: `1px dashed ${LIGHT.borderStrong}`,
          borderRadius: 12,
          background: LIGHT.panel,
          padding: "3rem 1.5rem",
          textAlign: "center",
          color: LIGHT.textSecondary,
        }}
      >
        <div style={{ fontSize: "2rem", marginBottom: "0.4rem" }}>👥</div>
        <div style={{ fontWeight: 600, color: LIGHT.text }}>No matching team tasks</div>
        <p style={{ fontSize: "0.85rem", marginTop: "0.3rem" }}>
          Try a different filter or assign tasks from the table view.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
        gap: 12,
        alignItems: "stretch",
      }}
    >
      {visibleMembers.map((board) => (
        <MemberPanel
          key={board.routeTo}
          routeTo={board.routeTo}
          name={board.name}
          tasks={board.tasks}
          onToggleDone={onToggleDone}
          onAssign={onAssign}
          onNotify={onNotify}
          onOpen={onOpen}
          busy={busy}
        />
      ))}
      {showUnassigned ? (
        <section
          style={{
            gridColumn: "1 / -1",
            background: LIGHT.panel,
            border: `1px solid ${LIGHT.border}`,
            borderRadius: 12,
            padding: 14,
          }}
        >
          <h2 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: LIGHT.text }}>
            Unassigned
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
              gap: 8,
            }}
          >
            {unassignedTasks.map((task) => (
              <TeamTaskCard
                key={task.id}
                task={task}
                onToggleDone={onToggleDone}
                onAssign={onAssign}
                onNotify={onNotify}
                onOpen={() => onOpen(task)}
                busy={busy}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
