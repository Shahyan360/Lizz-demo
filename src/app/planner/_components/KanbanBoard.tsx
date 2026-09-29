"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { LIGHT } from "../../zoho/_components/ui";
import { useIsMobile } from "../../_hooks/useIsMobile";

/**
 * Generic Kanban board with native HTML5 drag-and-drop between columns.
 * Callers supply the column definitions, resolve each item to a column key,
 * render the card body, and handle the move (status change) on drop.
 */

export interface KanbanColumn {
  key: string;
  label: string;
  accent: string; // colored dot for the column header
}

export function KanbanBoard<T extends { id: string }>({
  columns,
  items,
  columnOf,
  renderCard,
  onMove,
  emptyLabel = "Nothing here",
}: {
  columns: KanbanColumn[];
  items: T[];
  columnOf: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onMove: (id: string, columnKey: string) => void;
  emptyLabel?: string;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const isMobile = useIsMobile(768);
  const colMin = isMobile ? 220 : 240;

  const grouped = new Map<string, T[]>(columns.map((c) => [c.key, []]));
  for (const item of items) {
    const bucket = grouped.get(columnOf(item));
    if (bucket) bucket.push(item);
  }

  const endDrag = () => {
    setDragId(null);
    setOverCol(null);
  };

  return (
    <div
      className="kanban-scroll"
      style={{
        ...boardStyle,
        padding: isMobile ? "0.65rem" : "0.9rem",
        gap: isMobile ? "0.65rem" : "0.85rem",
        scrollSnapType: isMobile ? "x mandatory" : undefined,
      }}
    >
      {columns.map((col) => {
        const colItems = grouped.get(col.key) ?? [];
        const isOver = overCol === col.key;
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setOverCol(col.key);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setOverCol((c) => (c === col.key ? null : c));
            }}
            onDrop={() => {
              if (dragId) onMove(dragId, col.key);
              endDrag();
            }}
            style={{
              ...columnStyle(isOver, colMin),
              scrollSnapAlign: isMobile ? "start" : undefined,
            }}
          >
            <div style={columnHeader}>
              <span style={dot(col.accent)} />
              <span style={{ fontWeight: 700, fontSize: "0.82rem", color: LIGHT.text }}>
                {col.label}
              </span>
              <span style={countPill}>{colItems.length}</span>
            </div>

            <div style={columnBody}>
              {colItems.length === 0 ? (
                <div style={emptyCol}>{isOver ? "Drop here" : emptyLabel}</div>
              ) : (
                colItems.map((item) => (
                  <div
                    key={item.id}
                    draggable={!isMobile}
                    onDragStart={() => setDragId(item.id)}
                    onDragEnd={endDrag}
                    style={{
                      cursor: isMobile ? "default" : "grab",
                      opacity: dragId === item.id ? 0.45 : 1,
                    }}
                  >
                    {renderCard(item)}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const boardStyle: CSSProperties = {
  display: "flex",
  gap: "0.85rem",
  alignItems: "flex-start",
  overflowX: "auto",
  background: LIGHT.panel,
  border: `1px solid ${LIGHT.border}`,
  borderRadius: 14,
  padding: "0.9rem",
  WebkitOverflowScrolling: "touch",
};

function columnStyle(isOver: boolean, colMin: number): CSSProperties {
  return {
    flex: `0 0 ${colMin}px`,
    minWidth: colMin,
    maxWidth: colMin + 40,
    width: colMin,
    background: isOver ? LIGHT.accentSoft : LIGHT.panelAlt,
    border: `1px solid ${isOver ? LIGHT.accent : LIGHT.border}`,
    borderRadius: 12,
    padding: "0.7rem",
    transition: "background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
  };
}

const columnHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.45rem",
  marginBottom: "0.7rem",
  padding: "0 0.15rem",
};

const columnBody: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.6rem",
  minHeight: 60,
};

function dot(color: string): CSSProperties {
  return { width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 };
}

const countPill: CSSProperties = {
  marginLeft: "auto",
  fontSize: "0.7rem",
  fontWeight: 700,
  padding: "0.05rem 0.45rem",
  borderRadius: 999,
  background: LIGHT.panel,
  color: LIGHT.textSecondary,
  border: `1px solid ${LIGHT.border}`,
};

const emptyCol: CSSProperties = {
  fontSize: "0.76rem",
  color: LIGHT.textMuted,
  textAlign: "center",
  padding: "1.2rem 0.5rem",
  border: `1px dashed ${LIGHT.border}`,
  borderRadius: 9,
};
