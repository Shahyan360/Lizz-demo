import type { Prisma } from "@prisma/client";

/**
 * Coerces a Prisma `Json` column that stores a list of strings back into a
 * `string[]`.
 *
 * MySQL (unlike PostgreSQL) has no native scalar-list type, so fields such as
 * `CommunicationProfile.vocabularyPref` / `forbiddenWords` and
 * `EmailMessage.recipients` are stored as JSON arrays and read back as
 * `Prisma.JsonValue`. This normalizes that value to a plain `string[]`,
 * tolerating null / non-array / non-string entries.
 */
export function jsonStringArray(
  value: Prisma.JsonValue | null | undefined
): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}
