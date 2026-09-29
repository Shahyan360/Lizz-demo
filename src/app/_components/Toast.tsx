"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "info";

interface ToastItemData {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastApi {
  show: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Access the toast API from any client component. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

let toastCounter = 0;

const STYLES: Record<
  ToastType,
  { icon: string; border: string; bg: string; fg: string }
> = {
  success: {
    icon: "✓",
    border: "var(--color-success)",
    bg: "rgba(16, 185, 129, 0.12)",
    fg: "var(--color-success)",
  },
  error: {
    icon: "✕",
    border: "var(--color-danger)",
    bg: "rgba(239, 68, 68, 0.12)",
    fg: "var(--color-danger)",
  },
  info: {
    icon: "ℹ",
    border: "var(--color-primary)",
    bg: "rgba(99, 102, 241, 0.12)",
    fg: "var(--color-primary)",
  },
};

/** Wrap the app once (in the root layout) to enable toasts everywhere. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItemData[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = ++toastCounter;
      setToasts((list) => [...list, { id, type, message }]);
      // Auto-dismiss after 4s.
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, "success"),
      error: (m) => show(m, "error"),
      info: (m) => show(m, "info"),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
          maxWidth: "min(92vw, 380px)",
        }}
      >
        {toasts.map((t) => {
          const s = STYLES[t.type];
          return (
            <div
              key={t.id}
              className="toast-enter"
              role="status"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.6rem",
                padding: "0.8rem 1rem",
                borderRadius: 12,
                border: `1px solid ${s.border}`,
                background: "var(--bg-card)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                backdropFilter: "blur(12px)",
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: s.bg,
                  color: s.fg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {s.icon}
              </span>
              <span
                style={{
                  flex: 1,
                  color: "var(--text-primary)",
                  fontSize: "0.86rem",
                  lineHeight: 1.45,
                  wordBreak: "break-word",
                }}
              >
                {t.message}
              </span>
              <button
                type="button"
                onClick={() => remove(t.id)}
                aria-label="Dismiss"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "1rem",
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
