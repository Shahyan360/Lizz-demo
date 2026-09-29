import { describe, expect, it } from "vitest";
import { getCategorySamples } from "@/lib/reply/category-samples";

/**
 * Unit test for the category-matched few-shot selection ([category-samples.ts]).
 *
 * This is the deterministic core of the prompt-construction pipeline: given an
 * incoming email it extracts the user's own `[YOUR REPLY]` bodies from a category
 * file and ranks them by lexical relevance. No network, no DB, no LLM — the
 * module reads its corpus from `CATEGORY_SAMPLES_DIR`, which we point at a small
 * committed fixture so the ranking is fully reproducible in CI.
 */
describe("getCategorySamples (few-shot selection)", () => {
  // CATEGORY_SAMPLES_DIR is pointed at tests/fixtures/by-category via vitest.config.

  it("extracts only usable outgoing [YOUR REPLY] bodies", async () => {
    const samples = await getCategorySamples({
      category: "complaint",
      incomingText: "anything",
      max: 10,
    });
    // Fixture has 5 blocks: 2 valid outgoing replies, 1 with no reply marker,
    // 1 incoming (must be skipped), 1 too-short ("ok" < MIN_REPLY_CHARS).
    expect(samples).toHaveLength(2);
    expect(samples.join("\n")).not.toContain("incoming block");
    expect(samples.join("\n")).not.toContain("should be ignored");
  });

  it("ranks the most lexically relevant reply first", async () => {
    const samples = await getCategorySamples({
      category: "complaint",
      incomingText: "my gate is stuck and the opener motor keeps straining",
      max: 6,
    });
    // The gate/opener/motor reply should outrank the invoice/billing one.
    expect(samples[0]).toContain("gate");
    expect(samples[0]).toContain("opener");
  });

  it("respects the max limit", async () => {
    const samples = await getCategorySamples({
      category: "complaint",
      incomingText: "gate",
      max: 1,
    });
    expect(samples).toHaveLength(1);
  });

  it("returns an empty array for a missing category file (caller backfills)", async () => {
    const samples = await getCategorySamples({
      category: "invoice_question",
      incomingText: "where is my refund",
    });
    expect(samples).toEqual([]);
  });
});
