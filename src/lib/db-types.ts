import type { Prisma } from "@prisma/client";

/**
 * Shared Prisma payload types for query results that cross module boundaries
 * (e.g. server action -> page -> component). Declared here because `"use server"`
 * files may only export async functions, not types.
 */

/**
 * An `EmailThread` with its messages and drafts eager-loaded. Each draft
 * carries its AI traces and its approval-history events (the latter feed the
 * send-failure banner in the UI).
 */
export type ThreadWithDetails = Prisma.EmailThreadGetPayload<{
  include: {
    messages: true;
    drafts: { include: { aiTraces: true; approvalEvents: true } };
  };
}>;

/** Aggregate counters shown on the dashboard. */
export interface DashboardMetrics {
  totalSyncCount: number;
  pendingReview: number;
  autoSent: number;
  avgLatency: number;
}
