"use client";

import { useContext, type CSSProperties, type ReactNode } from "react";
import { FormPendingContext } from "./PendingForm";

interface SubmitButtonProps {
  children: ReactNode;
  /** Label shown next to the spinner while the request is in flight. */
  pendingLabel?: string;
  style?: CSSProperties;
  className?: string;
  /** Optional name/value — required only for forms with multiple buttons. */
  name?: string;
  value?: string;
}

/**
 * A submit button that must live inside a {@link PendingForm}. While the form's
 * server action is running it disables itself and swaps its label for a
 * spinner; in a multi-button form, only the clicked button spins.
 */
export function SubmitButton({
  children,
  pendingLabel = "Working…",
  style,
  className,
  name,
  value,
}: SubmitButtonProps) {
  const { pending, submittedValue } = useContext(FormPendingContext);
  const isActiveSubmitter = value == null || submittedValue === value;
  const showSpinner = pending && isActiveSubmitter;

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={className}
      style={{
        ...style,
        cursor: pending ? "not-allowed" : style?.cursor ?? "pointer",
        opacity: pending && !showSpinner ? 0.55 : style?.opacity ?? 1,
      }}
    >
      {showSpinner ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          <span className="spinner" aria-hidden="true" />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
