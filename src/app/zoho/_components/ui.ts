/**
 * Small presentational helpers shared across the Zoho mailbox UI:
 * sender-avatar initials + deterministic colors, and folder icons.
 * No server dependencies — safe to import from client components.
 */

/** Light ("Zoho-style") palette used across the mailbox UI. */
export const LIGHT = {
  appBg: "#f5f6f8",
  panel: "#ffffff",
  panelAlt: "#fafbfc",
  border: "#e4e7ec",
  borderStrong: "#d5dae1",
  text: "#1f2733",
  textSecondary: "#5c6672",
  textMuted: "#98a2b3",
  accent: "#2563eb",
  accentSoft: "#eaf1fe",
  hover: "#f2f5f9",
  selected: "#e8f0fe",
  danger: "#dc2626",
  dangerSoft: "#fdecec",
  success: "#16a34a",
  successSoft: "#e9f7ef",
};

/** Up to two uppercase initials from a name or email address. */
export function initials(nameOrEmail: string): string {
  const clean = nameOrEmail.trim();
  if (!clean) return "?";
  // "David White" -> "DW"; "dave@x.com" -> "D".
  const words = clean.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return clean[0]!.toUpperCase();
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** A pleasant, deterministic gradient for an avatar, derived from a seed. */
export function avatarGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const h1 = hash % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1} 65% 55%), hsl(${h2} 70% 45%))`;
}

/** Turns the AI's plain-text reply into simple HTML for the rich editor. */
export function plainToHtml(text: string): string {
  if (!text.trim()) return "";
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${esc(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Strips HTML to readable plain text (for editing a draft body in a textarea). */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|br|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** An emoji icon for a folder, keyed by its name/type. */
export function folderIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("inbox")) return "📥";
  if (n.includes("sent")) return "📤";
  if (n.includes("draft")) return "📝";
  if (n.includes("template")) return "📄";
  if (n.includes("snooze")) return "⏰";
  if (n.includes("spam")) return "🚫";
  if (n.includes("trash")) return "🗑️";
  if (n.includes("outbox")) return "📮";
  if (n.includes("notification")) return "🔔";
  if (n.includes("newsletter")) return "🗞️";
  if (n.includes("archive")) return "📦";
  if (n.includes("sales")) return "💼";
  return "📁";
}
