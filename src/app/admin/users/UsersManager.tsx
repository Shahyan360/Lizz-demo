"use client";

import { useMemo, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../_components/Toast";
import { useConfirm } from "../../_components/ConfirmDialog";
import { LIGHT, initials, avatarGradient } from "../../zoho/_components/ui";
import { inputStyle, primaryBtn } from "../../planner/_components/planner-ui";
import { UserFormModal } from "./UserFormModal";
import { deleteUserAction, resendInviteAction, updateUserAction } from "./actions";
import type { UserRow } from "./types";

type RoleFilter = "ALL" | UserRow["role"];
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

/**
 * The interactive user-management table: invite, edit, activate/deactivate, resend
 * invite, and delete workspace users. Mutations go through admin server actions;
 * after each success we refresh the route so the server-rendered list re-reads the DB.
 */
export function UsersManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialUsers.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (statusFilter === "ACTIVE" && !u.isActive) return false;
      if (statusFilter === "INACTIVE" && u.isActive) return false;
      if (!q) return true;
      const haystack = `${u.name ?? ""} ${u.email}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [initialUsers, query, roleFilter, statusFilter]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(user: UserRow) {
    setEditing(user);
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

  function toggleActive(user: UserRow) {
    start(async () => {
      const res = await updateUserAction({
        id: user.id,
        name: user.name ?? "",
        role: user.role,
        isActive: !user.isActive,
      });
      afterMutation(
        res.ok,
        res.ok
          ? user.isActive
            ? "User deactivated."
            : "User reactivated."
          : res.error ?? "Update failed."
      );
    });
  }

  function resendInvite(user: UserRow) {
    start(async () => {
      const res = await resendInviteAction(user.id);
      afterMutation(
        res.ok,
        res.ok ? res.message ?? "Invite sent." : res.error ?? "Failed to send invite."
      );
    });
  }

  async function remove(user: UserRow) {
    const ok = await confirm({
      title: "Delete user",
      message: `Permanently delete ${user.name || user.email}? This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      const res = await deleteUserAction(user.id);
      afterMutation(res.ok, res.ok ? "User deleted." : res.error ?? "Delete failed.");
    });
  }

  const filtersActive =
    query.trim().length > 0 || roleFilter !== "ALL" || statusFilter !== "ALL";

  return (
    <div style={{ maxWidth: 1650, width: "100%", margin: "0 auto", padding: "1.75rem 2rem 3rem", boxSizing: "border-box" }}>
      {/* Header */}
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
            Users
          </h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.86rem", color: LIGHT.textSecondary }}>
            {filteredUsers.length === initialUsers.length
              ? `${initialUsers.length} ${initialUsers.length === 1 ? "member" : "members"} in this workspace`
              : `${filteredUsers.length} of ${initialUsers.length} members shown`}
          </p>
        </div>
        <button type="button" onClick={openCreate} style={primaryBtn}>
          + Invite user
        </button>
      </div>

      {/* Search / filter */}
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
          placeholder="Search name or email…"
          style={{ ...inputStyle, flex: "1 1 200px", maxWidth: 320 }}
          aria-label="Search users"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          style={{ ...inputStyle, width: "auto", minWidth: 110 }}
          aria-label="Filter by role"
        >
          <option value="ALL">All roles</option>
          <option value="ADMIN">Admin</option>
          <option value="USER">User</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          style={{ ...inputStyle, width: "auto", minWidth: 120 }}
          aria-label="Filter by status"
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Deactivated</option>
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

      {/* Table */}
      <div
        style={{
          background: LIGHT.panel,
          border: `1px solid ${LIGHT.border}`,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr>
                <th style={thStyle}>User</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Last login</th>
                <th style={thStyle}>Added</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
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
                    {filtersActive ? "No users match your filters." : "No users yet."}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = u.id === currentUserId;
                  return (
                    <tr key={u.id} style={{ borderTop: `1px solid ${LIGHT.border}` }}>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <span
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              background: avatarGradient(u.email),
                              color: "#fff",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {initials(u.name || u.email)}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "0.86rem", fontWeight: 600, color: LIGHT.text }}>
                              {u.name || "—"}
                              {isSelf && (
                                <span
                                  style={{
                                    marginLeft: 6,
                                    fontSize: "0.68rem",
                                    color: LIGHT.textMuted,
                                    fontWeight: 500,
                                  }}
                                >
                                  (you)
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                fontSize: "0.76rem",
                                color: LIGHT.textMuted,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={roleBadge(u.role === "ADMIN")}>{u.role}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={statusBadge(u.isActive)}>
                          {u.isActive ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: u.lastLoginAtLabel === "Never" ? LIGHT.textMuted : LIGHT.text,
                          fontSize: "0.8rem",
                        }}
                      >
                        {u.lastLoginAtLabel}
                      </td>
                      <td style={{ ...tdStyle, color: LIGHT.textMuted, fontSize: "0.8rem" }}>
                        {u.createdAtLabel}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          disabled={pending}
                          style={linkBtn(LIGHT.accent)}
                        >
                          Edit
                        </button>
                        {u.isActive && (
                          <button
                            type="button"
                            onClick={() => resendInvite(u)}
                            disabled={pending}
                            style={linkBtn(LIGHT.textSecondary)}
                          >
                            Resend invite
                          </button>
                        )}
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => toggleActive(u)}
                            disabled={pending}
                            style={linkBtn(LIGHT.textSecondary)}
                          >
                            {u.isActive ? "Deactivate" : "Activate"}
                          </button>
                        )}
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => remove(u)}
                            disabled={pending}
                            style={linkBtn(LIGHT.danger)}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <UserFormModal
          initial={editing}
          isSelf={editing?.id === currentUserId}
          onClose={() => setModalOpen(false)}
          onDone={afterMutation}
        />
      )}
    </div>
  );
}

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "0.7rem 1rem",
  fontSize: "0.7rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: LIGHT.textMuted,
  background: LIGHT.panelAlt,
};

const tdStyle: CSSProperties = {
  padding: "0.7rem 1rem",
  fontSize: "0.86rem",
  color: LIGHT.text,
  verticalAlign: "middle",
};

function linkBtn(color: string): CSSProperties {
  return {
    border: "none",
    background: "transparent",
    color,
    fontSize: "0.8rem",
    fontWeight: 600,
    cursor: "pointer",
    padding: "0.3rem 0.5rem",
  };
}

function roleBadge(admin: boolean): CSSProperties {
  return {
    fontSize: "0.66rem",
    fontWeight: 700,
    letterSpacing: "0.03em",
    padding: "0.14rem 0.55rem",
    borderRadius: 999,
    background: admin ? LIGHT.accentSoft : LIGHT.hover,
    color: admin ? LIGHT.accent : LIGHT.textSecondary,
  };
}

function statusBadge(active: boolean): CSSProperties {
  return {
    fontSize: "0.66rem",
    fontWeight: 700,
    padding: "0.14rem 0.55rem",
    borderRadius: 999,
    background: active ? LIGHT.successSoft : LIGHT.dangerSoft,
    color: active ? LIGHT.success : LIGHT.danger,
  };
}
