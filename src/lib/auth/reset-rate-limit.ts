/**
 * Lightweight in-memory throttle for password-reset requests.
 * Separate from login lockouts so a reset attempt doesn't block sign-in.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

interface Bucket {
  count: number;
  firstAt: number;
  lockedUntil: number;
}

const buckets = new Map<string, Bucket>();

function keyFor(email: string): string {
  return email.trim().toLowerCase();
}

export function isResetRateLimited(email: string): boolean {
  const b = buckets.get(keyFor(email));
  if (!b) return false;
  return Boolean(b.lockedUntil && Date.now() < b.lockedUntil);
}

export function recordResetAttempt(email: string): void {
  const key = keyFor(email);
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || now - b.firstAt > WINDOW_MS || (b.lockedUntil && now >= b.lockedUntil)) {
    buckets.set(key, { count: 1, firstAt: now, lockedUntil: 0 });
    return;
  }

  b.count += 1;
  if (b.count >= MAX_ATTEMPTS) {
    b.lockedUntil = now + LOCK_MS;
  }
}
