/**
 * In-memory login throttle to blunt password brute-forcing.
 *
 * Keyed per email (lowercased). After MAX_ATTEMPTS failures inside WINDOW_MS the
 * account is locked for LOCK_MS; a successful login clears the counter. State
 * lives in process memory — effective for a single Node server (this app's
 * deployment shape). On a multi-instance/serverless deployment, back this with
 * Redis instead so the limit is shared across instances.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // failures counted within a 15-minute window
const LOCK_MS = 15 * 60 * 1000; // lockout duration once the limit is hit

interface Bucket {
  count: number;
  firstAt: number;
  lockedUntil: number;
}

const buckets = new Map<string, Bucket>();

function keyFor(email: string): string {
  return email.trim().toLowerCase();
}

/** True when this account is currently locked out. */
export function isLockedOut(email: string): boolean {
  const b = buckets.get(keyFor(email));
  if (!b) return false;
  if (b.lockedUntil && Date.now() < b.lockedUntil) return true;
  return false;
}

/** Records a failed attempt, arming a lockout once the threshold is crossed. */
export function recordFailedAttempt(email: string): void {
  const key = keyFor(email);
  const now = Date.now();
  const b = buckets.get(key);

  // Fresh window (none yet, previous window expired, or a prior lock lapsed).
  if (!b || now - b.firstAt > WINDOW_MS || (b.lockedUntil && now >= b.lockedUntil)) {
    buckets.set(key, { count: 1, firstAt: now, lockedUntil: 0 });
    return;
  }

  b.count += 1;
  if (b.count >= MAX_ATTEMPTS) {
    b.lockedUntil = now + LOCK_MS;
  }
}

/** Clears all failure state for an account (call on a successful login). */
export function clearAttempts(email: string): void {
  buckets.delete(keyFor(email));
}
