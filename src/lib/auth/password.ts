import bcrypt from "bcryptjs";

/**
 * Password hashing for local (Credentials) accounts. Uses bcryptjs (pure JS, no
 * native build step) so it runs anywhere the Node server does.
 */

const SALT_ROUNDS = 10;

/** Minimum length we require when an admin sets/changes a password. */
export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
