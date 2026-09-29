"use client";

import { useMemo, useState, useTransition, useCallback, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LIGHT } from "../../zoho/_components/ui";
import { useConfirm } from "../../_components/ConfirmDialog";
import { useIsMobile } from "../../_hooks/useIsMobile";
import type { TaskRow } from "./types";
import {
  toggleTaskDoneAction,
  deleteTaskAction,
  deleteTasksAction,
  setTaskStatusAction,
  assignTaskAction,
  notifyAssigneeAction,
} from "../actions";
import { ROUTE_TO_TEAMMATES } from "../../../lib/reply/business-knowledge";
import { AssigneeQuickSelect } from "./AssigneeSelect";
import { TaskFormModal } from "./TaskFormModal";
import { TaskDetailModal } from "./TaskDetailModal";
import { TaskEmailModal } from "./TaskEmailModal";
import { Pagination } from "./Pagination";
import { KanbanBoard, type KanbanColumn } from "./KanbanBoard";
import { TeamBoard } from "./TeamBoard";
import {
  TrashIcon,
  EditIcon,
  SearchIcon,
  PlusIcon,
  ListIcon,
  BoardIcon,
  TableIcon,
  TeamIcon,
  BellIcon,
} from "./icons";
import { LIGHT as L } from "../../zoho/_components/ui";
import {
  cardStyle,
  metaRow,
  inputStyle,
  primaryBtn,
  ghostBtn,
  iconBtn,
  priorityBadge,
  statusChip,
  segmentGroup,
  segmentBtn,
  filterBar,
  filterRow,
  filterLabel,
  filterSelect,
  filterMeta,
  filterClearBtn,
  isUrgentTask,
} from "./planner-ui";

type View = "list" | "board" | "table" | "team";
type AssigneeFilter = "ALL" | "unassigned" | (typeof ROUTE_TO_TEAMMATES)[number];

function parseView(value: string | null): View {
  if (value === "table" || value === "list" || value === "team") return value;
  return "board";
}

const BOARD_COLUMNS: KanbanColumn[] = [
  { key: "TODO", label: "To do", accent: L.textMuted },
  { key: "IN_PROGRESS", label: "In progress", accent: L.accent },
  { key: "DONE", label: "Done", accent: L.success },
  { key: "CANCELLED", label: "Cancelled", accent: L.danger },
  { key: "DECLINED", label: "Declined", accent: "#7c3aed" },
];

type Filter = "ALL" | "TODO" | "IN_PROGRESS" | "DONE" | "DECLINED";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "TODO", label: "To do" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "DONE", label: "Done" },
  { key: "DECLINED", label: "Declined" },
];

type PriorityFilter = "ALL" | "URGENT" | "HIGH" | "MEDIUM" | "LOW";
const PRIORITY_FILTERS: { key: PriorityFilter; label: string }[] = [
  { key: "ALL", label: "Any priority" },
  { key: "URGENT", label: "Urgent" },
  { key: "HIGH", label: "High" },
  { key: "MEDIUM", label: "Medium" },
  { key: "LOW", label: "Low" },
];

const PAGE_SIZE = 6;
const TABLE_PAGE_SIZE = 15;

export function TasksPanel({ tasks, teamMembers }: { tasks: TaskRow[]; teamMembers: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [priority, setPriority] = useState<PriorityFilter>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("ALL");
  const [view, setViewState] = useState<View>(() => parseView(searchParams.get("view")));
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ task: TaskRow | null } | null>(null);
  const [detail, setDetail] = useState<{ task: TaskRow } | null>(null);
  const [sourceEmail, setSourceEmail] = useState<{ task: TaskRow } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const isMobile = useIsMobile(768);

  const setView = useCallback(
    (next: View) => {
      setViewState(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "board") params.delete("view");
      else params.set("view", next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { ALL: tasks.length, TODO: 0, IN_PROGRESS: 0, DONE: 0, DECLINED: 0 };
    for (const t of tasks) {
      if (t.status === "TODO") c.TODO += 1;
      else if (t.status === "IN_PROGRESS") c.IN_PROGRESS += 1;
      else if (t.status === "DONE") c.DONE += 1;
      else if (t.status === "DECLINED") c.DECLINED += 1;
    }
    return c;
  }, [tasks]);

  const priorityCounts = useMemo(() => {
    const c: Record<PriorityFilter, number> = {
      ALL: tasks.length,
      URGENT: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };
    for (const t of tasks) {
      if (t.priority === "URGENT") c.URGENT += 1;
      else if (t.priority === "HIGH") c.HIGH += 1;
      else if (t.priority === "MEDIUM") c.MEDIUM += 1;
      else if (t.priority === "LOW") c.LOW += 1;
    }
    return c;
  }, [tasks]);

 const assigneeCounts = useMemo(() => {
  const byMember: Record<string, number> = {};

  for (const member of teamMembers) {
    byMember[member] = 0;
  }

  let unassigned = 0;

  for (const t of tasks) {
    if (!t.assignee) {
      unassigned += 1;
    } else {
      if (!(t.assignee in byMember)) {
        byMember[t.assignee] = 0;
      }

      byMember[t.assignee] += 1;
    }
  }

  return { all: tasks.length, byMember, unassigned };
}, [tasks, teamMembers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filter !== "ALL" && t.status !== filter) return false;
      if (priority !== "ALL" && t.priority !== priority) return false;
      if (assigneeFilter === "unassigned" && t.assignee) return false;
      if (
        assigneeFilter !== "ALL" &&
        assigneeFilter !== "unassigned" &&
        t.assignee !== assigneeFilter
      ) {
        return false;
      }
      if (!q) return true;
      const hay = [
        t.title,
        t.description ?? "",
        t.contactLabel ?? "",
        t.assignee ?? "",
        t.sourceSubject ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tasks, filter, priority, assigneeFilter, query]);

  // Board shows most-recently-updated tasks on top (within each status column),
  // so a task refreshed from a new email / manual edit jumps to the top.
  const boardItems = useMemo(
    () => [...filtered].sort((a, b) => b.updatedAtISO.localeCompare(a.updatedAtISO)),
    [filtered]
  );

  const pageSize = view === "table" ? TABLE_PAGE_SIZE : PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const resetPage = () => setPage(1);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function enterSelectMode() {
    if (view === "board" || view === "team") setView("table");
    setSelectMode(true);
    setSelected(new Set());
  }

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

  function onToggleDone(id: string, done: boolean, currentStatus?: string) {
    if (currentStatus === "DECLINED") return;
    startTransition(() => void toggleTaskDoneAction(id, done));
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  // "Select all" toggles every task on the current page.
  const allVisibleSelected = visible.length > 0 && visible.every((t) => selected.has(t.id));
  function toggleSelectAll() {
    setSelected((prev) => {
      if (visible.every((t) => prev.has(t.id))) {
        const next = new Set(prev);
        for (const t of visible) next.delete(t.id);
        return next;
      }
      const next = new Set(prev);
      for (const t of visible) next.add(t.id);
      return next;
    });
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = await confirm({
      title: "Delete tasks",
      message: `Delete ${ids.length} task${ids.length === 1 ? "" : "s"}? This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    startTransition(() => void deleteTasksAction(ids));
    exitSelectMode();
  }

  const filtersActive =
    filter !== "ALL" || priority !== "ALL" || assigneeFilter !== "ALL" || query.trim().length > 0;

  function clearFilters() {
    setQuery("");
    setFilter("ALL");
    setPriority("ALL");
    setAssigneeFilter("ALL");
    resetPage();
  }

  return (
    <div style={{ maxWidth: 1650, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      {/* Toolbar: search + filters + New */}
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center",
          gap: "0.6rem",
          flexWrap: "wrap",
          marginBottom: "0.9rem",
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: isMobile ? 0 : 200, width: isMobile ? "100%" : undefined }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: LIGHT.textMuted, display: "flex" }}>
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPage();
            }}
            placeholder="Search tasks…"
            style={{ ...inputStyle, paddingLeft: "2rem" }}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
            width: isMobile ? "100%" : "auto",
          }}
        >
          <div
            style={{
              ...segmentGroup,
              flex: isMobile ? 1 : undefined,
              overflowX: "auto",
              maxWidth: "100%",
            }}
            role="tablist"
            aria-label="View"
          >
            <button
              type="button"
              onClick={() => setView("table")}
              style={segmentBtn(view === "table")}
              aria-pressed={view === "table"}
              title="Table"
            >
              <TableIcon />
              {!isMobile ? "Table" : null}
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              style={segmentBtn(view === "list")}
              aria-pressed={view === "list"}
              title="Cards"
            >
              <ListIcon />
              {!isMobile ? "Cards" : null}
            </button>
            <button
              type="button"
              onClick={() => setView("board")}
              style={segmentBtn(view === "board")}
              aria-pressed={view === "board"}
              title="Status board"
            >
              <BoardIcon />
              {!isMobile ? "Status" : null}
            </button>
            <button
              type="button"
              onClick={() => setView("team")}
              style={segmentBtn(view === "team")}
              aria-pressed={view === "team"}
              title="Team"
            >
              <TeamIcon />
              {!isMobile ? "Team" : null}
            </button>
          </div>
          {view !== "team" ? (
            <button
              type="button"
              onClick={() => (selectMode ? exitSelectMode() : enterSelectMode())}
              style={selectMode ? primaryBtn : ghostBtn}
            >
              {selectMode ? "Done" : "Select"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setForm({ task: null })}
            style={{ ...primaryBtn, marginLeft: isMobile ? "auto" : undefined }}
          >
            <PlusIcon />
            {isMobile ? " New" : " New Task"}
          </button>
        </div>
      </div>

      <div style={filterBar}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "1fr 1fr"
              : "minmax(150px, 1.1fr) minmax(140px, 1fr) minmax(150px, 1.1fr) auto",
            gap: isMobile ? "0.65rem" : "0.75rem",
            alignItems: "end",
          }}
        >
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              minWidth: 0,
              gridColumn: isMobile ? "1 / -1" : undefined,
            }}
          >
            <span style={{ ...filterLabel, minWidth: 0 }}>Status</span>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as Filter);
                resetPage();
              }}
              style={{ ...filterSelect, width: "100%", minWidth: 0 }}
              aria-label="Filter by status"
            >
              {FILTERS.map(({ key, label }) => (
                <option key={key} value={key}>
                  {label} ({counts[key]})
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span style={{ ...filterLabel, minWidth: 0 }}>Priority</span>
            <select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value as PriorityFilter);
                resetPage();
              }}
              style={{ ...filterSelect, width: "100%", minWidth: 0 }}
              aria-label="Filter by priority"
            >
              {PRIORITY_FILTERS.map(({ key, label }) => (
                <option key={key} value={key}>
                  {label} ({priorityCounts[key]})
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span style={{ ...filterLabel, minWidth: 0 }}>Assignee</span>
            <select
              value={assigneeFilter}
              onChange={(e) => {
                setAssigneeFilter(e.target.value as AssigneeFilter);
                resetPage();
              }}
              style={{ ...filterSelect, width: "100%", minWidth: 0 }}
              aria-label="Filter by assignee"
            >
              <option value="ALL">All assignees ({assigneeCounts.all})</option>
              {teamMembers.map((member) => (
                <option key={member} value={member}>
                  {member} ({assigneeCounts.byMember[member] ?? 0})
                </option>
              ))}

              {assigneeCounts.unassigned > 0 ? (
                <option value="unassigned">Unassigned ({assigneeCounts.unassigned})</option>
              ) : null}
            </select>
          </label>

          {filtersActive ? (
            <button
              type="button"
              onClick={clearFilters}
              style={{
                ...filterClearBtn,
                marginLeft: 0,
                gridColumn: isMobile ? "1 / -1" : undefined,
                justifySelf: isMobile ? "start" : "end",
                alignSelf: isMobile ? "start" : "end",
                marginBottom: isMobile ? 0 : 6,
              }}
            >
              Clear filters
            </button>
          ) : (
            <span aria-hidden style={{ display: isMobile ? "none" : "block" }} />
          )}
        </div>

        <div style={filterMeta}>
          {filtered.length === tasks.length
            ? `${tasks.length} task${tasks.length === 1 ? "" : "s"}`
            : `Showing ${filtered.length} of ${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
          {isMobile && view === "table" ? " · Showing cards on mobile" : null}
        </div>
      </div>

      {view === "board" ? (
        filtered.length === 0 ? (
          <Empty query={query} filter={filter} />
        ) : (
          <KanbanBoard
            columns={BOARD_COLUMNS}
            items={boardItems}
            columnOf={(t) => t.status}
            onMove={(id, status) =>
              startTransition(() => void setTaskStatusAction(id, status))
            }
            emptyLabel="No tasks"
            renderCard={(t) => (
              <BoardTaskCard
                task={t}
                busy={pending}
                onOpen={() => setDetail({ task: t })}
                onEdit={() => setForm({ task: t })}
                onViewEmail={() => setSourceEmail({ task: t })}
                startTransition={startTransition}
              />
            )}
          />
        )
      ) : view === "team" ? (
          <TeamBoard
          teamMembers={teamMembers}
          tasks={filtered}
          assigneeFilter={assigneeFilter}
          onToggleDone={onToggleDone}
          onAssign={onAssign}
          onNotify={onNotify}
          onOpen={(task) => setDetail({ task })}
          busy={pending}
        />
      ) : view === "table" && !isMobile ? (
        <>
          {selectMode && visible.length > 0 && (
            <BulkSelectBar
              allVisibleSelected={allVisibleSelected}
              toggleSelectAll={toggleSelectAll}
              selectedCount={selected.size}
              onDelete={bulkDelete}
              pending={pending}
            />
          )}

          {visible.length === 0 ? (
            <Empty query={query} filter={filter} />
          ) : (
            <div
              style={{
                background: LIGHT.panel,
                border: `1px solid ${LIGHT.border}`,
                borderRadius: 12,
                boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                overflow: "auto",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.8125rem",
                  minWidth: 860,
                }}
              >
                <thead>
                  <tr style={{ background: LIGHT.appBg, borderBottom: `1px solid ${LIGHT.border}` }}>
                    <th style={{ width: 36, padding: "10px 8px" }} aria-label={selectMode ? "Select" : "Done"} />
                    <th style={tableHeadCell}>Task</th>
                    {assigneeFilter === "ALL" ? <th style={tableHeadCell}>Assignee</th> : null}
                    <th style={tableHeadCell}>Contact</th>
                    <th style={tableHeadCell}>Priority</th>
                    <th style={tableHeadCell}>Status</th>
                    <th style={tableHeadCell}>Due</th>
                    <th style={{ ...tableHeadCell, width: 170 }}>Assign</th>
                    {!selectMode ? <th style={{ ...tableHeadCell, width: 100 }}>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((t) => (
                    <TaskTableRow
                      key={t.id}
                      task={t}
                      busy={pending}
                      selectable={selectMode}
                      selected={selected.has(t.id)}
                      showAssignee={assigneeFilter === "ALL"}
                      onToggleSelect={() => toggleSelect(t.id)}
                      onOpen={() => setDetail({ task: t })}
                      onEdit={() => setForm({ task: t })}
                      onViewEmail={() => setSourceEmail({ task: t })}
                      onAssign={onAssign}
                      onNotify={() => void onNotify(t)}
                      startTransition={startTransition}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            page={safePage}
            pageCount={pageCount}
            total={filtered.length}
            pageSize={pageSize}
            onPage={setPage}
          />
        </>
      ) : (
        <>
          {/* Bulk-selection action bar — also used for mobile "table" (cards) */}
          {selectMode && visible.length > 0 && (
            <BulkSelectBar
              allVisibleSelected={allVisibleSelected}
              toggleSelectAll={toggleSelectAll}
              selectedCount={selected.size}
              onDelete={bulkDelete}
              pending={pending}
            />
          )}

          {/* Cards */}
          {visible.length === 0 ? (
            <Empty query={query} filter={filter} />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
                gap: "0.7rem",
              }}
            >
              {visible.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  busy={pending}
                  selectable={selectMode}
                  selected={selected.has(t.id)}
                  onToggleSelect={() => toggleSelect(t.id)}
                  onOpen={() => setDetail({ task: t })}
                  onEdit={() => setForm({ task: t })}
                  onViewEmail={() => setSourceEmail({ task: t })}
                  startTransition={startTransition}
                />
              ))}
            </div>
          )}

          <Pagination
            page={safePage}
            pageCount={pageCount}
            total={filtered.length}
            pageSize={pageSize}
            onPage={setPage}
          />
        </>
      )}

      {detail && (
        <TaskDetailModal
          task={detail.task}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setForm({ task: detail.task });
            setDetail(null);
          }}
        />
      )}

      {form && <TaskFormModal initial={form.task} teamMembers={teamMembers} onClose={() => setForm(null)} />}

      {sourceEmail && (
        <TaskEmailModal task={sourceEmail.task} onClose={() => setSourceEmail(null)} />
      )}
    </div>
  );
}

function TaskItem({
  task,
  busy,
  selectable = false,
  selected = false,
  onToggleSelect,
  onOpen,
  onEdit,
  onViewEmail,
  startTransition,
}: {
  task: TaskRow;
  busy: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onViewEmail: () => void;
  startTransition: (cb: () => void) => void;
}) {
  const done = task.status === "DONE";
  const hasSourceEmail = Boolean(task.sourceBody || task.sourceSubject);
  const confirm = useConfirm();
  const urgent = isUrgentTask(task);
  return (
    <div
      className={urgent ? "tk-card task-urgent" : "tk-card"}
      style={{
        ...cardStyle,
        ...(selected ? { borderColor: LIGHT.accent, background: LIGHT.accentSoft } : {}),
      }}
    >
      {selectable ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select "${task.title}"`}
          style={{ width: 17, height: 17, marginTop: 2, cursor: "pointer", flexShrink: 0, accentColor: LIGHT.accent }}
        />
      ) : (
        <button
          type="button"
          className="tk-check"
          title={done ? "Mark as to-do" : "Mark as done"}
          onClick={() => task.status !== "DECLINED" && startTransition(() => void toggleTaskDoneAction(task.id, !done))}
          style={checkStyle(done)}
          disabled={task.status === "DECLINED"}
        >
          {done ? "✓" : ""}
        </button>
      )}

      <div
        style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
        onClick={selectable ? onToggleSelect : onOpen}
        role="button"
        title={selectable ? "Select task" : "View task details"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: "0.95rem",
              color: done ? LIGHT.textMuted : LIGHT.text,
              textDecoration: done ? "line-through" : "none",
            }}
          >
            {task.title}
          </span>
          <span style={priorityBadge(task.priority)}>{task.priority}</span>
        </div>
        {task.description && (
          <p style={{ margin: "0.3rem 0 0", fontSize: "0.83rem", color: LIGHT.textSecondary }}>
            {task.description}
          </p>
        )}
        <div style={metaRow}>
          {task.dueDateLabel && <span>📅 {task.dueDateLabel}</span>}
          {task.contactLabel && <span>👤 {task.contactLabel}</span>}
          {task.assignee && <span>🎯 {task.assignee}</span>}
          <span style={statusChip(task.status)}>{task.status.replace("_", " ")}</span>
        </div>
      </div>

      {!selectable && (
        <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0 }}>
          {hasSourceEmail && (
            <button
              type="button"
              className="tk-icon-btn"
              title="View the email that created this task"
              onClick={onViewEmail}
              style={iconBtn(LIGHT.textSecondary)}
            >
              📧
            </button>
          )}
          <button
            type="button"
            className="tk-icon-btn"
            title="Edit task"
            onClick={onEdit}
            style={iconBtn(LIGHT.textSecondary)}
          >
            <EditIcon />
          </button>
          <button
            type="button"
            className="tk-icon-btn"
            title="Delete task"
            disabled={busy}
            onClick={async () => {
              const ok = await confirm({
                title: "Delete task",
                message: `Delete "${task.title}"? This can't be undone.`,
                confirmLabel: "Delete",
                danger: true,
              });
              if (!ok) return;
              startTransition(() => void deleteTaskAction(task.id));
            }}
            style={iconBtn(LIGHT.danger)}
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  );
}

function BoardTaskCard({
  task,
  busy,
  onOpen,
  onEdit,
  onViewEmail,
  startTransition,
}: {
  task: TaskRow;
  busy: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onViewEmail: () => void;
  startTransition: (cb: () => void) => void;
}) {
  const done = task.status === "DONE";
  const hasSourceEmail = Boolean(task.sourceBody || task.sourceSubject);
  const confirm = useConfirm();
  const urgent = isUrgentTask(task);
  return (
    <div
      className={urgent ? "tk-card task-urgent" : "tk-card"}
      style={{ ...cardStyle, flexDirection: "column", alignItems: "stretch", gap: "0.5rem", padding: "0.7rem 0.8rem", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}
    >
      <div
        style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer" }}
        onClick={onOpen}
        role="button"
        title="View task details"
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontWeight: 700,
            fontSize: "0.88rem",
            color: done ? LIGHT.textMuted : LIGHT.text,
            textDecoration: done ? "line-through" : "none",
          }}
        >
          {task.title}
        </span>
        <span style={priorityBadge(task.priority)}>{task.priority}</span>
      </div>

      {task.description && (
        <p
          onClick={onOpen}
          style={{
            margin: 0,
            fontSize: "0.79rem",
            color: LIGHT.textSecondary,
            cursor: "pointer",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {task.description}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
        <div style={{ ...metaRow, margin: 0, flex: 1 }}>
          {task.dueDateLabel && <span>📅 {task.dueDateLabel}</span>}
          {task.contactLabel && <span>👤 {task.contactLabel}</span>}
          {task.assignee && <span>🎯 {task.assignee}</span>}
        </div>
        {hasSourceEmail && (
          <button
            type="button"
            className="tk-icon-btn"
            title="View the email that created this task"
            onClick={onViewEmail}
            style={{ ...iconBtn(LIGHT.textSecondary), width: 26, height: 26 }}
          >
            📧
          </button>
        )}
        <button
          type="button"
          className="tk-icon-btn"
          title="Edit task"
          onClick={onEdit}
          style={{ ...iconBtn(LIGHT.textSecondary), width: 26, height: 26 }}
        >
          <EditIcon />
        </button>
        <button
          type="button"
          className="tk-icon-btn"
          title="Delete task"
          disabled={busy}
          onClick={async () => {
            const ok = await confirm({
              title: "Delete task",
              message: `Delete "${task.title}"? This can't be undone.`,
              confirmLabel: "Delete",
              danger: true,
            });
            if (!ok) return;
            startTransition(() => void deleteTaskAction(task.id));
          }}
          style={{ ...iconBtn(LIGHT.danger), width: 26, height: 26 }}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function BulkSelectBar({
  allVisibleSelected,
  toggleSelectAll,
  selectedCount,
  onDelete,
  pending,
}: {
  allVisibleSelected: boolean;
  toggleSelectAll: () => void;
  selectedCount: number;
  onDelete: () => void;
  pending: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.85rem",
        flexWrap: "wrap",
        padding: "0.6rem 0.85rem",
        marginBottom: "0.7rem",
        background: LIGHT.accentSoft,
        border: `1px solid ${LIGHT.accent}33`,
        borderRadius: 10,
      }}
    >
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", fontWeight: 600, color: LIGHT.text, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={allVisibleSelected}
          onChange={toggleSelectAll}
          style={{ width: 16, height: 16, cursor: "pointer", accentColor: LIGHT.accent }}
        />
        Select all on page
      </label>
      <span style={{ fontSize: "0.82rem", color: LIGHT.textSecondary }}>
        {selectedCount} selected
      </span>
      <button
        type="button"
        onClick={onDelete}
        disabled={selectedCount === 0 || pending}
        style={{
          marginLeft: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.45rem 0.9rem",
          fontSize: "0.82rem",
          fontWeight: 700,
          color: "#fff",
          background: selectedCount === 0 ? LIGHT.textMuted : LIGHT.danger,
          border: "none",
          borderRadius: 8,
          cursor: selectedCount === 0 || pending ? "default" : "pointer",
        }}
      >
        <TrashIcon /> Delete {selectedCount > 0 ? `(${selectedCount})` : ""}
      </button>
    </div>
  );
}

const tableHeadCell: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: "0.68rem",
  fontWeight: 700,
  color: LIGHT.textMuted,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const STATUS_LABEL: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  CANCELLED: "Cancelled",
  DECLINED: "Declined",
};

function TaskTableRow({
  task,
  busy,
  selectable = false,
  selected = false,
  showAssignee,
  onToggleSelect,
  onOpen,
  onEdit,
  onViewEmail,
  onAssign,
  onNotify,
  startTransition,
}: {
  task: TaskRow;
  busy: boolean;
  selectable?: boolean;
  selected?: boolean;
  showAssignee: boolean;
  onToggleSelect?: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onViewEmail: () => void;
  onAssign: (taskId: string, assignee: string) => void;
  onNotify: () => void;
  startTransition: (cb: () => void) => void;
}) {
  const done = task.status === "DONE";
  const cancelled = task.status === "CANCELLED";
  const declined = task.status === "DECLINED";
  const hasSourceEmail = Boolean(task.sourceBody || task.sourceSubject);
  const confirm = useConfirm();
  const canNotify = Boolean(task.assignee);
  const urgent = isUrgentTask(task);

  return (
    <tr
      className={urgent ? "task-urgent" : undefined}
      style={{
        borderBottom: `1px solid ${LIGHT.border}`,
        opacity: done || cancelled ? 0.78 : 1,
        background: selected ? LIGHT.accentSoft : done || cancelled ? LIGHT.appBg : LIGHT.panel,
      }}
    >
      <td style={{ padding: "10px 8px", width: 36, verticalAlign: "top" }}>
        {selectable ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select "${task.title}"`}
            style={{ width: 16, height: 16, cursor: "pointer", accentColor: LIGHT.accent }}
          />
        ) : (
          <input
            type="checkbox"
            checked={done}
            disabled={busy || cancelled || declined}
            onChange={(e) =>
              startTransition(() => void toggleTaskDoneAction(task.id, e.target.checked))
            }
            aria-label={`Mark ${task.title} done`}
          />
        )}
      </td>
      <td style={{ padding: "10px 12px", verticalAlign: "top", minWidth: 220 }}>
        <button
          type="button"
          onClick={selectable ? onToggleSelect : onOpen}
          style={{
            display: "block",
            width: "100%",
            padding: 0,
            border: "none",
            background: "transparent",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              color: done ? LIGHT.textMuted : LIGHT.text,
              textDecoration: done ? "line-through" : "none",
              lineHeight: 1.4,
            }}
          >
            {task.title}
          </div>
          {task.description ? (
            <div
              style={{
                fontSize: "0.75rem",
                color: LIGHT.textSecondary,
                marginTop: 3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 420,
              }}
              title={task.description}
            >
              {task.description}
            </div>
          ) : null}
          {task.sourceSubject ? (
            <div
              style={{
                fontSize: "0.7rem",
                color: LIGHT.textMuted,
                marginTop: 3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 420,
              }}
              title={task.sourceSubject}
            >
              Re: {task.sourceSubject}
            </div>
          ) : null}
        </button>
      </td>
      {showAssignee ? (
        <td style={{ padding: "10px 12px", verticalAlign: "top", width: 90 }}>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: task.assignee ? "#4338ca" : LIGHT.textMuted,
            }}
          >
            {task.assignee ?? "—"}
          </span>
        </td>
      ) : null}
      <td
        style={{
          padding: "10px 12px",
          verticalAlign: "top",
          width: 140,
          fontSize: "0.75rem",
          color: LIGHT.textSecondary,
        }}
      >
        {task.contactLabel ?? "—"}
      </td>
      <td style={{ padding: "10px 12px", verticalAlign: "top", width: 90 }}>
        <span style={priorityBadge(task.priority)}>{task.priority}</span>
      </td>
      <td style={{ padding: "10px 12px", verticalAlign: "top", width: 110 }}>
        <span style={statusChip(task.status)}>{STATUS_LABEL[task.status] ?? task.status}</span>
      </td>
      <td
        style={{
          padding: "10px 12px",
          verticalAlign: "top",
          width: 100,
          fontSize: "0.75rem",
          color: LIGHT.textMuted,
          whiteSpace: "nowrap",
        }}
      >
        {task.dueDateLabel ?? "—"}
      </td>
      <td style={{ padding: "10px 8px", verticalAlign: "top", width: 170 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
            title={
              canNotify
                ? `Notify ${task.assignee}`
                : "Assign a team member first"
            }
            disabled={busy || !canNotify}
            onClick={onNotify}
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
      </td>
      {!selectable ? (
        <td style={{ padding: "10px 8px", verticalAlign: "top", width: 100 }}>
          <div style={{ display: "flex", gap: "0.3rem" }}>
            {hasSourceEmail && (
              <button
                type="button"
                title="View source email"
                onClick={onViewEmail}
                style={{ ...iconBtn(LIGHT.textSecondary), width: 28, height: 28 }}
              >
                📧
              </button>
            )}
            <button
              type="button"
              title="Edit task"
              onClick={onEdit}
              style={{ ...iconBtn(LIGHT.textSecondary), width: 28, height: 28 }}
            >
              <EditIcon />
            </button>
            <button
              type="button"
              title="Delete task"
              disabled={busy}
              onClick={async () => {
                const ok = await confirm({
                  title: "Delete task",
                  message: `Delete "${task.title}"? This can't be undone.`,
                  confirmLabel: "Delete",
                  danger: true,
                });
                if (!ok) return;
                startTransition(() => void deleteTaskAction(task.id));
              }}
              style={{ ...iconBtn(LIGHT.danger), width: 28, height: 28 }}
            >
              <TrashIcon />
            </button>
          </div>
        </td>
      ) : null}
    </tr>
  );
}

function Empty({ query, filter }: { query: string; filter: Filter }) {
  const searching = query.trim().length > 0 || filter !== "ALL";
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
      <div style={{ fontSize: "2rem", marginBottom: "0.4rem" }}>📋</div>
      <div style={{ fontWeight: 600, color: LIGHT.text }}>
        {searching ? "No matching tasks" : "No tasks yet"}
      </div>
      <p style={{ fontSize: "0.85rem", marginTop: "0.3rem" }}>
        {searching
          ? "Try a different search or filter."
          : "Add one above, or they appear automatically from your incoming email."}
      </p>
    </div>
  );
}

function checkStyle(done: boolean): CSSProperties {
  return {
    flexShrink: 0,
    width: 22,
    height: 22,
    marginTop: 2,
    borderRadius: "50%",
    border: `2px solid ${done ? LIGHT.success : LIGHT.borderStrong}`,
    background: done ? LIGHT.success : "transparent",
    color: "#fff",
    fontSize: "0.7rem",
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
