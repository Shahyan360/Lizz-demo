/**
 * Retrieve the 5 most relevant example replies for an incoming email.
 *
 * Run:  npx ts-node scripts/retrieve-examples.ts
 *
 * Pipeline:  incoming email
 *              → categorize (same 6 buckets as the corpus)
 *              → candidate pool = YOUR replies (outgoing) in that category
 *              → rank by lexical relevance to the incoming text
 *              → return top 5  (these become Gemini's few-shot examples)
 *
 * Relevance here is a dependency-free TF cosine (instant, no API, no quota).
 * Swap `rankLexical` for an embedding cosine later for true semantic matching.
 */
import { promises as fs } from "fs";
import path from "path";
import { BUSINESS_CATEGORIES, type BusinessCategory } from "../src/lib/classify/categories";

const CORPUS_DIR = path.join(process.cwd(), "data", "email-corpus");
const TOP_K = 5;

interface EmailChunk {
  id: string;
  direction: "incoming" | "outgoing";
  category: BusinessCategory;
  fromName: string;
  subject: string;
  wordCount: number;
  body: string;
}

// ---- same categorizer as ingest (kept local so this script is standalone) --
const CATEGORY_RULES: Array<{ category: BusinessCategory; re: RegExp }> = [
  { category: "invoice_question", re: /\b(invoice|payment|paid|past due|overdue|refund|receipt|billing|statement|balance due|amount owed|remittance)\b/i },
  { category: "complaint", re: /\b(complaint|not working|doesn'?t work|broken|damaged|disappointed|unacceptable|still waiting|frustrat|poor service|no one (has )?(called|responded)|escalat)\b/i },
  { category: "quote_request", re: /\b(quote|quotation|pricing|price|estimate|proposal|how much|cost|ballpark|rate sheet)\b/i },
  { category: "support", re: /\b(help|support|install|installation|set ?up|activate|activation|account|not active|service call|troubleshoot|reschedul|schedule|technician|repair|maintenance|warranty)\b/i },
  { category: "sales_inquiry", re: /\b(interested|supplier|manufactur|distributor|inquiry|enquiry|looking for|would like to|new project|purchase|buy|order|wholesale|catalog|product line|partnership)\b/i },
];

function categorize(subject: string, body: string): BusinessCategory {
  const hay = `${subject}\n${body}`;
  for (const { category, re } of CATEGORY_RULES) if (re.test(hay)) return category;
  return "other";
}

// ---- lexical relevance -----------------------------------------------------
const STOP = new Set("the a an and or but to of in on at for with is are was were be i you we they it this that my your our as so if we'll i'll".split(" "));

function termFreq(text: string): Map<string, number> {
  const tf = new Map<string, number>();
  for (const w of text.toLowerCase().replace(/[^a-z0-9'\s]/g, " ").split(/\s+/)) {
    if (w.length < 2 || STOP.has(w)) continue;
    tf.set(w, (tf.get(w) ?? 0) + 1);
  }
  return tf;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, magA = 0, magB = 0;
  for (const v of a.values()) magA += v * v;
  for (const v of b.values()) magB += v * v;
  for (const [k, v] of a) if (b.has(k)) dot += v * (b.get(k) as number);
  return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
}

// ---- corpus loading --------------------------------------------------------
async function loadChunks(): Promise<EmailChunk[]> {
  const all: EmailChunk[] = [];
  for (const category of BUSINESS_CATEGORIES) {
    let raw: string;
    try {
      raw = await fs.readFile(path.join(CORPUS_DIR, `${category}.jsonl`), "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split("\n")) {
      if (line.trim()) all.push(JSON.parse(line));
    }
  }
  return all;
}

/** Top-K outgoing replies most relevant to the incoming email. */
function rankLexical(
  incomingText: string,
  pool: EmailChunk[],
  k: number
): Array<{ chunk: EmailChunk; score: number }> {
  const q = termFreq(incomingText);
  return pool
    .map((chunk) => ({ chunk, score: cosine(q, termFreq(chunk.body)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export async function getExamplesForIncoming(incoming: {
  subject: string;
  body: string;
}): Promise<{ category: BusinessCategory; examples: Array<{ chunk: EmailChunk; score: number }> }> {
  const chunks = await loadChunks();
  const category = categorize(incoming.subject, incoming.body);
  const text = `${incoming.subject}\n${incoming.body}`;

  // Prefer your replies in the SAME category; backfill from other replies if thin.
  const sameCat = chunks.filter((c) => c.direction === "outgoing" && c.category === category);
  const otherCat = chunks.filter((c) => c.direction === "outgoing" && c.category !== category);
  const ranked = rankLexical(text, sameCat, TOP_K);
  if (ranked.length < TOP_K) {
    ranked.push(...rankLexical(text, otherCat, TOP_K - ranked.length));
  }
  return { category, examples: ranked };
}

// ---- demo ------------------------------------------------------------------
async function main() {
  const incoming = {
    subject: "Re: Gate not opening",
    body: "Hi, our automatic gate stopped working this morning and won't open at all. Can someone come out and take a look? We really need this fixed as soon as possible.",
  };

  console.log("=== INCOMING EMAIL ===");
  console.log(`Subject: ${incoming.subject}`);
  console.log(`Body: ${incoming.body}\n`);

  const { category, examples } = await getExamplesForIncoming(incoming);
  console.log(`Detected category: ${category}`);
  console.log(`Retrieved ${examples.length} most-relevant example replies:\n`);

  examples.forEach(({ chunk, score }, i) => {
    console.log(`--- Example ${i + 1}  (relevance ${score.toFixed(3)}, ${chunk.category}, ${chunk.wordCount} words) ---`);
    console.log(`Subject: ${chunk.subject}`);
    console.log(chunk.body.slice(0, 400) + (chunk.body.length > 400 ? " […]" : ""));
    console.log("");
  });
}

main().catch((err) => {
  console.error("FAILED:", err?.message || err);
  process.exit(1);
});
