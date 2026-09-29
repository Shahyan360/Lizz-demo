import { promises as fs } from "fs";
import path from "path";
import type { BusinessCategory } from "../classify/categories";

/**
 * Category-matched few-shot examples.
 *
 * When an incoming email is classified (e.g. "complaint"), the draft path reads
 * ONLY that category's file — `data/email-corpus/by-category/<category>.txt` —
 * and returns the user's own replies from it, ranked by relevance to the
 * incoming email. This narrows the few-shot examples to same-situation replies
 * instead of a blind spread across the whole corpus.
 *
 * The category files are produced by `scripts/split-by-category.ts`. Each
 * "outgoing" block ends with a `[YOUR REPLY]` section — that's what we extract.
 */

/** Where the split category files live. Override with CATEGORY_SAMPLES_DIR. */
const BY_CATEGORY_DIR = process.env.CATEGORY_SAMPLES_DIR
  ? path.resolve(process.env.CATEGORY_SAMPLES_DIR)
  : path.join(process.cwd(), "data", "email-corpus", "by-category");

const MIN_REPLY_CHARS = 20;

// ---- lightweight lexical relevance (no API / no quota) ---------------------

const STOP = new Set(
  "the a an and or but to of in on at for with is are was were be i you we they it this that my your our as so if".split(" ")
);

function termFreq(text: string): Map<string, number> {
  const tf = new Map<string, number>();
  for (const w of text.toLowerCase().replace(/[^a-z0-9'\s]/g, " ").split(/\s+/)) {
    if (w.length < 2 || STOP.has(w)) continue;
    tf.set(w, (tf.get(w) ?? 0) + 1);
  }
  return tf;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const v of a.values()) magA += v * v;
  for (const v of b.values()) magB += v * v;
  for (const [k, v] of a) if (b.has(k)) dot += v * (b.get(k) as number);
  return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
}

// ---- reading the category file --------------------------------------------

/** Extract the user's own `[YOUR REPLY]` bodies from one category file. */
async function loadCategoryReplies(category: BusinessCategory): Promise<string[]> {
  const file = path.join(BY_CATEGORY_DIR, `${category}.txt`);
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    return []; // file missing — caller falls back to blind samples
  }

  // Split into per-email segments, keeping each segment's header line.
  const segments = raw.split(/(?=^===== EMAIL )/m);
  const replies: string[] = [];
  for (const seg of segments) {
    // Only "outgoing" blocks carry the user's own words.
    if (!/\|\s*outgoing\s*=====/.test(seg)) continue;
    const marker = seg.indexOf("[YOUR REPLY]");
    if (marker === -1) continue;
    const reply = seg.slice(marker + "[YOUR REPLY]".length).trim();
    if (reply.length >= MIN_REPLY_CHARS) replies.push(reply);
  }
  return replies;
}

/**
 * Returns up to `max` of the user's replies from the given category, ranked by
 * lexical relevance to the incoming email. Empty array if the category file is
 * missing or has no usable replies (the caller then backfills).
 */
export async function getCategorySamples(params: {
  category: BusinessCategory;
  incomingText: string;
  max?: number;
}): Promise<string[]> {
  const max = params.max ?? 6;
  const replies = await loadCategoryReplies(params.category);
  if (replies.length === 0) return [];

  const q = termFreq(params.incomingText);
  return replies
    .map((reply) => ({ reply, score: cosine(q, termFreq(reply)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((r) => r.reply);
}
