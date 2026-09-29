"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { LIGHT, plainToHtml } from "./ui";
import { RichEditor } from "../../_components/RichEditor";
import { useToast } from "../../_components/Toast";
import { useConfirm } from "../../_components/ConfirmDialog";

export function AutoReplyModal({
  accountId,
  folderId,
  messageId,
  onClose,
}: {
  accountId: string;
  folderId: string;
  messageId: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [text, setText] = useState("");
  const [to, setTo] = useState("");
  const [from, setFrom] = useState("");
  const [generating, setGenerating] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(action: "generate" | "send" | "save") {
    const res = await fetch("/api/zoho/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        folderId,
        messageId,
        action,
        text,
        context: "reply",
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      replyText?: string;
      to?: string;
      from?: string;
      error?: string;
    } | null;
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error ?? `Request failed (${res.status})`);
    }
    return data;
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const data = await call("generate");
      setText(plainToHtml(data.replyText ?? ""));
      setTo(data.to ?? "");
      setFrom(data.from ?? "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(`Draft failed: ${msg}`);
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send() {
    const ok = await confirm({
      title: "Send auto reply?",
      message: `This reply will be sent${to ? ` to ${to}` : ""} right away.`,
      confirmLabel: "Send now",
    });
    if (!ok) return;
    setSending(true);
    setError(null);
    try {
      await call("send");
      toast.success(`Auto reply sent to ${to}`);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(`Send failed: ${msg}`);
    } finally {
      setSending(false);
    }
  }

  async function saveDraft() {
    setSaving(true);
    setError(null);
    try {
      await call("save");
      toast.success(`Draft saved to Zoho Drafts`);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  const busy = generating || saving || sending;

  return (
    <div
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 1.25rem",
            borderBottom: `1px solid ${LIGHT.border}`,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "1.05rem",
              fontWeight: 700,
              color: LIGHT.text,
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            ⚡ Auto Reply
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            style={{
              border: "none",
              background: "transparent",
              color: LIGHT.textMuted,
              fontSize: "1.2rem",
              cursor: busy ? "default" : "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.1rem 1.25rem" }}>
          {(from || to) && (
            <div
              style={{
                fontSize: "0.8rem",
                color: LIGHT.textSecondary,
                marginBottom: "0.6rem",
                paddingBottom: "0.55rem",
                borderBottom: `1px solid ${LIGHT.border}`,
                lineHeight: 1.7,
              }}
            >
              {from && (
                <div>
                  From: <strong style={{ color: LIGHT.text }}>{from}</strong>
                </div>
              )}
              {to && (
                <div>
                  To: <strong style={{ color: LIGHT.text }}>{to}</strong>
                </div>
              )}
            </div>
          )}

          {generating ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                color: LIGHT.textSecondary,
                fontSize: "0.9rem",
                padding: "1.5rem 0",
              }}
            >
              <span className="spinner" /> Generating auto reply…
            </div>
          ) : (
            <RichEditor value={text} onChange={setText} />
          )}

          {error && (
            <p style={{ color: LIGHT.danger, fontSize: "0.82rem", marginTop: "0.6rem" }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.6rem",
            padding: "0.9rem 1.25rem",
            borderTop: `1px solid ${LIGHT.border}`,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={ghostBtn(busy)}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            style={ghostBtn(busy)}
          >
            ↻ Regenerate
          </button>
          <button
            type="button"
            onClick={saveDraft}
            disabled={busy || !text.trim()}
            style={draftBtn(busy || !text.trim())}
          >
            {saving ? (
              <>
                <span className="spinner" /> Saving…
              </>
            ) : (
              "💾 Save to Draft"
            )}
          </button>
          <button
            type="button"
            onClick={send}
            disabled={busy || !text.trim()}
            style={sendBtn(busy || !text.trim())}
          >
            {sending ? (
              <>
                <span className="spinner" /> Sending…
              </>
            ) : (
              "✈️ Send now"
            )}
          </button>
        </div>
      </div>
    </div>
  );
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

function draftBtn(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.5rem 1.2rem",
    borderRadius: 8,
    border: `1px solid ${LIGHT.accent}`,
    background: "transparent",
    color: LIGHT.accent,
    fontSize: "0.85rem",
    fontWeight: 700,
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
    opacity: disabled ? 0.55 : 1,
  };
}
