/**
 * Barrel for the DB write "tools" — small, reusable, single-purpose functions
 * that persist domain records. Import from here: `import { createTask } from
 * "@/lib/tools"`.
 */
export * from "./task.tool";
export * from "./meeting.tool";
export * from "./contact.tool";
export * from "./deal.tool";
