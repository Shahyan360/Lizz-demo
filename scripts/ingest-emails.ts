/**
 * Email corpus ingestion — turns the raw .txt exports into clean, categorized,
 * easy-to-read chunks for Gemini few-shot / RAG learning.
 *
 * Run:  npx ts-node scripts/ingest-emails.ts
 *
 * Input : src/app/api/zoho/example_emails/*.txt   (===== EMAIL N of M ===== format)
 * Output: data/email-corpus/<category>.jsonl       (one email per line)
 *         data/email-corpus/_summary.json          (counts per category/direction)
 *
 * Categorization reuses the 6 BUSINESS_CATEGORIES already defined in
 * src/lib/classify/categories.ts, via a keyword heuristic (no LLM cost).
 */
import { promises as fs } from "fs";
import path from "path";
import { BUSINESS_CATEGORIES, type BusinessCategory } from "../src/lib/classify/categories";

const OWN_DOMAIN = (process.env.WRITING_SAMPLES_DOMAIN || "myautogate.com")
  .toLowerCase()
  .replace(/^@/, "");

const INPUT_DIR = path.join(process.cwd(), "src", "app", "api", "zoho", "example_emails");
const OUTPUT_DIR = path.join(process.cwd(), "data", "email-corpus");

/** Keep chunk bodies readable — trim very long threads. */
const MAX_BODY_CHARS = 1500;

interface EmailChunk {
  id: string;
  sourceFile: string;
  emailIndex: number;
  direction: "incoming" | "outgoing";
  category: BusinessCategory;
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  date: string;
  wordCount: number;
  body: string;
}

// ---- parsing helpers -------------------------------------------------------

function extractAddress(fromValue: string): string {
  const angled = fromValue.match(/<([^>]+@[^>]+)>/);
  if (angled) return angled[1].trim().toLowerCase();
  const bare = fromValue.match(/[^\s<>]+@[^\s<>]+/);
  return bare ? bare[0].trim().toLowerCase() : "";
}

function extractName(fromValue: string): string {
  const name = fromValue.replace(/<[^>]*>/g, "").replace(/["']/g, "").trim();
  return name || extractAddress(fromValue);
}

/** Cuts off quoted reply history so only this message's own words remain. */
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

function cleanBody(raw: string): string {
  const stripped = stripQuoted(raw)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return stripped.length > MAX_BODY_CHARS
    ? stripped.slice(0, MAX_BODY_CHARS).trimEnd() + " […]"
    : stripped;
}

function headerField(header: string, field: string): string {
  const line = header.split("\n").find((l) => new RegExp(`^${field}:`, "i").test(l));
  return line ? line.replace(new RegExp(`^${field}:`, "i"), "").trim() : "";
}

// ---- keyword categorizer (reuses BUSINESS_CATEGORIES) ----------------------

/** Ordered rules — first match wins (most specific/urgent first). */
const CATEGORY_RULES: Array<{ category: BusinessCategory; re: RegExp }> = [
  {
    category: "invoice_question",
    re: /\b(invoice|payment|paid|past due|overdue|refund|receipt|billing|statement|balance due|amount owed|remittance)\b/i,
  },
  {
    category: "complaint",
    re: /\b(complaint|not working|doesn'?t work|broken|damaged|disappointed|unacceptable|still waiting|frustrat|refund|poor service|no one (has )?(called|responded)|escalat)\b/i,
  },
  {
    category: "quote_request",
    re: /\b(quote|quotation|pricing|price|estimate|proposal|how much|cost|ballpark|rate sheet)\b/i,
  },
  {
    category: "support",
    re: /\b(help|support|install|installation|set ?up|activate|activation|account|not active|service call|troubleshoot|reschedul|schedule|technician|repair|maintenance|warranty)\b/i,
  },
  {
    category: "sales_inquiry",
    re: /\b(interested|supplier|manufactur|distributor|inquiry|enquiry|looking for|would like to|new project|purchase|buy|order|wholesale|catalog|product line|partnership)\b/i,
  },
];

function categorize(subject: string, body: string): BusinessCategory {
  const hay = `${subject}\n${body}`;
  for (const { category, re } of CATEGORY_RULES) {
    if (re.test(hay)) return category;
  }
  return "other";
}

// ---- main ------------------------------------------------------------------

function parseFile(content: string, sourceFile: string): EmailChunk[] {
  const normalized = content.replace(/\r\n/g, "\n");
  const blocks = normalized.split(/^===== EMAIL \d+ of \d+ =====\s*$/m).slice(1);
  const chunks: EmailChunk[] = [];

  blocks.forEach((block, i) => {
    const sepIdx = block.indexOf("\n\n");
    if (sepIdx === -1) return;
    const header = block.slice(0, sepIdx);
    const rawBody = block.slice(sepIdx + 2);

    const fromValue = headerField(header, "From");
    if (!fromValue) return;
    const fromEmail = extractAddress(fromValue);
    const subject = headerField(header, "Subject");
    const body = cleanBody(rawBody);
    if (body.length < 20) return; // skip empty / signature-only shells

    const direction: EmailChunk["direction"] = fromEmail.endsWith("@" + OWN_DOMAIN)
      ? "outgoing"
      : "incoming";

    chunks.push({
      id: `${sourceFile}#${i + 1}`,
      sourceFile,
      emailIndex: i + 1,
      direction,
      category: categorize(subject, body),
      fromName: extractName(fromValue),
      fromEmail,
      to: headerField(header, "To"),
      subject: subject || "(no subject)",
      date: headerField(header, "Date"),
      wordCount: body.split(/\s+/).filter(Boolean).length,
      body,
    });
  });

  return chunks;
}

async function main() {
  console.log(`=== Email corpus ingestion ===`);
  console.log(`own domain = @${OWN_DOMAIN}`);
  console.log(`input      = ${INPUT_DIR}`);
  console.log(`output     = ${OUTPUT_DIR}\n`);

  const files = (await fs.readdir(INPUT_DIR)).filter((f) =>
    f.toLowerCase().endsWith(".txt")
  );
  if (files.length === 0) {
    console.error("No .txt files found in input dir.");
    process.exit(1);
  }

  const all: EmailChunk[] = [];
  for (const file of files) {
    const content = await fs.readFile(path.join(INPUT_DIR, file), "utf8");
    const parsed = parseFile(content, file);
    console.log(`parsed ${String(parsed.length).padStart(5)} emails from ${file}`);
    all.push(...parsed);
  }

  // Group by category and write one .jsonl per category.
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const byCategory = new Map<BusinessCategory, EmailChunk[]>();
  for (const c of BUSINESS_CATEGORIES) byCategory.set(c, []);
  for (const chunk of all) byCategory.get(chunk.category)!.push(chunk);

  const summary: Record<string, unknown> = {
    totalEmails: all.length,
    incoming: all.filter((c) => c.direction === "incoming").length,
    outgoing: all.filter((c) => c.direction === "outgoing").length,
    byCategory: {} as Record<string, number>,
    ownDomain: OWN_DOMAIN,
    generatedFromFiles: files,
  };

  console.log(`\n--- results ---`);
  for (const category of BUSINESS_CATEGORIES) {
    const chunks = byCategory.get(category)!;
    const lines = chunks.map((c) => JSON.stringify(c)).join("\n");
    await fs.writeFile(path.join(OUTPUT_DIR, `${category}.jsonl`), lines + (lines ? "\n" : ""), "utf8");
    (summary.byCategory as Record<string, number>)[category] = chunks.length;
    const inc = chunks.filter((c) => c.direction === "incoming").length;
    const out = chunks.filter((c) => c.direction === "outgoing").length;
    console.log(
      `${category.padEnd(18)} ${String(chunks.length).padStart(5)}  (incoming ${inc}, outgoing ${out})`
    );
  }

  await fs.writeFile(
    path.join(OUTPUT_DIR, "_summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );

  console.log(`\ntotal ${all.length} emails  →  ${OUTPUT_DIR}`);
  console.log(`  incoming (customer): ${summary.incoming}`);
  console.log(`  outgoing (your replies): ${summary.outgoing}`);

  // Show one sample chunk so you can eyeball the format.
  const sample = all.find((c) => c.direction === "outgoing") || all[0];
  console.log(`\n--- sample chunk ---\n${JSON.stringify(sample, null, 2)}`);
}

main().catch((err) => {
  console.error("FAILED:", err?.message || err);
  process.exit(1);
});
