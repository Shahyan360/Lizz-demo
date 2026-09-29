/**
 * Classification of Gmail send failures into stable reason codes and a
 * retriable flag, plus auth-error detection that drives the token-refresh path.
 */

/** Safely reads an HTTP-ish status code off an unknown thrown value. */
function readStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const record = error as Record<string, unknown>;
  if (typeof record.code === "number") return record.code;
  if (typeof record.status === "number") return record.status;
  const response = record.response;
  if (typeof response === "object" && response !== null) {
    const status = (response as Record<string, unknown>).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * True when an error indicates an expired / invalid OAuth token — the signal to
 * force a token refresh and retry once.
 */
export function isAuthError(error: unknown): boolean {
  if (readStatusCode(error) === 401) {
    return true;
  }
  return /invalid_grant|invalid credentials|invalid authentication/i.test(
    errorMessage(error)
  );
}

/**
 * Classifies a send failure. `retriable` is true only when a later retry could
 * plausibly succeed (rate limits, transient 5xx, network blips).
 */
export function categorizeSendError(error: unknown): {
  reason: string;
  retriable: boolean;
} {
  const status = readStatusCode(error);
  const message = errorMessage(error);

  if (isAuthError(error) || status === 403) {
    return { reason: "auth_failed", retriable: false };
  }

  const isNetwork =
    /ETIMEDOUT|ECONNRESET|ENOTFOUND|ECONNREFUSED|socket hang up|network|timed? ?out/i.test(
      message
    );
  if (
    status === 429 ||
    status === 503 ||
    (status != null && status >= 500) ||
    isNetwork
  ) {
    return {
      reason: status != null ? `gmail_unavailable_${status}` : "network_error",
      retriable: true,
    };
  }

  if (status != null && status >= 400) {
    return { reason: `gmail_rejected_${status}`, retriable: false };
  }
  return { reason: "send_failed", retriable: false };
}
