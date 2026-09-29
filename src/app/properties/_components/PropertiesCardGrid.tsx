"use client";

import { LIGHT } from "../../zoho/_components/ui";
import type { PropertyRow } from "./PropertiesTable";

export function PropertiesCardGrid({ rows, onSelectProperty }: { rows: PropertyRow[]; onSelectProperty: (id: string) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.9rem" }}>
      {rows.map((row) => (
        <button key={row.id} type="button" onClick={() => onSelectProperty(row.id)} style={{ textAlign: "left", cursor: "pointer", background: LIGHT.panel, border: `1px solid ${LIGHT.border}`, borderRadius: 12, padding: "1rem", color: LIGHT.text, boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}>
          <div style={{ fontWeight: 800, fontSize: "1rem" }}>{row.name}</div>
          {row.managementCompany && <div style={{ marginTop: "0.2rem", color: LIGHT.textMuted, fontSize: "0.78rem" }}>{row.managementCompany}</div>}
          <div style={{ marginTop: "0.8rem", color: LIGHT.textSecondary, fontSize: "0.82rem" }}>{[row.city, row.state].filter(Boolean).join(", ") || "Location not recorded"}</div>
          <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", marginTop: "0.8rem" }}>
            <span style={badgeStyle}>{formatEnum(row.propertyType)}</span>
            <span style={badgeStyle}>{row.numberOfUnits == null ? "Units unknown" : `${row.numberOfUnits} units`}</span>
            <span style={badgeStyle}>{formatEnum(row.qualificationStatus ?? "UNASSIGNED")}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function formatEnum(value: string) { return value.toLowerCase().split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "); }
const badgeStyle = { fontSize: "0.7rem", padding: "0.2rem 0.45rem", borderRadius: 999, background: LIGHT.panelAlt, border: `1px solid ${LIGHT.border}`, color: LIGHT.textSecondary };
