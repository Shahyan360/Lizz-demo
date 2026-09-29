/**
 * Split the refined corpus into one .txt file per category.
 *
 * Run:  npx ts-node scripts/split-by-category.ts
 *       (run scripts/refine-emails.ts first — it produces refined.jsonl)
 *
 * Result: data/email-corpus/by-category/<category>.txt
 *   The draft pipeline detects an incoming email's category, then reads ONLY
 *   that one file for its few-shot examples — instead of scanning everything.
 */
import { promises as fs } from "fs";
import path from "path";
import { BUSINESS_CATEGORIES, CATEGORY_LABELS, type BusinessCategory } from "../src/lib/classify/categories";

const CORPUS_DIR = path.join(process.cwd(), "data", "email-corpus");
const OUT_DIR = path.join(CORPUS_DIR, "by-category");

interface Refined {
  id: string;
  direction: "incoming" | "outgoing";
  category: BusinessCategory;
  subject: string;
  fromEmail: string;
  trigger: string;
  reply: string;
  wordCount: number;
}

function renderBlock(r: Refined, n: number, total: number): string {
  const header = `===== EMAIL ${n} of ${total} | ${r.category} | ${r.direction} =====`;
  const meta = `Subject: ${r.subject}\nFrom: ${r.fromEmail}`;
  const trigger = r.trigger ? `\n\n[INCOMING / TRIGGER]\n${r.trigger}` : "";
  const label = r.direction === "outgoing" ? "[YOUR REPLY]" : "[EMAIL BODY]";
  return `${header}\n${meta}${trigger}\n\n${label}\n${r.reply}\n`;
}

async function main() {
  const raw = await fs.readFile(path.join(CORPUS_DIR, "refined.jsonl"), "utf8").catch(() => {
    throw new Error("refined.jsonl not found — run: npx ts-node scripts/refine-emails.ts");
  });

  const records: Refined[] = raw
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));

  await fs.mkdir(OUT_DIR, { recursive: true });

  // Group by category.
  const byCat = new Map<BusinessCategory, Refined[]>();
  for (const c of BUSINESS_CATEGORIES) byCat.set(c, []);
  for (const r of records) byCat.get(r.category)!.push(r);

  console.log(`=== Splitting ${records.length} refined emails into ${BUSINESS_CATEGORIES.length} category files ===\n`);

  const index: string[] = [];
  for (const category of BUSINESS_CATEGORIES) {
    const items = byCat.get(category)!;
    // Put your own replies first — they're the highest-value few-shot examples.
    items.sort((a, b) => Number(b.direction === "outgoing") - Number(a.direction === "outgoing"));

    const body = items.map((r, i) => renderBlock(r, i + 1, items.length)).join("\n");
    const preamble =
      `# ${CATEGORY_LABELS[category]} (${category})\n` +
      `# ${items.length} emails | ${items.filter((r) => r.direction === "outgoing").length} of your replies, ` +
      `${items.filter((r) => r.trigger).length} trigger→reply pairs\n` +
      `# Read this file when an incoming email is classified as "${category}".\n\n`;

    const file = path.join(OUT_DIR, `${category}.txt`);
    await fs.writeFile(file, preamble + body, "utf8");

    const outgoing = items.filter((r) => r.direction === "outgoing").length;
    console.log(`${category.padEnd(18)} ${String(items.length).padStart(4)} emails  (${outgoing} your replies)  → by-category/${category}.txt`);
    index.push(`${category}.txt\t${items.length} emails\t${outgoing} replies`);
  }

  await fs.writeFile(path.join(OUT_DIR, "_index.tsv"), index.join("\n") + "\n", "utf8");
  console.log(`\nWrote ${BUSINESS_CATEGORIES.length} files to ${path.relative(process.cwd(), OUT_DIR)}\\`);
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
