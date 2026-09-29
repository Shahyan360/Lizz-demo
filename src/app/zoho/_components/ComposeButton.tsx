"use client";

import { useState, type CSSProperties } from "react";
import { LIGHT } from "./ui";
import { RichEditor } from "../../_components/RichEditor";
import { useToast } from "../../_components/Toast";

/**
 * "Compose" button for the mailbox header. Opens a modal to send a brand-new
 * email to ANY address (contact or not) via POST /api/zoho/compose. Supports
 * sending immediately or saving to Drafts.
 */
export function ComposeButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={composeBtn}>
        ✉️ Compose
      </button>
      {open && <ComposeModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ComposeModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(action: "send" | "draft") {
    if (!to.trim() || !to.includes("@")) {
      toast.error("Enter a valid recipient email.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/zoho/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, cc, subject, content: body, action }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      toast.success(action === "draft" ? "Draft saved" : `Email sent to ${to}`);
      onClose();
    } catch (e) {
      toast.error(
        `${action === "draft" ? "Save" : "Send"} failed: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={() => !busy && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="toast-enter"
        style={{
          background: LIGHT.panel,
          borderRadius: 14,
          width: "100%",
          maxWidth: 640,
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div style={modalHeader}>
          <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: LIGHT.text }}>
            ✉️ New Email
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            style={closeBtn(busy)}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <Field label="To">
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
                autoFocus
                style={inputStyle}
              />
              {!showCc && (
                <button type="button" onClick={() => setShowCc(true)} style={linkBtn}>
                  Cc
                </button>
              )}
            </div>
          </Field>

          {showCc && (
            <Field label="Cc">
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                style={inputStyle}
              />
            </Field>
          )}

          <Field label="Subject">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              style={inputStyle}
            />
          </Field>

          {/* NOTE: the editor must NOT be wrapped in a <label> — a label
              forwards clicks to its first control (CKEditor's heading dropdown),
              which would pop open whenever you click the editor. Use a div. */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: LIGHT.textSecondary }}>
              Message
            </span>
            <RichEditor value={body} onChange={setBody} />
          </div>
        </div>

        {/* Footer */}
        <div style={modalFooter}>
          <button type="button" onClick={onClose} disabled={busy} style={ghostBtn(busy)}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => submit("draft")}
            disabled={busy}
            style={ghostBtn(busy)}
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={() => submit("send")}
            disabled={busy}
            style={sendBtn(busy)}
          >
            {busy ? "Sending…" : "✈️ Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: LIGHT.textSecondary }}>
        {label}
      </span>
      {children}
    </label>
  );
}

/* ── styles ──────────────────────────────────────────────────── */

const composeBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  padding: "0.4rem 0.9rem",
  borderRadius: 8,
  border: "none",
  background: LIGHT.accent,
  color: "#fff",
  fontSize: "0.82rem",
  fontWeight: 700,
  cursor: "pointer",
};

const modalHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "1rem 1.25rem",
  borderBottom: `1px solid ${LIGHT.border}`,
};

const modalFooter: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.6rem",
  padding: "0.9rem 1.25rem",
  borderTop: `1px solid ${LIGHT.border}`,
};

const inputStyle: CSSProperties = {
  flex: 1,
  width: "100%",
  padding: "0.55rem 0.7rem",
  borderRadius: 8,
  border: `1px solid ${LIGHT.borderStrong}`,
  background: "#fff",
  color: LIGHT.text,
  fontSize: "0.88rem",
  outline: "none",
};

const linkBtn: CSSProperties = {
  border: "none",
  background: "transparent",
  color: LIGHT.accent,
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer",
};

function closeBtn(busy: boolean): CSSProperties {
  return {
    border: "none",
    background: "transparent",
    color: LIGHT.textMuted,
    fontSize: "1.3rem",
    cursor: busy ? "default" : "pointer",
    lineHeight: 1,
  };
}

function ghostBtn(disabled: boolean): CSSProperties {
  return {
    padding: "0.5rem 1rem",
    borderRadius: 8,
    border: `1px solid ${LIGHT.border}`,
    background: LIGHT.panel,
    color: LIGHT.text,
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}

function sendBtn(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.5rem 1.2rem",
    borderRadius: 8,
    border: "none",
    background: LIGHT.accent,
    color: "#fff",
    fontSize: "0.85rem",
    fontWeight: 700,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.7 : 1,
  };
}
