"use client";

import { useMemo, useState, useTransition } from "react";
import { LIGHT } from "../../zoho/_components/ui";
import { useConfirm } from "../../_components/ConfirmDialog";
import type { MeetingRow } from "./types";
import { deleteMeetingAction, setMeetingStatusAction } from "../actions";
import { MeetingFormModal } from "./MeetingFormModal";
import { Pagination } from "./Pagination";
import { KanbanBoard, type KanbanColumn } from "./KanbanBoard";
import {
  TrashIcon,
  EditIcon,
  SearchIcon,
  PlusIcon,
  ListIcon,
  BoardIcon,
} from "./icons";
import { LIGHT as L } from "../../zoho/_components/ui";
import {
  cardStyle,
  metaRow,
  inputStyle,
  primaryBtn,
  iconBtn,
  statusChip,
  chipStyle,
  chipCount,
  segmentGroup,
  segmentBtn,
} from "./planner-ui";

type View = "list" | "board";

const BOARD_COLUMNS: KanbanColumn[] = [
  { key: "SCHEDULED", label: "Scheduled", accent: L.accent },
  { key: "COMPLETED", label: "Completed", accent: L.success },
  { key: "CANCELLED", label: "Cancelled", accent: L.danger },
];

/** SCHEDULED and CONFIRMED share the "Scheduled" column. */
function meetingColumn(status: string): string {
  if (status === "CONFIRMED") return "SCHEDULED";
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "CANCELLED") return "CANCELLED";
  return "SCHEDULED";
}

type Filter = "ALL" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
];

const PAGE_SIZE = 6;

export function MeetingsPanel({ meetings }: { meetings: MeetingRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [view, setView] = useState<View>("board");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ meeting: MeetingRow | null } | null>(null);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { ALL: meetings.length, SCHEDULED: 0, COMPLETED: 0, CANCELLED: 0 };
    for (const m of meetings) {
      if (m.status === "SCHEDULED" || m.status === "CONFIRMED") c.SCHEDULED += 1;
      else if (m.status === "COMPLETED") c.COMPLETED += 1;
      else if (m.status === "CANCELLED") c.CANCELLED += 1;
    }
    return c;
  }, [meetings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return meetings.filter((m) => {
      if (filter === "SCHEDULED" && !(m.status === "SCHEDULED" || m.status === "CONFIRMED")) return false;
      if (filter === "COMPLETED" && m.status !== "COMPLETED") return false;
      if (filter === "CANCELLED" && m.status !== "CANCELLED") return false;
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        (m.description ?? "").toLowerCase().includes(q) ||
        (m.location ?? "").toLowerCase().includes(q) ||
        (m.contactLabel ?? "").toLowerCase().includes(q)
      );
    });
  }, [meetings, filter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const resetPage = () => setPage(1);

  return (
    <div style={{ maxWidth: 1650, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: LIGHT.textMuted, display: "flex" }}>
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPage();
            }}
            placeholder="Search meetings…"
            style={{ ...inputStyle, paddingLeft: "2rem" }}
          />
        </div>
        <div style={segmentGroup} role="tablist" aria-label="View">
          <button
            type="button"
            onClick={() => setView("list")}
            style={segmentBtn(view === "list")}
            aria-pressed={view === "list"}
          >
            <ListIcon /> List
          </button>
          <button
            type="button"
            onClick={() => setView("board")}
            style={segmentBtn(view === "board")}
            aria-pressed={view === "board"}
          >
            <BoardIcon /> Board
          </button>
        </div>
        <button type="button" onClick={() => setForm({ meeting: null })} style={primaryBtn}>
          <PlusIcon /> New Meeting
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setFilter(key);
                resetPage();
              }}
              style={chipStyle(active)}
            >
              {label}
              <span style={chipCount(active)}>{counts[key]}</span>
            </button>
          );
        })}
      </div>

      {view === "board" ? (
        filtered.length === 0 ? (
          <Empty query={query} filter={filter} />
        ) : (
          <KanbanBoard
            columns={BOARD_COLUMNS}
            items={filtered}
            columnOf={(m) => meetingColumn(m.status)}
            onMove={(id, status) =>
              startTransition(() => void setMeetingStatusAction(id, status))
            }
            emptyLabel="No meetings"
            renderCard={(m) => (
              <BoardMeetingCard
                meeting={m}
                busy={pending}
                onEdit={() => setForm({ meeting: m })}
                startTransition={startTransition}
              />
            )}
          />
        )
      ) : (
        <>
          {visible.length === 0 ? (
            <Empty query={query} filter={filter} />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                gap: "0.7rem",
              }}
            >
              {visible.map((m) => (
                <MeetingItem
                  key={m.id}
                  meeting={m}
                  busy={pending}
                  onEdit={() => setForm({ meeting: m })}
                  startTransition={startTransition}
                />
              ))}
            </div>
          )}

          <Pagination
            page={safePage}
            pageCount={pageCount}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />
        </>
      )}

      {form && <MeetingFormModal initial={form.meeting} onClose={() => setForm(null)} />}
    </div>
  );
}

function MeetingItem({
  meeting,
  busy,
  onEdit,
  startTransition,
}: {
  meeting: MeetingRow;
  busy: boolean;
  onEdit: () => void;
  startTransition: (cb: () => void) => void;
}) {
  const confirm = useConfirm();
  return (
    <div className="tk-card" style={cardStyle}>
      <div
        style={{
          flexShrink: 0,
          width: 38,
          height: 38,
          borderRadius: 9,
          background: LIGHT.accentSoft,
          color: LIGHT.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.05rem",
        }}
      >
        📅
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: "0.95rem", color: LIGHT.text }}>
            {meeting.title}
          </span>
          <span style={statusChip(meeting.status)}>{meeting.status}</span>
        </div>
        {meeting.description && (
          <p style={{ margin: "0.3rem 0 0", fontSize: "0.83rem", color: LIGHT.textSecondary }}>
            {meeting.description}
          </p>
        )}
        <div style={metaRow}>
          <span>🕒 {meeting.startLabel}</span>
          {meeting.location && <span>📍 {meeting.location}</span>}
          {meeting.contactLabel && <span>👤 {meeting.contactLabel}</span>}
        </div>
        {meeting.attendees.length > 0 && (
          <div style={{ ...metaRow, marginTop: "0.35rem" }}>
            <span>👥 {meeting.attendees.join(", ")}</span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0 }}>
        <button type="button" className="tk-icon-btn" title="Edit meeting" onClick={onEdit} style={iconBtn(LIGHT.textSecondary)}>
          <EditIcon />
        </button>
        <button
          type="button"
          className="tk-icon-btn"
          title="Delete meeting"
          disabled={busy}
          onClick={async () => {
            const ok = await confirm({
              title: "Delete meeting",
              message: `Delete "${meeting.title}"? This can't be undone.`,
              confirmLabel: "Delete",
              danger: true,
            });
            if (!ok) return;
            startTransition(() => void deleteMeetingAction(meeting.id));
          }}
          style={iconBtn(LIGHT.danger)}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function BoardMeetingCard({
  meeting,
  busy,
  onEdit,
  startTransition,
}: {
  meeting: MeetingRow;
  busy: boolean;
  onEdit: () => void;
  startTransition: (cb: () => void) => void;
}) {
  const confirm = useConfirm();
  return (
    <div
      className="tk-card"
      style={{ ...cardStyle, flexDirection: "column", alignItems: "stretch", gap: "0.5rem", padding: "0.7rem 0.8rem", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}
    >
      <div style={{ fontWeight: 700, fontSize: "0.88rem", color: LIGHT.text }}>
        📅 {meeting.title}
      </div>

      {meeting.description && (
        <p
          style={{
            margin: 0,
            fontSize: "0.79rem",
            color: LIGHT.textSecondary,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {meeting.description}
        </p>
      )}

      <div style={{ ...metaRow, margin: 0 }}>
        <span>🕒 {meeting.startLabel}</span>
        {meeting.location && <span>📍 {meeting.location}</span>}
        {meeting.contactLabel && <span>👤 {meeting.contactLabel}</span>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <span style={statusChip(meeting.status)}>{meeting.status}</span>
        <div style={{ display: "flex", gap: "0.35rem", marginLeft: "auto" }}>
          <button
            type="button"
            className="tk-icon-btn"
            title="Edit meeting"
            onClick={onEdit}
            style={{ ...iconBtn(LIGHT.textSecondary), width: 26, height: 26 }}
          >
            <EditIcon />
          </button>
          <button
            type="button"
            className="tk-icon-btn"
            title="Delete meeting"
            disabled={busy}
            onClick={async () => {
              const ok = await confirm({
                title: "Delete meeting",
                message: `Delete "${meeting.title}"? This can't be undone.`,
                confirmLabel: "Delete",
                danger: true,
              });
              if (!ok) return;
              startTransition(() => void deleteMeetingAction(meeting.id));
            }}
            style={{ ...iconBtn(LIGHT.danger), width: 26, height: 26 }}
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>
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
      <div style={{ fontSize: "2rem", marginBottom: "0.4rem" }}>📅</div>
      <div style={{ fontWeight: 600, color: LIGHT.text }}>
        {searching ? "No matching meetings" : "No meetings yet"}
      </div>
      <p style={{ fontSize: "0.85rem", marginTop: "0.3rem" }}>
        {searching
          ? "Try a different search or filter."
          : "Add one above, or they appear automatically from your incoming email."}
      </p>
    </div>
  );
}
