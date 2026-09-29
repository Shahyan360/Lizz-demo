import { prisma } from "./prisma";
import { syncWindowSchema, type SyncWindow } from "./schemas/gmail";
import { GmailService } from "../services/gmail.service";
import { VectorService } from "../services/vector.service";
import { MultiAgentOrchestrator } from "../agents/orchestrator";
import { fetchSentCorpus, SENT_CORPUS_WINDOW_DAYS } from "./context-builder";

/** Outcome of syncing one mailbox. */
export interface SyncResult {
  accountId: string;
  email: string;
  /** Threads that were run through the orchestrator (new, drafted or skipped). */
  threadsProcessed: number;
  drafted: number;
  skipped: number;
  failed: number;
  /** Per-thread / account-level error messages (does not abort the run). */
  errors: string[];
  status: "IDLE" | "ERROR";
}

/** How many thread IDs to pull from Gmail per query. */
const THREAD_FETCH_LIMIT = 25;
/** Hard cap on orchestrator runs per sync (bounds serverless execution time). */
const MAX_THREADS_PER_SYNC = 15;
/**
 * Delay between processing threads. Each drafted thread now fires a single
 * Gemini chat call (plus retrieval embeddings); spacing them still keeps a
 * batch sync under the Gemini free-tier per-minute quota.
 */
const THREAD_DELAY_MS = 4000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds the Gmail search query. Promotional / social / updates / forums mail
 * is filtered out **server-side** by Gmail, so Change 4's classifier is now a
 * backstop rather than the primary defense.
 */
function buildGmailQuery(sinceWindow: SyncWindow): string {
  return (
    `newer_than:${sinceWindow} in:inbox ` +
    `-category:promotions -category:social -category:updates -category:forums`
  );
}

/**
 * Syncs a single Gmail mailbox: pulls inbox threads newer than `sinceWindow`
 * and runs each new one through the multi-agent orchestrator.
 *
 * Pure of Next.js concerns (no `revalidatePath`) — callers handle revalidation.
 * Per-thread failures are recorded in the result and never abort the run.
 */
export async function syncGmailAccount(
  accountId: string,
  sinceWindow: SyncWindow
): Promise<SyncResult> {
  const window = syncWindowSchema.parse(sinceWindow);

  const account = await prisma.gmailAccount.findUnique({
    where: { id: accountId },
  });
  if (!account) {
    throw new Error(`Gmail account ${accountId} not found.`);
  }

  const result: SyncResult = {
    accountId: account.id,
    email: account.email,
    threadsProcessed: 0,
    drafted: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    status: "IDLE",
  };

  await prisma.gmailAccount.update({
    where: { id: account.id },
    data: { syncStatus: "SYNCING" },
  });

  const credentials = {
    accessToken: account.accessToken,
    refreshToken: account.refreshToken,
    tokenExpiry: account.tokenExpiry,
  };

  try {
    await VectorService.initCollection();

    // Fetch the Gmail "Sent" style corpus EXACTLY ONCE for this batch, then
    // thread it through every orchestrator call below (Tier 3 context).
    const sentCorpus = await fetchSentCorpus({
      accountId: account.id,
      windowDays: SENT_CORPUS_WINDOW_DAYS,
    });

    const threadIds = await GmailService.listThreadIds(
      credentials,
      buildGmailQuery(window),
      THREAD_FETCH_LIMIT
    );

    for (let i = 0; i < threadIds.length; i++) {
      if (result.threadsProcessed >= MAX_THREADS_PER_SYNC) {
        break;
      }
      const threadId = threadIds[i];
      let ranOrchestrator = false;

      try {
        const existing = await prisma.emailThread.findUnique({
          where: { id: threadId },
        });
        if (existing) {
          continue; // Already synced — skip (and skip the rate-limit delay).
        }

        const { threadSubject, threadSnippet, messages } =
          await GmailService.fetchThreadMessages(
            threadId,
            credentials,
            account.email
          );

        const latestIncoming = [...messages]
          .reverse()
          .find((m) => m.isIncoming);
        if (!latestIncoming) {
          continue;
        }

        ranOrchestrator = true;
        const outcome = await MultiAgentOrchestrator.execute(
          {
            threadId,
            sender: latestIncoming.sender,
            rawBody: latestIncoming.bodyText,
            subject: threadSubject,
            snippet: threadSnippet,
            messageSubject: latestIncoming.subject,
            headers: latestIncoming.headers,
            labelIds: latestIncoming.labelIds,
          },
          sentCorpus
        );

        result.threadsProcessed += 1;
        if (outcome.status === "drafted") {
          result.drafted += 1;
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        result.failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Thread ${threadId}: ${message}`);
        console.error(`[gmail-sync] Thread ${threadId} failed:`, error);
      }

      // Pace LLM usage — only after a thread that actually hit the pipeline.
      if (ranOrchestrator && i < threadIds.length - 1) {
        await sleep(THREAD_DELAY_MS);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`Account-level failure: ${message}`);
    console.error(`[gmail-sync] Sync failed for ${account.email}:`, error);
  }

  result.status = result.errors.length > 0 ? "ERROR" : "IDLE";

  await prisma.gmailAccount.update({
    where: { id: account.id },
    data: { syncStatus: result.status, lastSyncedAt: new Date() },
  });

  console.log(
    `[gmail-sync] ${account.email} (${window}) — processed=${result.threadsProcessed} ` +
      `drafted=${result.drafted} skipped=${result.skipped} failed=${result.failed}`
  );
  return result;
}
