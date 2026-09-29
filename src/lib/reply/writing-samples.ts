import { promises as fs } from "fs";
import path from "path";
import { ZohoService } from "../../services/zoho.service";

/**
 * Provides a few examples of the USER's own email writing so the AI can draft
 * replies in their voice ("few-shot").
 *
 * Two sources, in priority order:
 *   1. Local .txt exports in `example_emails/` (see the export-folder API route).
 *      These are Inbox/Sent exports in the "===== EMAIL N of M =====" format;
 *      we keep only the messages sent FROM the user's own domain (their real
 *      replies) and drop the customer emails.
 *   2. Fallback: the live Zoho "Sent" folder.
 *
 * In both cases the quoted reply history is stripped so only the user's own
 * words remain. Cached in-process to avoid re-parsing on every draft.
 */

/** Folder holding the exported .txt files. Override with WRITING_SAMPLES_DIR. */
const SAMPLES_DIR = process.env.WRITING_SAMPLES_DIR
  ? path.resolve(process.env.WRITING_SAMPLES_DIR)
  : path.join(process.cwd(), "src", "app", "api", "zoho", "example_emails");

/** Keep samples in this size range (chars): skip empties and giant threads. */
const MIN_LEN = 40;
const MAX_LEN = 1500;

function htmlToText(html: string): string {
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

/** Cuts off the quoted reply history so only the user's own message remains. */
function stripQuoted(text: string): string {
  const markers: RegExp[] = [
    /[-=]{2,}\s*original message/i,
    /[-=]{2,}\s*forwarded message/i,
    /On\s.{0,90}?\swrote:/i,
    /\bFrom:\s.{0,60}?@/i,
    /Sent from my /i,
  ];
  let idx = -1;
  for (const re of markers) {
    const m = text.match(re);
    if (m && m.index != null && m.index > 40) {
      idx = idx === -1 ? m.index : Math.min(idx, m.index);
    }
  }
  return idx === -1 ? text : text.slice(0, idx);
}

/** Extracts the bare email address from a `From:` header value. */
function extractAddress(fromValue: string): string {
  const angled = fromValue.match(/<([^>]+@[^>]+)>/);
  if (angled) return angled[1].trim().toLowerCase();
  const bare = fromValue.match(/[^\s<>]+@[^\s<>]+/);
  return bare ? bare[0].trim().toLowerCase() : "";
}

/**
 * Resolves the user's own email domain (e.g. "myautogate.com") so we can tell
 * their replies apart from customer emails. Prefers WRITING_SAMPLES_DOMAIN, then
 * the live mailbox address, then a best-effort default.
 */
async function resolveOwnDomain(): Promise<string> {
  const env = process.env.WRITING_SAMPLES_DOMAIN?.trim().toLowerCase();
  if (env) return env.replace(/^@/, "");
  try {
    const addr = await ZohoService.getPrimaryEmailAddress();
    const at = addr.indexOf("@");
    if (at !== -1) return addr.slice(at + 1).trim().toLowerCase();
  } catch {
    /* fall through */
  }
  return "myautogate.com";
}

/** Picks `n` items evenly spread across `arr` (for variety, not just the top). */
function pickSpread<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

/**
 * Parses one exported .txt file (the "===== EMAIL N of M =====" format) and
 * returns the cleaned bodies of the messages sent from `ownDomain`.
 */
function parseExport(content: string, ownDomain: string): string[] {
  const blocks = content.split(/^===== EMAIL \d+ of \d+ =====\s*$/m).slice(1);
  const out: string[] = [];
  for (const block of blocks) {
    const sepIdx = block.indexOf("\n\n");
    if (sepIdx === -1) continue;
    const header = block.slice(0, sepIdx);
    const body = block.slice(sepIdx + 2);

    const fromLine = header.split("\n").find((l) => /^From:/i.test(l));
    if (!fromLine) continue;
    const addr = extractAddress(fromLine.replace(/^From:/i, ""));
    // Keep only the user's own replies (their writing style).
    if (!addr.endsWith("@" + ownDomain)) continue;

    const text = stripQuoted(body).trim();
    if (text.length >= MIN_LEN && text.length <= MAX_LEN) out.push(text);
  }
  return out;
}

/** Loads and parses every .txt file in the samples folder. */
async function loadLocalSamples(ownDomain: string): Promise<string[]> {
  let files: string[];
  try {
    files = (await fs.readdir(SAMPLES_DIR)).filter((f) =>
      f.toLowerCase().endsWith(".txt")
    );
  } catch (err) {
    console.warn(`[writing-samples] cannot read ${SAMPLES_DIR}:`, err);
    return []; // folder missing — fall back to Sent
  }
  // DEBUG (testing): show where we're reading from and the domain filter.
  console.log(
    `[writing-samples] dir=${SAMPLES_DIR} files=${files.length} ownDomain=@${ownDomain}`
  );

  const all: string[] = [];
  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(SAMPLES_DIR, file), "utf8");
      all.push(...parseExport(content, ownDomain));
    } catch {
      /* skip unreadable file */
    }
  }

  // Dedupe near-identical replies (boilerplate greetings/sign-offs repeat).
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const s of all) {
    const key = s.slice(0, 120).toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }
  return unique;
}

/** Fallback: pull recent replies straight from the live Zoho "Sent" folder. */
async function loadSentSamples(max: number): Promise<string[]> {
  const samples: string[] = [];
  try {
    const sentId = await ZohoService.getFolderIdByName("Sent");
    if (sentId) {
      const emails = await ZohoService.getEmails({ folderId: sentId, limit: 8 });
      for (const email of emails) {
        if (samples.length >= max) break;
        try {
          const html = await ZohoService.getEmailContent(
            email.messageId,
            email.folderId
          );
          const text = stripQuoted(htmlToText(html)).trim();
          if (text.length >= MIN_LEN && text.length <= MAX_LEN) {
            samples.push(text);
          }
        } catch {
          /* skip this one */
        }
      }
    }
  } catch (err) {
    console.warn("[writing-samples] could not load Sent examples:", err);
  }
  return samples;
}

export async function getWritingSamples(max = 3): Promise<string[]> {
  // NOTE: caching disabled for testing — re-reads the .txt files on every call.
  const ownDomain = await resolveOwnDomain();
  const local = await loadLocalSamples(ownDomain);

  // Prefer the curated local exports; fall back to the live Sent folder.
  const pool = local.length ? pickSpread(local, max) : await loadSentSamples(max);

  return pool.slice(0, max);
}
