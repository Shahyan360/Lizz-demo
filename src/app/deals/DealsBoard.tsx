"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { DealStage } from "@prisma/client";
import { LIGHT } from "../zoho/_components/ui";
import { APP_HEADER_HEIGHT } from "../_components/app-nav";
import { ModalShell } from "../planner/_components/ModalShell";
import { inputStyle, fieldLabel, primaryBtn, ghostBtn } from "../planner/_components/planner-ui";
import { useToast } from "../_components/Toast";
import { useConfirm } from "../_components/ConfirmDialog";
import { PipelineIcon, TrashIcon } from "../_components/icons";
import {
  createDealAction,
  updateDealStageAction,
  deleteDealAction,
  deleteDealsAction,
} from "./actions";

export interface DealRow {
  id: string;
  title: string;
  stage: DealStage;
  value: number | null;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  sourceSubject: string | null;
  updatedAtLabel: string;
}

const COLUMNS: { stage: DealStage; label: string; color: string }[] = [
  { stage: "NEW", label: "New", color: LIGHT.accent },
  { stage: "QUOTED", label: "Quoted", color: "#c2620e" },
  { stage: "WON", label: "Won", color: LIGHT.success },
  { stage: "LOST", label: "Lost", color: LIGHT.danger },
];

const money = (v: number | null) =>
  v == null ? null : `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export function DealsBoard({ initial }: { initial: DealRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [deals, setDeals] = useState<DealRow[]>(initial);
  const [addOpen, setAddOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, start] = useTransition();

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = await confirm({
      title: "Delete deals",
      message: `Delete ${ids.length} deal${ids.length === 1 ? "" : "s"}? This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const prev = deals;
    setDeals((ds) => ds.filter((d) => !selected.has(d.id)));
    exitSelectMode();
    start(async () => {
      const res = await deleteDealsAction(ids);
      if (!res.ok) {
        setDeals(prev);
        toast.error(res.error ?? "Could not delete deals.");
      } else {
        toast.success(`${ids.length} deal${ids.length === 1 ? "" : "s"} deleted.`);
      }
    });
  }

  function moveDeal(id: string, stage: DealStage) {
    const prev = deals;
    setDeals((ds) => ds.map((d) => (d.id === id ? { ...d, stage } : d)));
    start(async () => {
      const res = await updateDealStageAction(id, stage);
      if (!res.ok) {
        setDeals(prev);
        toast.error(res.error ?? "Could not move deal.");
      }
    });
  }

  async function removeDeal(deal: DealRow) {
    const ok = await confirm({
      title: "Delete deal",
      message: `Delete "${deal.title}"? This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const prev = deals;
    setDeals((ds) => ds.filter((d) => d.id !== deal.id));
    start(async () => {
      const res = await deleteDealAction(deal.id);
      if (!res.ok) {
        setDeals(prev);
        toast.error(res.error ?? "Could not delete deal.");
      } else {
        toast.success("Deal deleted.");
      }
    });
  }

  const openValue = deals
    .filter((d) => d.stage === "NEW" || d.stage === "QUOTED")
    .reduce((sum, d) => sum + (d.value ?? 0), 0);
  const wonValue = deals
    .filter((d) => d.stage === "WON")
    .reduce((sum, d) => sum + (d.value ?? 0), 0);

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
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          padding: "1rem 1.25rem",
          borderBottom: `1px solid ${LIGHT.border}`,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: LIGHT.text, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <PipelineIcon width={22} height={22} />
            Pipeline
          </h1>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.82rem", color: LIGHT.textSecondary }}>
            {deals.length} deal{deals.length === 1 ? "" : "s"} ·{" "}
            <strong style={{ color: LIGHT.text }}>{money(openValue) ?? "$0"}</strong> open ·{" "}
            <strong style={{ color: LIGHT.success }}>{money(wonValue) ?? "$0"}</strong> won
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <button
            type="button"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            style={selectMode ? primaryBtn : ghostBtn}
          >
            {selectMode ? "Done" : "Select"}
          </button>
          <button type="button" onClick={() => setAddOpen(true)} style={primaryBtn}>
            + New deal
          </button>
        </div>
      </div>

      {/* Bulk-selection action bar */}
      {selectMode && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.85rem",
            flexWrap: "wrap",
            padding: "0.6rem 1.25rem",
            background: LIGHT.accentSoft,
            borderBottom: `1px solid ${LIGHT.accent}33`,
          }}
        >
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: LIGHT.text }}>
            Tap deals to select
          </span>
          <span style={{ fontSize: "0.82rem", color: LIGHT.textSecondary }}>
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={bulkDelete}
            disabled={selected.size === 0}
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.45rem 0.9rem",
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "#fff",
              background: selected.size === 0 ? LIGHT.textMuted : LIGHT.danger,
              border: "none",
              borderRadius: 8,
              cursor: selected.size === 0 ? "default" : "pointer",
            }}
          >
            <TrashIcon /> Delete {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>
      )}

      {/* Board */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          gap: "0.85rem",
          padding: "1rem 1.25rem",
          overflowX: "auto",
        }}
      >
        {COLUMNS.map((col) => {
          const colDeals = deals.filter((d) => d.stage === col.stage);
          const total = colDeals.reduce((s, d) => s + (d.value ?? 0), 0);
          return (
            <div
              key={col.stage}
              style={{
                flex: "1 0 240px",
                minWidth: 240,
                maxWidth: 340,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.1rem 0.35rem 0.6rem",
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: 3, background: col.color }} />
                <span style={{ fontSize: "0.82rem", fontWeight: 800, color: LIGHT.text }}>
                  {col.label}
                </span>
                <span style={{ fontSize: "0.74rem", color: LIGHT.textMuted, fontWeight: 700 }}>
                  {colDeals.length}
                </span>
                {total > 0 && (
                  <span style={{ marginLeft: "auto", fontSize: "0.74rem", color: LIGHT.textSecondary, fontWeight: 700 }}>
                    {money(total)}
                  </span>
                )}
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                  background: LIGHT.panelAlt,
                  border: `1px solid ${LIGHT.border}`,
                  borderRadius: 12,
                  padding: "0.6rem",
                }}
              >
                {colDeals.length === 0 ? (
                  <p style={{ color: LIGHT.textMuted, fontSize: "0.78rem", textAlign: "center", padding: "1rem 0" }}>
                    No deals
                  </p>
                ) : (
                  colDeals.map((d) => (
                    <DealCard
                      key={d.id}
                      deal={d}
                      selectable={selectMode}
                      selected={selected.has(d.id)}
                      onToggleSelect={() => toggleSelect(d.id)}
                      onMove={(stage) => moveDeal(d.id, stage)}
                      onDelete={() => removeDeal(d)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {addOpen && (
        <AddDealModal
          onClose={() => setAddOpen(false)}
          onDone={() => {
            setAddOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function DealCard({
  deal,
  selectable = false,
  selected = false,
  onToggleSelect,
  onMove,
  onDelete,
}: {
  deal: DealRow;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onMove: (stage: DealStage) => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={selectable ? onToggleSelect : undefined}
      style={{
        background: selectable && selected ? LIGHT.accentSoft : LIGHT.panel,
        border: `1px solid ${selectable && selected ? LIGHT.accent : LIGHT.border}`,
        borderRadius: 10,
        padding: "0.7rem 0.75rem",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        cursor: selectable ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.4rem", alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", minWidth: 0 }}>
          {selectable && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect?.()}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select "${deal.title}"`}
              style={{ width: 16, height: 16, marginTop: 2, cursor: "pointer", flexShrink: 0, accentColor: LIGHT.accent }}
            />
          )}
          <div style={{ fontSize: "0.86rem", fontWeight: 600, color: LIGHT.text, lineHeight: 1.35 }}>
            {deal.title}
          </div>
        </div>
        {!selectable && (
          <button
            type="button"
            onClick={onDelete}
            title="Delete deal"
            aria-label="Delete deal"
            style={{
              border: "none",
              background: "transparent",
              color: LIGHT.textMuted,
              cursor: "pointer",
              fontSize: "1rem",
              lineHeight: 1,
              padding: 0,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        )}
      </div>

      {deal.value != null && (
        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: LIGHT.success, marginTop: "0.3rem" }}>
          {money(deal.value)}
        </div>
      )}

      {(deal.contactName || deal.contactEmail) && (
        <div style={{ marginTop: "0.35rem", fontSize: "0.76rem", color: LIGHT.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {deal.contactId && !selectable ? (
            <Link href={`/contacts/${deal.contactId}`} style={{ color: LIGHT.accent, textDecoration: "none" }}>
              {deal.contactName || deal.contactEmail}
            </Link>
          ) : (
            deal.contactName || deal.contactEmail
          )}
        </div>
      )}

      {!selectable && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.55rem" }}>
          <select
            value={deal.stage}
            onChange={(e) => onMove(e.target.value as DealStage)}
            aria-label="Move deal stage"
            style={{
              flex: 1,
              fontSize: "0.75rem",
              padding: "0.25rem 0.4rem",
              borderRadius: 7,
              border: `1px solid ${LIGHT.border}`,
              background: "#fff",
              color: LIGHT.textSecondary,
              cursor: "pointer",
            }}
          >
            {COLUMNS.map((c) => (
              <option key={c.stage} value={c.stage}>
                {c.label}
              </option>
            ))}
          </select>
          <span style={{ fontSize: "0.68rem", color: LIGHT.textMuted, whiteSpace: "nowrap" }}>
            {deal.updatedAtLabel}
          </span>
        </div>
      )}
    </div>
  );
}

function AddDealModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [value, setValue] = useState("");
  const [stage, setStage] = useState<DealStage>("NEW");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createDealAction({
        title,
        contactEmail: contactEmail || undefined,
        value: value.trim() ? Number(value) : null,
        stage,
      });
      if (res.ok) {
        toast.success("Deal added.");
        onDone();
      } else {
        setError(res.error ?? "Could not create deal.");
      }
    });
  }

  return (
    <ModalShell title="New deal" onClose={onClose} busy={pending}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
        <label style={fieldLabel}>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            placeholder="e.g. 4m sliding gate install"
            style={inputStyle}
          />
        </label>
        <label style={fieldLabel}>
          Contact email (optional)
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="links the deal to an existing contact"
            style={inputStyle}
          />
        </label>
        <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
          <label style={{ ...fieldLabel, flex: 1, minWidth: 130 }}>
            Value ($)
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="optional"
              style={inputStyle}
            />
          </label>
          <label style={{ ...fieldLabel, flex: 1, minWidth: 130 }}>
            Stage
            <select value={stage} onChange={(e) => setStage(e.target.value as DealStage)} style={inputStyle}>
              {COLUMNS.map((c) => (
                <option key={c.stage} value={c.stage}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <div style={{ fontSize: "0.8rem", color: LIGHT.danger }}>{error}</div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
          <button type="button" onClick={onClose} disabled={pending} style={ghostBtn}>
            Cancel
          </button>
          <button type="submit" disabled={pending} style={{ ...primaryBtn, opacity: pending ? 0.6 : 1 }}>
            {pending ? "Adding…" : "Add deal"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
