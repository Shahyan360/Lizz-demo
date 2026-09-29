import { findCommunicationProfile } from "../repositories/profile.repository";
import { jsonStringArray } from "../json-array";
import {
  conversationContextSchema,
  type ConversationContext,
} from "../schemas/conversation-context";
import type { SentCorpus } from "../schemas/sent-corpus";
import {
  resolveDirectHistory,
  resolveRelatedHistory,
  resolveSentCorpusTier,
} from "./tier-resolver";

export { emptySentCorpus, fetchSentCorpus } from "./sent-corpus";
export { SENT_CORPUS_WINDOW_DAYS } from "./constants";
export type { ConversationContext } from "../schemas/conversation-context";
export type { SentCorpus } from "../schemas/sent-corpus";

export async function buildConversationContext(input: {
  senderEmail: string;
  cleanedText: string;
  currentThreadId: string;
  sentCorpus: SentCorpus;
}): Promise<ConversationContext> {
  const senderEmail = input.senderEmail.trim().toLowerCase();
  const queryText = input.cleanedText.trim();

  const profile = await findCommunicationProfile();
  const forbiddenWords = jsonStringArray(profile?.forbiddenWords);

  const direct = await resolveDirectHistory(
    senderEmail,
    forbiddenWords
  );
  if (direct) {
    return direct;
  }

  const related = await resolveRelatedHistory(
    queryText,
    input.currentThreadId,
    forbiddenWords
  );
  if (related) {
    return related;
  }

  const sentCorpusTier = await resolveSentCorpusTier({
    senderEmail,
    incomingText: queryText,
    corpus: input.sentCorpus,
    currentThreadId: input.currentThreadId,
    forbiddenWords,
  });

  return sentCorpusTier ?? conversationContextSchema.parse({
    tier: "default",
    signals: {
      fingerprint: {
        avgSentenceLength: profile?.avgSentenceLen ?? 14,
        greetingStyle: profile?.greetingStyle ?? "Hi [Name],",
        signoffStyle: profile?.signoffStyle ?? "Best,\n[My Name]",
        forbiddenWords,
      },
    },
  });
}
