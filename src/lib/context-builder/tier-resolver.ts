import { VectorService } from "../../services/vector.service";
import {
  findContactByEmail,
  getThreadSummariesForContact,
  getUserSentMessagesToContact,
} from "../repositories/contact.repository";
import {
  conversationContextSchema,
  type ConversationContext,
} from "../schemas/conversation-context";
import type { SentCorpus, SentCorpusMessage } from "../schemas/sent-corpus";
import { extractStyleFingerprint } from "./style-fingerprint";
import { rankByTonalSimilarity } from "./tone-extractor";
import {
  MIN_DIRECT_HISTORY_MESSAGES,
  MIN_SENT_CORPUS_FOR_SIMILAR,
  MIN_SENT_CORPUS_TO_SENDER,
  RELATED_HISTORY_MIN_SCORE,
  RELATED_HISTORY_SEARCH_LIMIT,
  TONAL_MATCH_TOP_N,
} from "./constants";

/**
 * The per-tier resolvers. Each returns a validated {@link ConversationContext}
 * when its tier yields signal, or `null` to fall through to the next tier.
 * Pure of LLM calls — DB, Qdrant, and vector math only.
 */

/** Tier 1 — prior user replies to THIS sender, stored in Postgres. */
export async function resolveDirectHistory(
  senderEmail: string,
  forbiddenWords: string[]
): Promise<ConversationContext | null> {
  const contact = await findContactByEmail(senderEmail);
  if (!contact) {
    return null;
  }

  const sentMessages = await getUserSentMessagesToContact(contact.id);
  if (sentMessages.length < MIN_DIRECT_HISTORY_MESSAGES) {
    return null;
  }

  const recentSummaries = await getThreadSummariesForContact(
    contact.id
  );

  return conversationContextSchema.parse({
    tier: "direct_history",
    signals: {
      contactName: contact.name ?? "Contact",
      relationshipScore: contact.relationshipScore,
      formalityLevel: contact.formalityLevel,
      interactionCount: contact.interactionCount,
      notes: contact.notes ?? "",
      recentSummaries,
      userSentMessageCount: sentMessages.length,
      fingerprint: extractStyleFingerprint(
        sentMessages.map((m) => ({ bodyText: m.bodyText })),
        forbiddenWords
      ),
    },
  });
}

/** Tier 2 — tonally related past replies retrieved from Qdrant. */
export async function resolveRelatedHistory(
  queryText: string,
  currentThreadId: string,
  forbiddenWords: string[]
): Promise<ConversationContext | null> {
  const matches = await VectorService.searchSimilarMemories({
    queryText,
    type: "episodic",
    limit: RELATED_HISTORY_SEARCH_LIMIT,
  });

  // Above-threshold hits with usable reply text, excluding the current thread
  // (no self-mimicry). `matches` is score-sorted desc; filters preserve order.
  const usable = matches.filter(
    (m) =>
      m.score >= RELATED_HISTORY_MIN_SCORE &&
      m.payload.threadId !== currentThreadId &&
      typeof m.payload.text === "string" &&
      m.payload.text.length > 0
  );
  if (usable.length === 0) {
    return null;
  }

  return conversationContextSchema.parse({
    tier: "related_history",
    signals: {
      matchCount: usable.length,
      topScore: usable[0].score,
      fingerprint: extractStyleFingerprint(
        usable.map((m) => ({ bodyText: m.payload.text })),
        forbiddenWords
      ),
    },
  });
}

/** Builds a Tier 3a/3b context from a set of matched sent-corpus messages. */
function sentCorpusContext(
  tier: "sent_corpus_to_sender" | "sent_corpus_similar",
  source: "to_sender" | "tonal_similarity",
  matched: SentCorpusMessage[],
  corpusSize: number,
  forbiddenWords: string[]
): ConversationContext {
  return conversationContextSchema.parse({
    tier,
    signals: {
      source,
      matchedMessageCount: matched.length,
      corpusSize,
      fingerprint: extractStyleFingerprint(
        matched.map((m) => ({ bodyText: m.bodyText })),
        forbiddenWords
      ),
    },
  });
}

/** Tier 3a / 3b — the Gmail "Sent" corpus fetched once for the batch. */
export async function resolveSentCorpusTier(params: {
  senderEmail: string;
  incomingText: string;
  corpus: SentCorpus;
  currentThreadId: string;
  forbiddenWords: string[];
}): Promise<ConversationContext | null> {
  const { senderEmail, incomingText, corpus, currentThreadId, forbiddenWords } =
    params;

  // Exclude the just-sent reply on the current thread (no self-mimicry).
  const eligible = corpus.messages.filter(
    (m) => m.threadId !== currentThreadId
  );
  if (eligible.length === 0) {
    return null;
  }

  // Tier 3a — recent sent mail addressed directly to this person.
  const target = senderEmail.trim().toLowerCase();
  const toSender = eligible.filter((m) => m.recipients.includes(target));
  if (toSender.length >= MIN_SENT_CORPUS_TO_SENDER) {
    return sentCorpusContext(
      "sent_corpus_to_sender",
      "to_sender",
      toSender,
      eligible.length,
      forbiddenWords
    );
  }

  // Tier 3b — tonally similar sent mail (cheap embedding + cosine ranking).
  if (eligible.length >= MIN_SENT_CORPUS_FOR_SIMILAR) {
    const ranked = await rankByTonalSimilarity({
      incomingText,
      corpus: { ...corpus, messages: eligible },
      topN: TONAL_MATCH_TOP_N,
    });
    return sentCorpusContext(
      "sent_corpus_similar",
      "tonal_similarity",
      ranked,
      eligible.length,
      forbiddenWords
    );
  }

  return null;
}
