"use server";

import { DraftStatus, ReviewLevel } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { ThreadWithDetails, DashboardMetrics } from "../../lib/db-types";

/** Aggregate counters and average sub-agent latency for the dashboard. */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [totalSyncCount, pendingReview, autoSent, traces] = await Promise.all([
    prisma.emailMessage.count(),
    prisma.emailDraft.count({
      where: { status: DraftStatus.PENDING_REVIEW },
    }),
    prisma.emailDraft.count({
      where: {
        reviewLevel: ReviewLevel.AUTO_SEND,
        status: DraftStatus.SENT,
      },
    }),
    prisma.aITrace.findMany({
      select: { latencyMs: true },
    }),
  ]);

  const avgLatency =
    traces.length > 0
      ? Math.round(
          traces.reduce((acc, trace) => acc + trace.latencyMs, 0) /
            traces.length
        )
      : 0;

  return { totalSyncCount, pendingReview, autoSent, avgLatency };
}

/** All synced threads for the workspace with messages, drafts, and traces. */
export async function getEmailThreads(): Promise<ThreadWithDetails[]> {
  return prisma.emailThread.findMany({
    include: {
      messages: { orderBy: { receivedAt: "desc" } },
      drafts: {
        include: {
          aiTraces: true,
          approvalEvents: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}
