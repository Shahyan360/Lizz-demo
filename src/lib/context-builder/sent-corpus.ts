import { prisma } from "../prisma";
import { GmailService } from "../../services/gmail.service";
import type { SyncMessageResult } from "../../services/gmail.service";
import { extractEmailAddress, stripSignature } from "../gmail-helpers";
import {
  sentCorpusSchema,
  type SentCorpus,
  type SentCorpusMessage,
} from "../schemas/sent-corpus";
import {
  MIN_MESSAGE_WORDS,
  SENT_CORPUS_FETCH_TIMEOUT_MS,
  SENT_CORPUS_MAX_RESULTS,
  SENT_CORPUS_WINDOW_DAYS,
} from "./constants";

/**
 * The Gmail "Sent" corpus fetcher. Pulls the user's recent sent mail ONCE per
 * batch sync run as a fresh style corpus for cold-start drafting (Tier 3).
 *
 * Hard rule: never throws. Any failure — expired token, rate limit, timeout —
 * degrades to an empty corpus so the pipeline falls through to Tier 3c.
 */

/** An empty corpus — the graceful-degradation value for every failure path. */
export function emptySentCorpus(
  windowDays: number = SENT_CORPUS_WINDOW_DAYS
): SentCorpus {
  return { fetchedAt: new Date(), windowDays, messages: [] };
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Rejects after `ms` — raced against the live fetch to bound latency. */
function rejectAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out after ${ms}ms`)),
      ms
    );
    // Don't let a still-pending timeout keep the process alive after the race.
    timer.unref?.();
  });
}

/** Maps a parsed Gmail message into a corpus message, or null if unusable. */
function toCorpusMessage(raw: SyncMessageResult): SentCorpusMessage | null {
  const recipients = [
    ...new Set(
      raw.recipients.map((value) => extractEmailAddress(value)).filter(Boolean)
    ),
  ];
  const bodyText = stripSignature(raw.bodyText).trim();
  if (bodyText.length === 0) {
    return null;
  }
  const sentAt = Number.isNaN(raw.receivedAt.getTime())
    ? new Date(0)
    : raw.receivedAt;

  return {
    messageId: raw.id,
    threadId: raw.threadId,
    recipients,
    subject: raw.subject,
    bodyText,
    sentAt,
  };
}

/** Live fetch + parse — raced against the timeout by {@link fetchSentCorpus}. */
async function buildCorpus(
  accountId: string,
  windowDays: number
): Promise<SentCorpus> {
  const account = await prisma.gmailAccount.findUnique({
    where: { id: accountId },
  });
  if (!account) {
    return emptySentCorpus(windowDays);
  }

  const raw = await GmailService.listSentMessages(
    {
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      tokenExpiry: account.tokenExpiry,
    },
    windowDays,
    SENT_CORPUS_MAX_RESULTS
  );

  const messages = raw
    .map(toCorpusMessage)
    .filter((m): m is SentCorpusMessage => m !== null)
    // Drop bot / one-liner auto-replies — too little style signal to mimic.
    .filter((m) => wordCount(m.bodyText) >= MIN_MESSAGE_WORDS)
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());

  return sentCorpusSchema.parse({
    fetchedAt: new Date(),
    windowDays,
    messages,
  });
}

/**
 * Fetches the user's sent-mail corpus for one mailbox. Call EXACTLY ONCE per
 * batch sync run and thread the result through every orchestrator call — never
 * let the context builder fetch its own corpus.
 */
export async function fetchSentCorpus(input: {
  accountId: string;
  windowDays?: number;
}): Promise<SentCorpus> {
  const windowDays = input.windowDays ?? SENT_CORPUS_WINDOW_DAYS;
  try {
    const corpus = await Promise.race([
      buildCorpus(input.accountId, windowDays),
      rejectAfter(SENT_CORPUS_FETCH_TIMEOUT_MS),
    ]);
    console.log(
      `[sentCorpus] fetched ${corpus.messages.length} messages spanning ` +
        `${windowDays}d for accountId=${input.accountId}`
    );
    return corpus;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[sentCorpus] fetch failed for accountId=${input.accountId} ` +
        `(${message}) — degrading to empty corpus`
    );
    return emptySentCorpus(windowDays);
  }
}
