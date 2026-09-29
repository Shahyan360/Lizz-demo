import { Queue } from "bullmq";
import IORedis from "ioredis";

// Centralized Redis Connection sharing across queues & workers
export const redisConnection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null, // Critical requirement for BullMQ
  }
);

// Queue 1: Syncer - handles incremental Gmail sync from webhooks
export const emailSyncQueue = new Queue("email-sync", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
  },
});

// Queue 2: Ingestion Pipeline - processes synced emails through Multi-Agent Orchestrator
export const agentPipelineQueue = new Queue("agent-pipeline", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 10000,
    },
    removeOnComplete: true,
  },
});

// Queue 3: Outgoing Email Sender
export const outgoingEmailQueue = new Queue("outgoing-send", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 30000,
    },
    removeOnComplete: true,
  },
});

// Queue 4: Cron Jobs
export const cronQueue = new Queue("cron-jobs", {
  connection: redisConnection,
});

