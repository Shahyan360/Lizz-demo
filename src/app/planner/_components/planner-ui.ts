import type { CSSProperties } from "react";
import { LIGHT } from "../../zoho/_components/ui";

/** Shared styles + badge helpers for the planner panels, forms, and cards. */

export const cardStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.75rem",
  background: LIGHT.panel,
  border: `1px solid ${LIGHT.border}`,
  borderRadius: 12,
  padding: "0.85rem 1rem",
  minWidth: 0,
  width: "100%",
  boxSizing: "border-box",
};

export const metaRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.85rem",
  marginTop: "0.5rem",
  fontSize: "0.76rem",
  color: LIGHT.textMuted,
  alignItems: "center",
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  borderRadius: 8,
  border: `1px solid ${LIGHT.borderStrong}`,
  background: "#fff",
  color: LIGHT.text,
  fontSize: "0.88rem",
  outline: "none",
};

export const fieldLabel: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  fontSize: "0.72rem",
  fontWeight: 600,
  color: LIGHT.textSecondary,
};

export const primaryBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  padding: "0.5rem 1rem",
  borderRadius: 8,
  border: "none",
  background: LIGHT.accent,
  color: "#fff",
  fontSize: "0.85rem",
  fontWeight: 700,
  cursor: "pointer",
};

export const ghostBtn: CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: 8,
  border: `1px solid ${LIGHT.border}`,
  background: LIGHT.panel,
  color: LIGHT.textSecondary,
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
};

export function iconBtn(color: string): CSSProperties {
  return {
    flexShrink: 0,
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    border: `1px solid ${LIGHT.border}`,
    background: LIGHT.panel,
    color,
    cursor: "pointer",
  };
}

const PRIORITY_COLORS: Record<string, { bg: string; fg: string }> = {
  URGENT: { bg: LIGHT.dangerSoft, fg: LIGHT.danger },
  HIGH: { bg: "#fff2e0", fg: "#c2620e" },
  MEDIUM: { bg: LIGHT.accentSoft, fg: LIGHT.accent },
  LOW: { bg: LIGHT.hover, fg: LIGHT.textSecondary },
};

export function priorityBadge(priority: string): CSSProperties {
  const c = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.MEDIUM;
  return {
    flexShrink: 0,
    fontSize: "0.65rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
    padding: "0.14rem 0.5rem",
    borderRadius: 999,
    background: c.bg,
    color: c.fg,
  };
}

/** Open urgent tasks get a blinking red border in the planner UI. */
export function isUrgentTask(task: { priority: string; status: string }): boolean {
  if (task.priority !== "URGENT") return false;
  return (
    task.status !== "DONE" &&
    task.status !== "CANCELLED" &&
    task.status !== "DECLINED"
  );
}

export function statusChip(status: string): CSSProperties {
  const done = status === "DONE" || status === "COMPLETED";
  const cancelled = status === "CANCELLED" || status === "REJECTED";
  const declined = status === "DECLINED";
  const active = status === "IN_PROGRESS" || status === "CONFIRMED";
  return {
    fontSize: "0.65rem",
    fontWeight: 700,
    padding: "0.1rem 0.5rem",
    borderRadius: 999,
    background: done
      ? LIGHT.successSoft
      : declined
        ? "#f3e8ff"
        : cancelled
          ? LIGHT.dangerSoft
          : active
            ? LIGHT.accentSoft
            : LIGHT.hover,
    color: done
      ? LIGHT.success
      : declined
        ? "#7c3aed"
        : cancelled
          ? LIGHT.danger
          : active
            ? LIGHT.accent
            : LIGHT.textSecondary,
  };
}

export function chipStyle(active: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.4rem 0.85rem",
    borderRadius: 999,
    border: `1px solid ${active ? LIGHT.accent : LIGHT.border}`,
    background: active ? LIGHT.accentSoft : LIGHT.panel,
    color: active ? LIGHT.accent : LIGHT.textSecondary,
    fontSize: "0.8rem",
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
  };
}

export const segmentGroup: CSSProperties = {
  display: "inline-flex",
  padding: 3,
  borderRadius: 9,
  border: `1px solid ${LIGHT.border}`,
  background: LIGHT.panelAlt,
  gap: 2,
};

export function segmentBtn(active: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
    padding: "0.35rem 0.7rem",
    borderRadius: 7,
    border: "none",
    background: active ? LIGHT.panel : "transparent",
    color: active ? LIGHT.accent : LIGHT.textSecondary,
    boxShadow: active ? "0 1px 3px rgba(15,23,42,0.1)" : "none",
    fontSize: "0.8rem",
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
  };
}

export function chipCount(active: boolean): CSSProperties {
  return {
    fontSize: "0.7rem",
    fontWeight: 700,
    padding: "0.02rem 0.38rem",
    borderRadius: 999,
    background: active ? LIGHT.accent : LIGHT.hover,
    color: active ? "#fff" : LIGHT.textSecondary,
  };
}

export const filterBar: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.55rem",
  padding: "0.7rem 0.9rem",
  marginBottom: "1rem",
  background: LIGHT.panel,
  border: `1px solid ${LIGHT.border}`,
  borderRadius: 10,
};

export const filterRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.85rem",
  flexWrap: "wrap",
};

export const filterLabel: CSSProperties = {
  fontSize: "0.68rem",
  fontWeight: 700,
  color: LIGHT.textMuted,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  whiteSpace: "nowrap",
  // minWidth: 52,
};

export const filterSelect: CSSProperties = {
  width: "auto",
  minWidth: 148,
  padding: "0.42rem 0.65rem",
  borderRadius: 8,
  border: `1px solid ${LIGHT.borderStrong}`,
  background: "#fff",
  color: LIGHT.text,
  fontSize: "0.82rem",
  outline: "none",
  cursor: "pointer",
};

export const filterMeta: CSSProperties = {
  fontSize: "0.78rem",
  color: LIGHT.textMuted,
};

export const filterClearBtn: CSSProperties = {
  border: "none",
  background: "transparent",
  color: LIGHT.accent,
  fontSize: "0.78rem",
  fontWeight: 600,
  cursor: "pointer",
  padding: "0.25rem 0.4rem",
  marginLeft: "auto",
};
