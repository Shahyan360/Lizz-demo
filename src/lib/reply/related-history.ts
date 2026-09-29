import { VectorService } from "../../services/vector.service";
import {
  RELATED_HISTORY_MIN_SCORE,
  RELATED_HISTORY_SEARCH_LIMIT,
} from "../context-builder/constants";

/**
 * Semantic ("RAG") retrieval of past replies for the LIVE Zoho reply pipeline.
 *
 * Read side of the loop closed by `persistApprovedDraftMemory` (write side —
 * see `send-outcome.ts` / `route.ts`'s auto-send branch). Every confirmed-sent
 * reply is embedded and stored in Qdrant under the incoming email's text; here
 * we embed the CURRENT incoming email and pull back whichever past replies are
 * semantically closest, so Phase 2 can match tone/approach on senders and
 * topics we've never seen before (contact-history.ts only covers this exact
 * sender's own thread history).
 *
 * Reuses the tier-resolver's tuning constants (score threshold, fan-out) so
 * the two retrieval paths stay consistent instead of drifting apart.
 */

const MAX_EXAMPLES = 3;
const MAX_EXAMPLE_CHARS = 900;

export async function buildRelatedReplyExamples(params: {
  /** The new inbound message text (quoted history already stripped). */
  queryText: string;
  /** Excluded from results so a reply never gets used as its own example. */
  currentThreadId?: string;
}): Promise<string> {
  const text = params.queryText.trim();
  if (!text) return "";

  let matches: Awaited<ReturnType<typeof VectorService.searchSimilarMemories>>;
  try {
    matches = await VectorService.searchSimilarMemories({
      queryText: text,
      type: "episodic",
      limit: RELATED_HISTORY_SEARCH_LIMIT,
    });
  } catch (err) {
    // Qdrant unreachable, or collection doesn't exist yet (no memories written
    // so far) — degrade to no examples rather than blocking the reply.
    console.warn("[related-history] Qdrant lookup failed; continuing without RAG examples:", err);
    return "";
  }

  const usable = matches
    .filter(
      (m) =>
        m.score >= RELATED_HISTORY_MIN_SCORE &&
        m.payload.threadId !== params.currentThreadId &&
        typeof m.payload.text === "string" &&
        m.payload.text.trim().length > 0
    )
    .slice(0, MAX_EXAMPLES);
  if (usable.length === 0) return "";

  const blocks = usable.map(
    (m, i) =>
      `Example ${i + 1} (semantic similarity ${m.score.toFixed(2)}):\n` +
      m.payload.text.trim().slice(0, MAX_EXAMPLE_CHARS)
  );

  return (
    "Similar past replies WE sent to comparable customer emails, retrieved by " +
    "semantic similarity — use these only to match our tone and approach. Do " +
    "NOT copy them verbatim, and defer to the action-specific template/rules " +
    "above whenever they conflict:\n\n" +
    blocks.join("\n\n")
  );
}
