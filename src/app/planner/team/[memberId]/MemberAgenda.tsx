"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { LIGHT } from "../../../zoho/_components/ui";
import { useConfirm } from "../../../_components/ConfirmDialog";
import { APP_HEADER_HEIGHT } from "../../../_components/app-nav";
import type { TaskRow } from "../../_components/types";
import { TaskDetailModal } from "../../_components/TaskDetailModal";
import { TaskFormModal } from "../../_components/TaskFormModal";
import { TeamTaskCard } from "../../_components/TeamBoard";
import {
  assignTaskAction,
  notifyAssigneeAction,
  toggleTaskDoneAction,
} from "../../actions";
import {
  ghostBtn,
  primaryBtn,
  inputStyle,
  filterBar,
  filterRow,
  filterLabel,
  filterSelect,
  filterMeta,
  filterClearBtn,
} from "../../_components/planner-ui";
import type { RouteToTeammate } from "../../../../lib/reply/business-knowledge";

type AgendaSection = {
  key: string;
  label: string;
  tone: "danger" | "today" | "future" | "muted";
  tasks: TaskRow[];
};

type StatusFilter = "ALL" | "TODO" | "IN_PROGRESS" | "DONE" | "DECLINED";
type PriorityFilter = "ALL" | "URGENT" | "HIGH" | "MEDIUM" | "LOW";
type DateFilter =
  | "ALL"
  | "TODAY"
  | "TOMORROW"
  | "THIS_WEEK"
  | "THIS_MONTH"
  | "CUSTOM";

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "All statuses" },
  { key: "TODO", label: "To do" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "DONE", label: "Done" },
  { key: "DECLINED", label: "Declined" },
];

const PRIORITY_OPTIONS: { key: PriorityFilter; label: string }[] = [
  { key: "ALL", label: "Any priority" },
  { key: "URGENT", label: "Urgent" },
  { key: "HIGH", label: "High" },
  { key: "MEDIUM", label: "Medium" },
  { key: "LOW", label: "Low" },
];

const DATE_OPTIONS: { key: DateFilter; label: string }[] = [
  { key: "ALL", label: "Any date" },
  { key: "TODAY", label: "Today" },
  { key: "TOMORROW", label: "Tomorrow" },
  { key: "THIS_WEEK", label: "This week" },
  { key: "THIS_MONTH", label: "This month" },
  { key: "CUSTOM", label: "Custom range" },
];

function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function startOfWeekISO(base: Date): string {
  const start = new Date(base);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return toISODate(start);
}

function endOfWeekISO(base: Date): string {
  const start = new Date(startOfWeekISO(base));
  return toISODate(addDays(start, 6));
}

function startOfMonthISO(base: Date): string {
  return toISODate(new Date(base.getFullYear(), base.getMonth(), 1));
}

function endOfMonthISO(base: Date): string {
  return toISODate(new Date(base.getFullYear(), base.getMonth() + 1, 0));
}

function getDateRange(
  mode: DateFilter,
  customStart: string,
  customEnd: string
): { start: string | null; end: string | null } {
  const now = new Date();
  const today = todayISO();

  switch (mode) {
    case "TODAY":
      return { start: today, end: today };
    case "TOMORROW": {
      const tomorrow = toISODate(addDays(now, 1));
      return { start: tomorrow, end: tomorrow };
    }
    case "THIS_WEEK":
      return { start: startOfWeekISO(now), end: endOfWeekISO(now) };
    case "THIS_MONTH":
      return { start: startOfMonthISO(now), end: endOfMonthISO(now) };
    case "CUSTOM":
      return {
        start: customStart || null,
        end: customEnd || null,
      };
    default:
      return { start: null, end: null };
  }
}

function formatSectionDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOpenTask(task: TaskRow): boolean {
  return task.status === "TODO" || task.status === "IN_PROGRESS";
}

function isClosedTask(task: TaskRow): boolean {
  return (
    task.status === "DONE" ||
    task.status === "CANCELLED" ||
    task.status === "DECLINED"
  );
}

function sortByDueThenPriority(a: TaskRow, b: TaskRow): number {
  const dueA = a.dueDateISO ?? "9999-99-99";
  const dueB = b.dueDateISO ?? "9999-99-99";
  if (dueA !== dueB) return dueA.localeCompare(dueB);
  const rank: Record<string, number> = {
    URGENT: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  return (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
}

function buildAgendaSections(tasks: TaskRow[]): {
  openSections: AgendaSection[];
  completed: TaskRow[];
} {
  const today = todayISO();
  const open = tasks.filter(isOpenTask);
  const completed = tasks.filter(isClosedTask).sort(sortByDueThenPriority);

  const overdue = open
    .filter((t) => t.dueDateISO && t.dueDateISO < today)
    .sort(sortByDueThenPriority);
  const dueToday = open
    .filter((t) => t.dueDateISO === today)
    .sort(sortByDueThenPriority);
  const noDue = open
    .filter((t) => !t.dueDateISO)
    .sort(sortByDueThenPriority);

  const futureByDate = new Map<string, TaskRow[]>();
  for (const task of open) {
    if (!task.dueDateISO || task.dueDateISO <= today) continue;
    const list = futureByDate.get(task.dueDateISO) ?? [];
    list.push(task);
    futureByDate.set(task.dueDateISO, list);
  }

  const openSections: AgendaSection[] = [];
  if (overdue.length > 0) {
    openSections.push({
      key: "overdue",
      label: "Overdue",
      tone: "danger",
      tasks: overdue,
    });
  }
  if (dueToday.length > 0) {
    openSections.push({
      key: "today",
      label: "Today",
      tone: "today",
      tasks: dueToday,
    });
  }
  for (const iso of [...futureByDate.keys()].sort()) {
    openSections.push({
      key: `future-${iso}`,
      label: formatSectionDate(iso),
      tone: "future",
      tasks: (futureByDate.get(iso) ?? []).sort(sortByDueThenPriority),
    });
  }
  if (noDue.length > 0) {
    openSections.push({
      key: "no-due",
      label: "No due date",
      tone: "muted",
      tasks: noDue,
    });
  }

  return { openSections, completed };
}

const TONE_STYLES: Record<
  AgendaSection["tone"],
  { bg: string; fg: string; border: string }
> = {
  danger: { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" },
  today: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
  future: { bg: "#f8fafc", fg: "#334155", border: "#e2e8f0" },
  muted: { bg: "#f8fafc", fg: LIGHT.textMuted, border: LIGHT.border },
};

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

export function MemberAgenda({
  routeTo,
  name,
  email,
  tasks,
}: {
  routeTo: RouteToTeammate;
  name: string;
  email: string;
  tasks: TaskRow[];
}) {
  const [detail, setDetail] = useState<{ task: TaskRow } | null>(null);
  const [form, setForm] = useState<{ task: TaskRow | null } | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [priority, setPriority] = useState<PriorityFilter>("ALL");
  const [dateFilter, setDateFilter] = useState<DateFilter>("ALL");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  const activeDateRange = useMemo(
    () => getDateRange(dateFilter, customStartDate, customEndDate),
    [customEndDate, customStartDate, dateFilter]
  );

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const { start, end } = activeDateRange;

    return tasks.filter((task) => {
      if (status !== "ALL" && task.status !== status) return false;
      if (priority !== "ALL" && task.priority !== priority) return false;
      if (dateFilter !== "ALL") {
        if (!task.dueDateISO) return false;
        if (start && task.dueDateISO < start) return false;
        if (end && task.dueDateISO > end) return false;
      }
      if (!q) return true;
      return [
        task.title,
        task.description ?? "",
        task.contactLabel ?? "",
        task.sourceSubject ?? "",
      ].some((value) => value.toLowerCase().includes(q));
    });
  }, [activeDateRange, dateFilter, priority, query, status, tasks]);

  const { openSections, completed } = useMemo(
    () => buildAgendaSections(filteredTasks),
    [filteredTasks]
  );

  const openCount = filteredTasks.filter(isOpenTask).length;
  const hasFilters =
    query.trim().length > 0 ||
    status !== "ALL" ||
    priority !== "ALL" ||
    dateFilter !== "ALL" ||
    customStartDate.length > 0 ||
    customEndDate.length > 0;

  function onAssign(taskId: string, assignee: string) {
    startTransition(() => void assignTaskAction(taskId, assignee));
  }

  async function onNotify(task: TaskRow) {
    if (!task.assignee) {
      await confirm({
        title: "No assignee",
        message: "Assign this task to a team member before notifying them.",
        confirmLabel: "OK",
      });
      return;
    }
    const ok = await confirm({
      title: "Notify assignee",
      message: `Email ${task.assignee} about "${task.title}"?`,
      confirmLabel: "Send notification",
    });
    if (!ok) return;

    startTransition(() => {
      void (async () => {
        const result = await notifyAssigneeAction(task.id);
        await confirm({
          title: result.ok ? "Notification sent" : "Could not notify",
          message: result.message,
          confirmLabel: "OK",
          cancelLabel: "Close",
        });
      })();
    });
  }

  function onToggleDone(id: string, done: boolean) {
    const task = tasks.find((t) => t.id === id);
    if (task?.status === "DECLINED") return;
    startTransition(() => void toggleTaskDoneAction(id, done));
  }

  return (
    <div
      style={{
        position: "fixed",
        top: APP_HEADER_HEIGHT,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        background: LIGHT.appBg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0.85rem 1.25rem",
          background: LIGHT.panel,
          borderBottom: `1px solid ${LIGHT.border}`,
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <Link href="/planner?view=team" style={{ ...ghostBtn, textDecoration: "none" }}>
          ← Team
        </Link>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          {memberInitials(name)}
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 700, fontSize: "1.05rem", color: LIGHT.text }}>
            {routeTo}&apos;s agenda
          </div>
          <div style={{ fontSize: 12, color: LIGHT.textMuted }}>
            {name} · {email}
          </div>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: openCount > 0 ? "#4338ca" : LIGHT.textMuted,
            background: openCount > 0 ? "#eef2ff" : LIGHT.appBg,
            padding: "4px 10px",
            borderRadius: 999,
          }}
        >
          {openCount} open
        </span>
        <button
          type="button"
          onClick={() => setForm({ task: null })}
          style={primaryBtn}
        >
          + Add task
        </button>
      </header>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1rem 1.25rem 2rem",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={filterBar}>
          <div style={filterRow}>
            <span style={filterLabel}>Search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title, contact, subject..."
              style={{ ...inputStyle, flex: "1 1 320px", minWidth: 110 }}
            />
            <span style={filterLabel}>Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              style={filterSelect}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <span style={filterLabel}>Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityFilter)}
              style={filterSelect}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <span style={filterLabel}>Date</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              style={filterSelect}
            >
              {DATE_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            {dateFilter === "CUSTOM" ? (
              <>
                <span style={filterLabel}>Start</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  style={{ ...inputStyle, width: 160 }}
                />
                <span style={filterLabel}>End</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  style={{ ...inputStyle, width: 160 }}
                />
              </>
            ) : null}
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatus("ALL");
                  setPriority("ALL");
                  setDateFilter("ALL");
                  setCustomStartDate("");
                  setCustomEndDate("");
                }}
                style={filterClearBtn}
              >
                Clear
              </button>
            ) : null}
          </div>
          <div style={filterMeta}>
            Showing {filteredTasks.length} of {tasks.length} tasks for {routeTo}
          </div>
        </div>
        {openSections.length === 0 ? (
          <div
            style={{
              border: `1px dashed ${LIGHT.borderStrong}`,
              borderRadius: 12,
              background: LIGHT.panel,
              padding: "2.5rem 1.5rem",
              textAlign: "center",
              color: LIGHT.textSecondary,
            }}
          >
            <div style={{ fontWeight: 600, color: LIGHT.text }}>
              {hasFilters ? "No matching tasks" : "No open tasks"}
            </div>
            <p style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
              {hasFilters
                ? "Try changing the search or filters."
                : `${routeTo} has nothing overdue, due today, or upcoming.`}
            </p>
          </div>
        ) : (
          openSections.map((section) => {
            const tone = TONE_STYLES[section.tone];
            return (
              <section key={section.key} style={{ marginBottom: 18 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 700,
                      color: tone.fg,
                      background: tone.bg,
                      border: `1px solid ${tone.border}`,
                      padding: "4px 10px",
                      borderRadius: 999,
                    }}
                  >
                    {section.label}
                  </h2>
                  <span style={{ fontSize: 12, color: LIGHT.textMuted }}>
                    {section.tasks.length}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {section.tasks.map((task) => (
                    <TeamTaskCard
                      key={task.id}
                      task={task}
                      onToggleDone={onToggleDone}
                      onAssign={onAssign}
                      onNotify={onNotify}
                      onOpen={() => setDetail({ task })}
                      busy={pending}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}

        {completed.length > 0 ? (
          <section style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              style={{
                background: "none",
                border: "none",
                color: LIGHT.textMuted,
                fontSize: 12,
                cursor: "pointer",
                padding: "4px 0",
                fontWeight: 600,
              }}
            >
              {showCompleted ? "Hide" : "Show"} {completed.length} completed
            </button>
            {showCompleted ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                {completed.map((task) => (
                  <TeamTaskCard
                    key={task.id}
                    task={task}
                    onToggleDone={onToggleDone}
                    onAssign={onAssign}
                    onNotify={onNotify}
                    onOpen={() => setDetail({ task })}
                    busy={pending}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      {detail ? (
        <TaskDetailModal
          task={detail.task}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setForm({ task: detail.task });
            setDetail(null);
          }}
        />
      ) : null}
      {form ? (
        <TaskFormModal
          initial={form.task}
          defaultAssignee={form.task ? undefined : routeTo}
          onClose={() => setForm(null)}
        />
      ) : null}
    </div>
  );
}
