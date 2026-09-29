"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";

/** Pending state shared from a `PendingForm` down to its `SubmitButton`s. */
export interface FormPendingState {
  pending: boolean;
  /** `value` of the submit button that triggered the in-flight submission. */
  submittedValue: string | null;
}

export const FormPendingContext = createContext<FormPendingState>({
  pending: false,
  submittedValue: null,
});

interface PendingFormProps {
  /**
   * Server action to run on submit. Receives the form's `FormData` — though
   * actions may also be pre-bound to their arguments via `.bind()`.
   */
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

/**
 * A `<form>` that runs a server action while exposing a `pending` flag to its
 * `SubmitButton` descendants (via context) and showing any error inline.
 *
 * It uses the native `<form action={fn}>` integration so Next.js collects the
 * `FormData` (including hidden inputs and the clicked submit button) reliably;
 * the client wrapper only adds pending/error tracking around the server call.
 */
export function PendingForm({
  action,
  children,
  style,
  className,
}: PendingFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [submittedValue, setSubmittedValue] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** Records which button submitted the form (for multi-button forms). */
  function captureSubmitter(event: FormEvent<HTMLFormElement>): void {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    setSubmittedValue(
      submitter instanceof HTMLButtonElement && submitter.value
        ? submitter.value
        : null
    );
  }

  async function runAction(formData: FormData): Promise<void> {
    setPending(true);
    setErrorMessage(null);
    try {
      await action(formData);
      router.refresh();
    } catch (error) {
      console.error("[PendingForm] Server action failed:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setPending(false);
      setSubmittedValue(null);
    }
  }

  return (
    <form
      action={runAction}
      onSubmit={captureSubmitter}
      style={style}
      className={className}
    >
      <FormPendingContext.Provider value={{ pending, submittedValue }}>
        {children}
      </FormPendingContext.Provider>
      {errorMessage && (
        <p
          style={{
            color: "var(--color-danger)",
            fontSize: "0.7rem",
            fontWeight: 600,
            marginTop: "0.5rem",
          }}
        >
          ⚠ {errorMessage}
        </p>
      )}
    </form>
  );
}
