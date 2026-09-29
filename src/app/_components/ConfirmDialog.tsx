"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Promise-based confirm — `if (await confirm({...})) { ... }`. */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used inside <ConfirmProvider>");
  }
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div
          onClick={() => close(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
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
              background: "#ffffff",
              borderRadius: 14,
              maxWidth: 400,
              width: "100%",
              padding: "1.4rem 1.5rem",
              boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
            }}
          >
            {opts.title && (
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color: "#1f2733",
                }}
              >
                {opts.title}
              </h3>
            )}
            <p
              style={{
                marginTop: opts.title ? "0.5rem" : 0,
                marginBottom: 0,
                color: "#5c6672",
                fontSize: "0.9rem",
                lineHeight: 1.5,
              }}
            >
              {opts.message}
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.6rem",
                marginTop: "1.35rem",
              }}
            >
              <button
                type="button"
                onClick={() => close(false)}
                style={{
                  padding: "0.5rem 1.1rem",
                  borderRadius: 8,
                  border: "1px solid #e4e7ec",
                  background: "#ffffff",
                  color: "#1f2733",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {opts.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => close(true)}
                style={{
                  padding: "0.5rem 1.2rem",
                  borderRadius: 8,
                  border: "none",
                  background: opts.danger ? "#dc2626" : "#2563eb",
                  color: "#ffffff",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {opts.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
