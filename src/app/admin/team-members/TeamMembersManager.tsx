"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../_components/Toast";
import { useConfirm } from "../../_components/ConfirmDialog";
import { LIGHT } from "../../zoho/_components/ui";
import { inputStyle, primaryBtn } from "../../planner/_components/planner-ui";
import { TeamMemberFormModal } from "./TeamMemberFormModal";
import { archiveTeamMemberAction } from "./actions";
import type { TeamMemberRow, TeamRoleOption } from "./types";

type RoleFilter = "ALL" | TeamMemberRow["roleKey"];
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export function TeamMembersManager({
  initialMembers,
  roleOptions,
}: {
  initialMembers: TeamMemberRow[];
  roleOptions: TeamRoleOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMemberRow | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialMembers.filter((m) => {
      if (roleFilter !== "ALL" && m.roleKey !== roleFilter) return false;
      if (statusFilter === "ACTIVE" && !m.isActive) return false;
      if (statusFilter === "INACTIVE" && m.isActive) return false;
      if (!q) return true;
      return `${m.name} ${m.email} ${m.notes ?? ""}`.toLowerCase().includes(q);
    });
  }, [initialMembers, query, roleFilter, statusFilter]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(member: TeamMemberRow) {
    setEditing(member);
    setModalOpen(true);
  }

  function afterMutation(ok: boolean, message: string) {
    if (ok) {
      toast.success(message);
      router.refresh();
    } else {
      toast.error(message);
    }
  }

  async function archive(member: TeamMemberRow) {
    const ok = await confirm({
      title: "Archive team member",
      message: `Archive ${member.name}? They will stop receiving new routing assignments.`,
      confirmLabel: "Archive",
      danger: true,
    });
    if (!ok) return;

    start(async () => {
      const res = await archiveTeamMemberAction(member.id);
      afterMutation(res.ok, res.ok ? "Member archived." : res.error ?? "Archive failed.");
    });
  }

  const filtersActive =
    query.trim().length > 0 || roleFilter !== "ALL" || statusFilter !== "ALL";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.75rem 1.25rem 3rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: LIGHT.text }}>
            Team Members
          </h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.86rem", color: LIGHT.textSecondary }}>
            Manage who Lizzz can route to and which role they currently fill.
          </p>
        </div>

        <button type="button" onClick={openCreate} style={primaryBtn}>
          + Add member
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.6rem",
          flexWrap: "wrap",
          marginBottom: "0.85rem",
          alignItems: "center",
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, or notes…"
          style={{ ...inputStyle, flex: "1 1 220px", maxWidth: 340 }}
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          style={{ ...inputStyle, width: "auto", minWidth: 180 }}
        >
          <option value="ALL">All roles</option>
          {roleOptions.map((role) => (
            <option key={role.key} value={role.key}>
              {role.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          style={{ ...inputStyle, width: "auto", minWidth: 120 }}
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Archived</option>
        </select>

        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setRoleFilter("ALL");
              setStatusFilter("ALL");
            }}
            style={{
              border: "none",
              background: "transparent",
              color: LIGHT.textSecondary,
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              padding: "0.35rem 0.5rem",
            }}
          >
            Clear
          </button>
        )}
      </div>

      <div
        style={{
          background: LIGHT.panel,
          border: `1px solid ${LIGHT.border}`,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
            <thead>
              <tr>
                <th style={thStyle}>Member</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Primary</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Updated</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      ...tdStyle,
                      textAlign: "center",
                      color: LIGHT.textMuted,
                      padding: "2rem 1rem",
                    }}
                  >
                    {filtersActive ? "No members match your filters." : "No team members yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} style={{ borderTop: `1px solid ${LIGHT.border}` }}>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <strong style={{ color: LIGHT.text }}>{m.name}</strong>
                        <span style={{ color: LIGHT.textSecondary, fontSize: "0.82rem" }}>{m.email}</span>
                        {m.notes && (
                          <span style={{ color: LIGHT.textMuted, fontSize: "0.78rem" }}>{m.notes}</span>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <strong style={{ color: LIGHT.text }}>{m.roleLabel}</strong>
                        <span style={{ color: LIGHT.textMuted, fontSize: "0.78rem" }}>{m.roleKey}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "0.22rem 0.5rem",
                          borderRadius: 999,
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          background: m.isPrimary ? LIGHT.selected : LIGHT.panelAlt,
                          color: m.isPrimary ? LIGHT.accent : LIGHT.textSecondary,
                        }}
                      >
                        {m.isPrimary ? "Primary" : "Backup"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "0.22rem 0.5rem",
                          borderRadius: 999,
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          background: m.isActive ? LIGHT.successSoft : LIGHT.dangerSoft,
                          color: m.isActive ? LIGHT.success : LIGHT.danger,
                        }}
                      >
                        {m.isActive ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td style={tdStyle}>{m.updatedAtLabel}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "0.45rem" }}>
                        <button type="button" onClick={() => openEdit(m)} style={smallBtn}>
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => archive(m)}
                          disabled={pending || !m.isActive}
                          style={smallDangerBtn(!m.isActive)}
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <TeamMemberFormModal
          initial={editing}
          roleOptions={roleOptions}
          onClose={() => setModalOpen(false)}
          onDone={afterMutation}
        />
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.8rem 0.9rem",
  fontSize: "0.78rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: LIGHT.textMuted,
  background: LIGHT.panelAlt,
};

const tdStyle: React.CSSProperties = {
  padding: "0.9rem 0.9rem",
  fontSize: "0.88rem",
  color: LIGHT.text,
  verticalAlign: "top",
};

const smallBtn: React.CSSProperties = {
  border: `1px solid ${LIGHT.border}`,
  background: LIGHT.panel,
  color: LIGHT.text,
  borderRadius: 10,
  padding: "0.42rem 0.75rem",
  fontSize: "0.82rem",
  fontWeight: 600,
  cursor: "pointer",
};

function smallDangerBtn(disabled: boolean): React.CSSProperties {
  return {
    ...smallBtn,
    color: disabled ? LIGHT.textMuted : LIGHT.danger,
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? "default" : "pointer",
  };
}