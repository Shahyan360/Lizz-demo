import type { CSSProperties } from "react";

/**
 * Reusable loading indicator.
 * - inline (default): a spinner + optional label, flows with text.
 * - overlay: a full-screen dimmed backdrop with a centered spinner + label.
 */
export function Loader({
  label,
  overlay = false,
  size = "1.1em",
  style,
}: {
  label?: string;
  overlay?: boolean;
  size?: string;
  style?: CSSProperties;
}) {
  const spinner = (
    <span className="spinner" style={{ width: size, height: size }} />
  );

  if (overlay) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 900,
          background: "rgba(11, 15, 25, 0.6)",
          backdropFilter: "blur(3px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.7rem",
          color: "var(--text-primary)",
          fontSize: "0.95rem",
          fontWeight: 600,
        }}
      >
        {spinner}
        {label && <span>{label}</span>}
      </div>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        color: "var(--text-secondary)",
        fontSize: "0.9rem",
        ...style,
      }}
    >
      {spinner}
      {label && <span>{label}</span>}
    </span>
  );
}
