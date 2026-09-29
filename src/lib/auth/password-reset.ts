import { createHash, randomBytes } from "crypto";

/** Password-reset tokens expire after 1 hour. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Generates a URL-safe raw token to email to the user. */
export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hash of the raw token — this is what we store in the DB. */
export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Absolute base URL for building reset links (falls back to localhost in dev). */
export function appBaseUrl(): string {
  const fromEnv = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  return fromEnv || "http://localhost:3000";
}
