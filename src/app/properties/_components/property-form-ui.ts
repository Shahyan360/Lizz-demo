import type { CSSProperties } from "react";
import { LIGHT } from "../../zoho/_components/ui";

/** Shared micro-styles used across all property form steps. */

export const sectionTitle: CSSProperties = {
  margin: "0 0 1.25rem",
  fontSize: "1rem",
  fontWeight: 700,
  color: LIGHT.text,
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

export const fieldGroup: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

export const labelStyle: CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 700,
  color: LIGHT.textSecondary,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  borderRadius: 8,
  border: `1px solid ${LIGHT.borderStrong}`,
  background: "#fff",
  color: LIGHT.text,
  fontSize: "0.88rem",
  outline: "none",
  boxSizing: "border-box",
};

export const selectStyle: CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  minHeight: 90,
  lineHeight: 1.5,
};

export const grid2: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "1rem",
};

export const grid3: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: "1rem",
};

export const subheading: CSSProperties = {
  fontSize: "0.78rem",
  fontWeight: 700,
  color: LIGHT.textSecondary,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  margin: "1.25rem 0 0.75rem",
  paddingBottom: "0.35rem",
  borderBottom: `1px solid ${LIGHT.border}`,
};

export const requiredStar: CSSProperties = {
  color: LIGHT.danger,
  marginLeft: "0.15rem",
};

export const hint: CSSProperties = {
  fontSize: "0.72rem",
  color: LIGHT.textMuted,
  marginTop: "0.2rem",
};

export const checkboxRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  fontSize: "0.85rem",
  color: LIGHT.text,
  cursor: "pointer",
  userSelect: "none",
};
