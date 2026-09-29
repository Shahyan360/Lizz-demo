"use client";

import { useState, type CSSProperties } from "react";
import { useToast } from "../_components/Toast";
import { useConfirm } from "../_components/ConfirmDialog";
import { LIGHT, initials, avatarGradient } from "../zoho/_components/ui";
import { primaryBtn, inputStyle } from "../planner/_components/planner-ui";

export interface BlockedRow {
  id: string;
  email: string;
  reason: string | null;
  createdAtLabel: string;
}

/**
 * Lists blocked senders and lets you unblock them (their mail flows normally
 * again) or block a new address by hand. All mutations go through the shared
 * /api/zoho/block endpoint.
 */
export function BlockedSendersManager({ initial }: { initial: BlockedRow[] }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<BlockedRow[]>(initial);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/zoho/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error ?? `Request failed (${res.status})`);
    }
    return data;
  }

  async function unblock(row: BlockedRow) {
    const ok = await confirm({
      title: "Unblock sender?",
      message: `Unblock ${row.email}? Their emails will reach your inbox and be handled normally again.`,
      confirmLabel: "Unblock",
    });
    if (!ok) return;
    setBusyId(row.id);
    try {
      await post({ email: row.email, action: "unblock" });
      setRows((r) => r.filter((x) => x.id !== row.id));
      toast.success(`Unblocked ${row.email}`);
    } catch (e) {
      toast.error(`Unblock failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusyId(null);
    }
  }

  async function addBlock(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    if (rows.some((r) => r.email === email)) {
      toast.info("That address is already blocked.");
      return;
    }
    setAdding(true);
    try {
      await post({ email });
      setRows((r) => [
        { id: email, email, reason: "added manually", createdAtLabel: "just now" },
        ...r,
      ]);
      setNewEmail("");
      toast.success(`Blocked ${email}`);
    } catch (e) {
      toast.error(`Block failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div style={{ maxWidth: 1650, width: "100%", margin: "0 auto", padding: "1.75rem 2rem 3rem", boxSizing: "border-box" }}>
      <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: LIGHT.text }}>
        Blocked senders
      </h1>
      <p style={{ margin: "0.25rem 0 1.25rem", fontSize: "0.86rem", color: LIGHT.textSecondary }}>
        Mail from these addresses is moved to the Filtered folder and never gets
        an auto-reply. Unblock any of them to resume normal handling.
      </p>

      {/* Add by hand */}
      <form
        onSubmit={addBlock}
        style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}
      >
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="block an address, e.g. spammer@example.com"
          style={{ ...inputStyle, flex: 1, minWidth: 240 }}
        />
        <button type="submit" disabled={adding || !newEmail.trim()} style={{ ...primaryBtn, opacity: adding ? 0.6 : 1 }}>
          {adding ? "Blocking…" : "Block"}
        </button>
      </form>

      <div style={{ background: LIGHT.panel, border: `1px solid ${LIGHT.border}`, borderRadius: 14, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <p style={{ padding: "2rem", textAlign: "center", color: LIGHT.textMuted, fontSize: "0.9rem" }}>
            No blocked senders. Use 🚫 Block sender on an email, or add one above.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Sender</th>
                  <th style={thStyle}>Blocked</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: `1px solid ${LIGHT.border}` }}>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <span
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: "50%",
                            background: avatarGradient(r.email),
                            color: "#fff",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {initials(r.email)}
                        </span>
                        <span style={{ fontSize: "0.86rem", color: LIGHT.text, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.email}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: LIGHT.textMuted, fontSize: "0.8rem" }}>
                      {r.createdAtLabel}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => unblock(r)}
                        disabled={busyId === r.id}
                        style={{
                          border: `1px solid ${LIGHT.border}`,
                          background: LIGHT.panel,
                          color: LIGHT.accent,
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          padding: "0.35rem 0.8rem",
                          borderRadius: 8,
                          cursor: busyId === r.id ? "default" : "pointer",
                          opacity: busyId === r.id ? 0.6 : 1,
                        }}
                      >
                        {busyId === r.id ? "Unblocking…" : "Unblock"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
