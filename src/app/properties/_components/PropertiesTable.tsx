"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useTransition, type CSSProperties } from "react";
import { LIGHT } from "../../zoho/_components/ui";
import { useToast } from "../../_components/Toast";
import { useConfirm } from "../../_components/ConfirmDialog";
import { TrashIcon, EditIcon } from "../../_components/icons";
import { deleteProperty, updateQualificationStatus } from "../actions";
import type { PropertyType, QualificationStatus } from "@prisma/client";

const QUALIFICATION_STATUSES: { value: QualificationStatus; label: string }[] = [
  { value: "NEW_PROSPECT", label: "New Prospect" },
  { value: "RESEARCHING", label: "Researching" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL_READY", label: "Proposal Ready" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent" },
  { value: "CUSTOMER", label: "Customer" },
  { value: "LOST", label: "Lost" },
];

export interface PropertyRow {
  id: string;
  name: string;
  propertyType: PropertyType;
  managementCompany: string | null;
  city: string | null;
  state: string | null;
  numberOfUnits: number | null;
  qualificationStatus: QualificationStatus | null;
  nextFollowUpDate: Date | null;
  createdAt: Date;
}

export function PropertiesTable({
  rows,
  onSelectProperty,
}: {
  rows: PropertyRow[];
  onSelectProperty: (id: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleDelete(e: React.MouseEvent, row: PropertyRow) {
    e.stopPropagation();
    const ok = await confirm({
      title: "Delete property",
      message: `Are you sure you want to delete "${row.name}"? This will permanently delete the property, contacts, counts, systems, and opportunity ratings.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setActiveRowId(row.id);
    startTransition(async () => {
      const res = await deleteProperty(row.id);
      if (!res.ok) { toast.error(res.error ?? "Failed to delete property."); setActiveRowId(null); return; }
      toast.success("Property deleted successfully.");
      router.refresh();
      setActiveRowId(null);
    });
  }

  async function handleStatusChange(e: React.MouseEvent, row: PropertyRow, status: QualificationStatus) {
    e.stopPropagation();
    setActiveRowId(row.id);
    startTransition(async () => {
      const res = await updateQualificationStatus(row.id, status);
      if (!res.ok) { toast.error(res.error ?? "Failed to update status."); setActiveRowId(null); return; }
      router.refresh();
      setActiveRowId(null);
    });
  }

  return (
    <div
      style={{
        background: LIGHT.panel,
        border: `1px solid ${LIGHT.border}`,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
      }}
    >
      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr style={thRowStyle}>
              <th style={thStyle}>Property & Company</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Location</th>
              <th style={thStyle}>Units</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Next Follow-Up</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isOverdue =
                r.nextFollowUpDate &&
                new Date(r.nextFollowUpDate).getTime() < new Date().setHours(0, 0, 0, 0);

              return (
                <tr
                  key={r.id}
                  onClick={() => onSelectProperty(r.id)}
                  className="property-tr-row"
                  style={trStyle}
                >
                  {/* Name & Company */}
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 700, color: LIGHT.text, fontSize: "0.9rem" }}>
                      {r.name}
                    </div>
                    {r.managementCompany && (
                      <div style={{ fontSize: "0.75rem", color: LIGHT.textMuted }}>
                        {r.managementCompany}
                      </div>
                    )}
                  </td>

                  {/* Property Type */}
                  <td style={tdStyle}>
                    <span style={typeBadgeStyle(r.propertyType)}>
                      {formatEnum(r.propertyType)}
                    </span>
                  </td>

                  {/* Location */}
                  <td style={tdStyle}>
                    <span style={{ fontSize: "0.85rem", color: LIGHT.textSecondary }}>
                      {[r.city, r.state].filter(Boolean).join(", ") || "—"}
                    </span>
                  </td>

                  {/* Number of Units */}
                  <td style={tdStyle}>
                    <span style={{ fontSize: "0.85rem", color: LIGHT.textSecondary }}>
                      {r.numberOfUnits !== null ? `${r.numberOfUnits} units` : "—"}
                    </span>
                  </td>

                  {/* Qualification Status — inline quick-edit */}
                  <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                    <select
                      value={r.qualificationStatus ?? ""}
                      disabled={pending}
                      onChange={(e) => handleStatusChange(e as unknown as React.MouseEvent, r, e.target.value as QualificationStatus)}
                      style={{
                        ...statusSelectStyle(r.qualificationStatus),
                        cursor: pending ? "not-allowed" : "pointer",
                        opacity: pending ? 0.6 : 1,
                      }}
                    >
                      {!r.qualificationStatus && <option value="">Unassigned</option>}
                      {QUALIFICATION_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </td>

                  {/* Next Follow Up */}
                  <td style={tdStyle}>
                    {mounted && r.nextFollowUpDate ? (
                      <div
                        style={{
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          color: isOverdue ? LIGHT.danger : LIGHT.textSecondary,
                        }}
                      >
                        {formatDate(r.nextFollowUpDate)}
                        {isOverdue && " ⚠️"}
                      </div>
                    ) : (
                      <span style={{ fontSize: "0.82rem", color: LIGHT.textMuted }}>—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveRowId(r.id);
                        startTransition(() => {
                          router.push(`/properties/${r.id}/edit`);
                        });
                      }}
                      disabled={pending}
                      title="Edit Property"
                      className="action-btn"
                      style={editBtnStyle}
                    >
                      {pending && activeRowId === r.id ? (
                        <div style={smallSpinnerStyle} />
                      ) : (
                        <EditIcon width={16} height={16} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, r)}
                      disabled={pending}
                      title="Delete Property"
                      className="action-btn"
                      style={deleteBtnStyle}
                    >
                      <TrashIcon width={16} height={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style>{`
        .property-tr-row {
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .property-tr-row:hover {
          background: ${LIGHT.hover} !important;
        }
        .action-btn {
          transition: background 0.2s, color 0.2s;
        }
        .action-btn:hover {
          background: ${LIGHT.panelAlt} !important;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatEnum(val: string): string {
  if (!val) return "";
  return val
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(date: Date): string {
  try {
    return new Date(date).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const tableWrapperStyle: CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  textAlign: "left",
};

const thRowStyle: CSSProperties = {
  background: LIGHT.panelAlt,
  borderBottom: `1px solid ${LIGHT.border}`,
};

const thStyle: CSSProperties = {
  padding: "0.85rem 1rem",
  fontSize: "0.72rem",
  fontWeight: 700,
  color: LIGHT.textSecondary,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const trStyle: CSSProperties = {
  borderBottom: `1px solid ${LIGHT.border}`,
  background: LIGHT.panel,
};

const tdStyle: CSSProperties = {
  padding: "0.85rem 1rem",
  verticalAlign: "middle",
};

const deleteBtnStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: LIGHT.danger,
  padding: "0.4rem",
  borderRadius: 8,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const editBtnStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: LIGHT.textSecondary,
  padding: "0.4rem",
  borderRadius: 8,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  marginRight: "0.3rem",
};

const smallSpinnerStyle: CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: "50%",
  border: `2px solid ${LIGHT.border}`,
  borderTopColor: LIGHT.accent,
  animation: "spin 0.8s linear infinite",
};

function typeBadgeStyle(type: PropertyType): CSSProperties {
  const map: Record<PropertyType, { bg: string; fg: string }> = {
    APARTMENT: { bg: "#e0f2fe", fg: "#0369a1" }, // Blue
    MULTIFAMILY: { bg: "#f3e8ff", fg: "#7e22ce" }, // Purple
    HOA: { bg: "#ecfdf5", fg: "#047857" }, // Emerald
    CONDO_COMMUNITY: { bg: "#fdf2f8", fg: "#be185d" }, // Pink
  };
  const c = map[type] ?? { bg: "#f3f4f6", fg: "#374151" };
  return {
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
    padding: "0.15rem 0.5rem",
    borderRadius: 6,
    background: c.bg,
    color: c.fg,
  };
}

function statusBadgeStyle(status: QualificationStatus | null): CSSProperties {
  if (!status) {
    return {
      fontSize: "0.68rem",
      fontWeight: 700,
      padding: "0.15rem 0.5rem",
      borderRadius: 999,
      background: "#f3f4f6",
      color: "#6b7280",
    };
  }
  const map: Record<QualificationStatus, { bg: string; fg: string }> = {
    NEW_PROSPECT: { bg: LIGHT.accentSoft, fg: LIGHT.accent },
    RESEARCHING: { bg: "#fef3c7", fg: "#d97706" }, // Amber
    QUALIFIED: { bg: "#ecfdf5", fg: "#059669" }, // Emerald
    PROPOSAL_READY: { bg: "#edf2f7", fg: "#4a5568" }, // Cool gray
    PROPOSAL_SENT: { bg: "#e0e7ff", fg: "#4f46e5" }, // Indigo
    CUSTOMER: { bg: LIGHT.successSoft, fg: LIGHT.success },
    LOST: { bg: LIGHT.dangerSoft, fg: LIGHT.danger },
  };
  const c = map[status] ?? { bg: "#f3f4f6", fg: "#374151" };
  return {
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
    padding: "0.15rem 0.5rem",
    borderRadius: 999,
    background: c.bg,
    color: c.fg,
  };
}

function statusSelectStyle(status: QualificationStatus | null): CSSProperties {
  const map: Record<string, { bg: string; fg: string }> = {
    NEW_PROSPECT:   { bg: LIGHT.accentSoft,  fg: LIGHT.accent  },
    RESEARCHING:    { bg: "#fef3c7",          fg: "#d97706"     },
    QUALIFIED:      { bg: "#ecfdf5",          fg: "#059669"     },
    PROPOSAL_READY: { bg: "#edf2f7",          fg: "#4a5568"     },
    PROPOSAL_SENT:  { bg: "#e0e7ff",          fg: "#4f46e5"     },
    CUSTOMER:       { bg: LIGHT.successSoft,  fg: LIGHT.success },
    LOST:           { bg: LIGHT.dangerSoft,   fg: LIGHT.danger  },
  };
  const c = status && map[status] ? map[status] : { bg: "#f3f4f6", fg: "#6b7280" };
  return {
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
    padding: "0.15rem 0.55rem",
    borderRadius: 999,
    background: c.bg,
    color: c.fg,
    border: "none",
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none" as CSSProperties["WebkitAppearance"],
    display: "inline-block",
  };
}
