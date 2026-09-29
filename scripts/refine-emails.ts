/**
 * Refine a raw email .txt export into clean, useful learning examples.
 *
 * Run:  npx ts-node scripts/refine-emails.ts [path-to-txt]
 *       (defaults to sales_-_Inbox_emails.txt)
 *
 * For every email it:
 *   1. splits the user's own words from quoted history + signatures + HTML cruft
 *   2. for YOUR replies, pairs them with the incoming email they answered
 *      (trigger → reply — the RAG episodic-memory shape)
 *   3. categorizes (gate/access-control vocabulary aware)
 *   4. drops genuine junk (marketing spam, auto-replies, empty shells) and says why
 *
 * Outputs:
 *   data/email-corpus/refined.jsonl        structured records (for RAG / few-shot)
 *   data/email-corpus/refined.txt          human-readable cleaned pairs
 *   data/email-corpus/refined-dropped.txt  what was dropped + the reason
 */
import { promises as fs } from "fs";
import path from "path";
import { BUSINESS_CATEGORIES, type BusinessCategory } from "../src/lib/classify/categories";

const OWN_DOMAIN = (process.env.WRITING_SAMPLES_DOMAIN || "myautogate.com").toLowerCase().replace(/^@/, "");
const INPUT = process.argv[2] || path.join(process.cwd(), "src", "app", "api", "zoho", "example_emails", "sales_-_Inbox_emails.txt");
const OUTPUT_DIR = path.join(process.cwd(), "data", "email-corpus");

// ---- cleaning --------------------------------------------------------------

/** Markers where quoted reply history begins — everything after is the trigger. */
const QUOTE_MARKERS: RegExp[] = [
  /[-=]{2,}\s*original message/i,
  /[-=]{2,}\s*forwarded message/i,
  /On\s.{0,90}?\swrote:/i,
  /\bFrom:\s.{0,80}?@/i,
  /\bSent:\s.{0,40}?\d{4}/i,
];

/** Signature / footer / disclaimer markers — cut the body here. */
const SIG_MARKERS: RegExp[] = [
  /5562\s*Port\s*Royal/i,
  /Prevent-?\s*Protect-?\s*Deter/i,
  /www\.myautogate\.com/i,
  /If you need service for any reason/i,
  /Sent from my /i,
  /CONFIDENTIALITY NOTICE/i,
  /This (e-?mail|message)\b.{0,40}\b(confidential|intended|attachments)/i,
  /\(703\)\s*333-3112/,
];

/** Auto-reply / bot noise — these emails teach nothing. */
const AUTOREPLY_RE = /\b(out of office|automatic reply|auto-?reply|do not reply|undeliverable|delivery (has )?failed|mailer-daemon)\b/i;

/** Cold marketing spam (incoming) — no relationship, no reply value. */
const SPAM_RE = /\b(unsubscribe|wechat|whatsapp\D{0,4}\+?\d{6}|we manufacture|overseas markets|importers? in (asia|africa|europe)|SEO services|rank(ing)? on google|guest post|backlink)\b/i;

function firstMarkerIndex(text: string, markers: RegExp[], minIdx = 20): number {
  let idx = -1;
  for (const re of markers) {
    const m = text.match(re);
    if (m && m.index != null && m.index > minIdx) {
      idx = idx === -1 ? m.index : Math.min(idx, m.index);
    }
  }
  return idx;
}

function normalize(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(Number(c)))
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The sender's own words: strip quoted history, then strip the signature. */
function extractOwnWords(rawBody: string): string {
  const q = firstMarkerIndex(rawBody, QUOTE_MARKERS);
  let text = q === -1 ? rawBody : rawBody.slice(0, q);
  const s = firstMarkerIndex(text, SIG_MARKERS);
  if (s !== -1) text = text.slice(0, s);
  return normalize(text);
}

/** The quoted trigger beneath a reply: the message being answered. */
function extractTrigger(rawBody: string): string {
  const q = firstMarkerIndex(rawBody, QUOTE_MARKERS);
  if (q === -1) return "";
  let quoted = rawBody.slice(q);
  // Drop the quote header line(s) up to the first blank line, keep the body.
  const bodyStart = quoted.indexOf("\n\n");
  if (bodyStart !== -1) quoted = quoted.slice(bodyStart + 2);
  const sig = firstMarkerIndex(quoted, SIG_MARKERS);
  if (sig !== -1) quoted = quoted.slice(0, sig);
  return normalize(quoted).slice(0, 1200);
}

// ---- categorizer (gate/access-control aware) -------------------------------

const CATEGORY_RULES: Array<{ category: BusinessCategory; re: RegExp }> = [
  { category: "invoice_question", re: /\b(invoice|payment|paid|past due|overdue|refund|receipt|billing|statement|balance due|amount owed|remittance)\b/i },
  { category: "complaint", re: /\b(complaint|not working|doesn'?t work|stopped working|won'?t (open|close)|not (open|clos)ing|stuck (open|clos)|broken|damaged?|disappointed|unacceptable|still waiting|frustrat|no one (has )?(called|responded)|escalat)\b/i },
  { category: "quote_request", re: /\b(quote|quotation|pricing|price|estimate|proposal|how much|cost|ballpark|rate sheet)\b/i },
  { category: "support", re: /\b(help|support|install|installation|set ?up|activate|activation|account|not active|service|troubleshoot|reschedul|schedule|technician|tech |repair|maintenance|warranty|gate|arm barrier|operator|keypad|remote|loop detector|camera|come out|dispatch)\b/i },
  { category: "sales_inquiry", re: /\b(interested|supplier|manufactur|distributor|inquiry|enquiry|looking for|would like to|new project|purchase|order|wholesale|catalog|product line|partnership)\b/i },
];

function categorize(subject: string, body: string): BusinessCategory {
  const hay = `${subject}\n${body}`;
  for (const { category, re } of CATEGORY_RULES) if (re.test(hay)) return category;
  return "other";
}

// ---- parsing ---------------------------------------------------------------

function extractAddress(v: string): string {
  const a = v.match(/<([^>]+@[^>]+)>/);
  if (a) return a[1].trim().toLowerCase();
  const b = v.match(/[^\s<>]+@[^\s<>]+/);
  return b ? b[0].trim().toLowerCase() : "";
}
function headerField(header: string, field: string): string {
  const line = header.split("\n").find((l) => new RegExp(`^${field}:`, "i").test(l));
  return line ? line.replace(new RegExp(`^${field}:`, "i"), "").trim() : "";
}

interface Refined {
  id: string;
  direction: "incoming" | "outgoing";
  category: BusinessCategory;
  subject: string;
  fromEmail: string;
  trigger: string;   // the incoming email being answered ("" if none)
  reply: string;     // the sender's own cleaned words
  wordCount: number;
}

const MIN_WORDS = 6;

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

async function main() {
  console.log(`=== Refining ${path.basename(INPUT)} ===\n`);
  const content = (await fs.readFile(INPUT, "utf8")).replace(/\r\n/g, "\n");
  const blocks = content.split(/^===== EMAIL \d+ of \d+ =====\s*$/m).slice(1);

  const kept: Refined[] = [];
  const dropped: Array<{ id: string; reason: string; preview: string }> = [];

  blocks.forEach((block, i) => {
    const id = `sales#${i + 1}`;
    const sepIdx = block.indexOf("\n\n");
    if (sepIdx === -1) return dropped.push({ id, reason: "no header/body split", preview: block.slice(0, 60) });
    const header = block.slice(0, sepIdx);
    const rawBody = block.slice(sepIdx + 2);

    const fromEmail = extractAddress(headerField(header, "From"));
    const subject = headerField(header, "Subject") || "(no subject)";
    const direction: Refined["direction"] = fromEmail.endsWith("@" + OWN_DOMAIN) ? "outgoing" : "incoming";

    const reply = extractOwnWords(rawBody);
    const preview = reply.slice(0, 70).replace(/\n/g, " ");

    if (AUTOREPLY_RE.test(subject) || AUTOREPLY_RE.test(reply)) {
      return dropped.push({ id, reason: "auto-reply / bot", preview });
    }
    if (direction === "incoming" && SPAM_RE.test(`${subject}\n${reply}`)) {
      return dropped.push({ id, reason: "cold marketing spam", preview });
    }
    if (wordCount(reply) < MIN_WORDS) {
      return dropped.push({ id, reason: `too short (<${MIN_WORDS} words)`, preview });
    }

    kept.push({
      id,
      direction,
      category: categorize(subject, reply),
      subject,
      fromEmail,
      trigger: direction === "outgoing" ? extractTrigger(rawBody) : "",
      reply,
      wordCount: wordCount(reply),
    });
  });

  // Dedupe near-identical replies (repeated boilerplate answers).
  const seen = new Set<string>();
  const unique = kept.filter((r) => {
    const key = r.reply.slice(0, 120).toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) {
      dropped.push({ id: r.id, reason: "duplicate reply", preview: key.slice(0, 70) });
      return false;
    }
    seen.add(key);
    return true;
  });

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(
    path.join(OUTPUT_DIR, "refined.jsonl"),
    unique.map((r) => JSON.stringify(r)).join("\n") + "\n",
    "utf8"
  );

  const pairs = unique.filter((r) => r.direction === "outgoing" && r.trigger.length > 0);
  const readable = unique
    .map((r) => {
      const head = `##### ${r.id} | ${r.category} | ${r.direction} #####`;
      const trig = r.trigger ? `[INCOMING / TRIGGER]\n${r.trigger}\n` : "";
      return `${head}\n${trig}[REPLY — user's voice]\n${r.reply}\n`;
    })
    .join("\n");
  await fs.writeFile(path.join(OUTPUT_DIR, "refined.txt"), readable, "utf8");
  await fs.writeFile(
    path.join(OUTPUT_DIR, "refined-dropped.txt"),
    dropped.map((d) => `[${d.reason}] ${d.id}: ${d.preview}`).join("\n") + "\n",
    "utf8"
  );

  // ---- report ----
  const byCat: Record<string, number> = {};
  for (const c of BUSINESS_CATEGORIES) byCat[c] = unique.filter((r) => r.category === c).length;
  const dropReasons: Record<string, number> = {};
  for (const d of dropped) dropReasons[d.reason] = (dropReasons[d.reason] ?? 0) + 1;

  console.log(`Raw emails in file:        ${blocks.length}`);
  console.log(`Kept (useful):             ${unique.length}`);
  console.log(`  ├─ outgoing (your voice): ${unique.filter((r) => r.direction === "outgoing").length}`);
  console.log(`  ├─ incoming (as context): ${unique.filter((r) => r.direction === "incoming").length}`);
  console.log(`  └─ trigger→reply PAIRS:   ${pairs.length}`);
  console.log(`Dropped (not useful):      ${dropped.length}`);
  for (const [reason, n] of Object.entries(dropReasons).sort((a, b) => b[1] - a[1])) {
    console.log(`     - ${reason}: ${n}`);
  }
  console.log(`\nBy category (kept):`);
  for (const [c, n] of Object.entries(byCat)) console.log(`     ${c.padEnd(18)} ${n}`);
  console.log(`\nWrote:`);
  console.log(`  ${path.join("data", "email-corpus", "refined.jsonl")}   (${unique.length} records)`);
  console.log(`  ${path.join("data", "email-corpus", "refined.txt")}     (human-readable)`);
  console.log(`  ${path.join("data", "email-corpus", "refined-dropped.txt")} (${dropped.length} dropped + reasons)`);

  const samplePair = pairs.find((p) => p.wordCount > 25) || pairs[0];
  if (samplePair) {
    console.log(`\n--- sample trigger→reply pair (${samplePair.category}) ---`);
    console.log(`INCOMING: ${samplePair.trigger.slice(0, 300)}`);
    console.log(`\nYOUR REPLY: ${samplePair.reply.slice(0, 300)}`);
  }
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
