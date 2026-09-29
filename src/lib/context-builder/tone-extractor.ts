import { VectorService } from "../../services/vector.service";
import type { SentCorpus, SentCorpusMessage } from "../schemas/sent-corpus";

/**
 * Tier 3b tonal ranking. Ranks the user's recent sent mail by semantic
 * similarity to an incoming email — a cheap embedding + cosine pass, no LLM
 * call. Corpus embeddings are cached on each {@link SentCorpusMessage} the
 * first time they are computed so a multi-email batch embeds the corpus once.
 */

/** Cosine similarity of two equal-length vectors; 0 when undefined. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Returns the `topN` sent-corpus messages most tonally similar to `incomingText`.
 * Mutates `corpus.messages[i].embedding` to memoise embeddings for the batch.
 */
export async function rankByTonalSimilarity(params: {
  incomingText: string;
  corpus: SentCorpus;
  topN: number;
}): Promise<SentCorpusMessage[]> {
  const { incomingText, corpus, topN } = params;
  const queryVector = await VectorService.generateEmbedding(incomingText);

  const scored: Array<{ message: SentCorpusMessage; score: number }> = [];
  for (const message of corpus.messages) {
    if (!message.embedding) {
      message.embedding = await VectorService.generateEmbedding(
        message.bodyText
      );
    }
    scored.push({
      message,
      score: cosineSimilarity(queryVector, message.embedding),
    });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((entry) => entry.message);
}
