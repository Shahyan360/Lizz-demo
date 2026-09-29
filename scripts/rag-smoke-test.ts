/**
 * RAG DB smoke test — proves the full vector loop works on your setup.
 *
 * Run:  npx ts-node scripts/rag-smoke-test.ts
 *
 * It:
 *   1. connects to Qdrant + creates the `executive_memory` collection (if absent)
 *   2. generates a REAL Gemini embedding (and detects the mock-vector fallback)
 *   3. upserts a test memory, then searches it back
 *   4. reports the similarity scores
 *   5. deletes the test point it inserted (leaves your real data untouched)
 *
 * Safe to delete this file afterwards — it touches nothing in the app.
 */
import "dotenv/config";
import { randomUUID } from "crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import { VectorService } from "../src/services/vector.service";

// Detect the silent mock-vector fallback by watching for its warning.
let usedMockVector = false;
const originalWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  if (args.some((a) => String(a).includes("mock vector"))) usedMockVector = true;
  originalWarn(...args);
};

const TEST_TENANT = "00000000-0000-0000-0000-00000000test";
const line = (s = "") => console.log(s);

async function main() {
  line("=== RAG DB smoke test ===\n");
  line(`QDRANT_URL = ${process.env.QDRANT_URL || "(default) http://localhost:6333"}`);
  line(`GEMINI_API_KEY set = ${Boolean(process.env.GEMINI_API_KEY)}\n`);

  // 1. Collection
  await VectorService.initCollection();
  line("[1/4] ✓ Collection `executive_memory` ready");

  // 2. Real embedding check
  const probe = await VectorService.generateEmbedding("scheduling test probe");
  line(
    `[2/4] ${usedMockVector ? "⚠" : "✓"} Embedding generated ` +
      `(dim=${probe.length}, source=${usedMockVector ? "MOCK — Gemini FAILED" : "real Gemini"})`
  );

  // 3. Write two memories: a "reschedule" trigger and an unrelated one.
  const rescheduleId = randomUUID();
  const invoiceId = randomUUID();

  await VectorService.upsertMemory(
    rescheduleId,
    "Can we push our meeting to Thursday afternoon instead?",
    {
      contactId: "smoke@test.local",
      threadId: "smoke-thread-1",
      messageId: "smoke-msg-1",
      text: "Sure — Thursday at 3pm works for me. I'll send an updated invite.",
      type: "episodic",
      timestamp: new Date().toISOString(),
    }
  );
  await VectorService.upsertMemory(invoiceId, "Your invoice #4471 is overdue.", {
    contactId: "billing@test.local",
    threadId: "smoke-thread-2",
    messageId: "smoke-msg-2",
    text: "Apologies — payment has been sent today.",
    type: "episodic",
    timestamp: new Date().toISOString(),
  });
  line("[3/4] ✓ Upserted 2 test memories (reschedule + invoice)");

  // 4. Semantic search with DIFFERENT words than the stored trigger.
  const results = await VectorService.searchSimilarMemories({
    queryText: "I need to reschedule our call to later this week",
    type: "episodic",
    limit: 2,
  });

  line("[4/4] ✓ Search returned:");
  results.forEach((r, i) => {
    line(`      ${i + 1}. score=${r.score.toFixed(4)}  reply="${r.payload.text}"`);
  });

  const top = results[0];
  const passedSemantics =
    !usedMockVector && top && top.payload.threadId === "smoke-thread-1";
  line("");
  line(
    passedSemantics
      ? "RESULT: ✅ PASS — semantic match found the reschedule memory by MEANING (no shared words)."
      : usedMockVector
      ? "RESULT: ⚠ RAN, but on MOCK vectors — fix your Gemini key/quota before trusting retrieval."
      : "RESULT: ⚠ Ran, but the top match wasn't the expected memory — inspect scores above."
  );

  // Cleanup — remove only the two test points.
  const client = new QdrantClient({
    url: process.env.QDRANT_URL || "http://localhost:6333",
    apiKey: process.env.QDRANT_API_KEY,
  });
  await client.delete("executive_memory", {
    wait: true,
    points: [rescheduleId, invoiceId],
  });
  line("\nCleanup ✓ test points deleted (your real data is untouched).");
}

main().catch((err) => {
  console.error("\nRESULT: ❌ FAILED —", err?.message || err);
  process.exit(1);
});
