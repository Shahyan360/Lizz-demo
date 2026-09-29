"use client";

import type { ReactNode } from "react";
import { LIGHT } from "../../zoho/_components/ui";

/** Centered modal with a header, close button, and a body slot. */
export function ModalShell({
  title,
  onClose,
  busy = false,
  children,
  footer,
  closeOnBackdrop = true,
}: {
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  /** Close when the backdrop is clicked. Disable for forms with unsaved input. */
  closeOnBackdrop?: boolean;
}) {
  return (
    <div
      onClick={() => closeOnBackdrop && !busy && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
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
          maxWidth: 560,
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 1.25rem",
            borderBottom: `1px solid ${LIGHT.border}`,
          }}
        >
          <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: LIGHT.text }}>
            {title}
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
              fontSize: "1.3rem",
              cursor: busy ? "default" : "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "1rem 1.25rem" }}>{children}</div>

        {footer && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.6rem",
              padding: "0.9rem 1.25rem",
              borderTop: `1px solid ${LIGHT.border}`,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
