import { Worker, Job } from "bullmq";
import { redisConnection, cronQueue } from "../emailQueue";
import { MultiAgentOrchestrator } from "../../agents/orchestrator";
import { emptySentCorpus } from "../../lib/context-builder";
import { executePlannerDigest } from "../../lib/integrations/execute-planner-digest";

interface AgentPipelineJobData {
  threadId: string;
  sender: string;
  rawBody: string;
}

// 1. Initialize Worker to listen to "agent-pipeline" Queue
const pipelineWorker = new Worker<AgentPipelineJobData>(
  "agent-pipeline",
  async (job: Job<AgentPipelineJobData>) => {
    console.log(`[Worker] Starting job ${job.id} for Thread ${job.data.threadId}`);
    
    try {
      // This queue job carries no accountId, so it cannot fetch a Gmail "Sent"
      // corpus — pass an empty one and let the context builder fall back to
      // Tier 1/2 (Postgres/Qdrant) or Tier 3c.
      const result = await MultiAgentOrchestrator.execute(
        job.data,
        emptySentCorpus()
      );

      if (result.status === "drafted") {
        console.log(
          `[Worker] Draft ${result.draftId} generated (confidence: ${result.confidence}, reviewLevel: ${result.reviewLevel}).`
        );
      } else {
        console.log(
          `[Worker] Message skipped — ${result.category}: ${result.reason}`
        );
      }
      return result;
    } catch (error) {
      console.error(`[Worker] Error executing multi-agent orchestrator on job ${job.id}:`, error);
      throw error; // Propagates to BullMQ trigger exponential retry mechanism
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 incoming email streams concurrently
  }
);

// 2. Observer Lifecycle Events
pipelineWorker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully.`);
});

pipelineWorker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed with error:`, err);
});

// 3. Initialize Cron Worker for scheduled tasks
const cronWorker = new Worker(
  "cron-jobs",
  async (job: Job) => {
    if (job.name === "daily-digest") {
      console.log(`[Cron Worker] Running daily planner digest (Job ID: ${job.id})...`);
      try {
        const result = await executePlannerDigest();
        console.log(`[Cron Worker] Daily digest completed. Processed ${result.tenantsProcessed} tenants.`);
      } catch (error) {
        console.error(`[Cron Worker] Daily digest failed:`, error);
        throw error;
      }
    }
  },
  { connection: redisConnection }
);

// Upsert the daily digest job to run at 9 AM UTC
cronQueue.add(
  "daily-digest",
  {},
  {
    repeat: {
      pattern: "0 9 * * *",
    },
  }
).catch((err) => console.error(`[Cron Worker] Failed to schedule daily digest:`, err));

// 4. Robust Graceful Shutdown Protocol
const gracefulShutdown = async (signal: string) => {
  console.log(`[Worker] Received ${signal}. Shutting down workers gracefully...`);
  await pipelineWorker.close();
  await cronWorker.close();
  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

console.log("[Worker] Agent Pipeline Worker is online and waiting for jobs...");
