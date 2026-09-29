import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../../lib/prisma";
import { executePropertyFollowUps } from "../../../../lib/integrations/property-follow-up";

export const dynamic = "force-dynamic";

/**
 * Same env var the in-process scheduler reads for its own check interval
 * (`lib/integrations/property-follow-up-scheduler.ts`) — kept identical here
 * so the claim window always matches how often the scheduler actually calls
 * this route. If these two ever drifted (e.g. scheduler shortened for local
 * testing but this stayed at 30 min), every call but the first in each old
 * window would get silently skipped as "already ran."
 */
function tickBucketMs(): number {
  const minutes = Number(process.env.PROPERTY_FOLLOW_UP_INTERVAL_MINUTES);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 30) * 60 * 1000;
}

/**
 * Claims one bucket (sized to the scheduler's interval) so concurrent callers
 * within the same window only run the batch once. In production the caller
 * is this app's own in-process scheduler, and Cloud Run can have more than
 * one instance running at once — each with its own timer hitting this same
 * route around the same time. Reuses `WebhookEvent.messageId` as a generic
 * idempotency ledger, same trick the Zoho webhook route uses, rather than
 * adding a dedicated table.
 */
async function claimTick(now: Date): Promise<boolean> {
  const bucketMs = tickBucketMs();
  const bucketStart = new Date(Math.floor(now.getTime() / bucketMs) * bucketMs);
  const bucketKey = `property-follow-up-tick:${bucketStart.toISOString()}`;
  try {
    await prisma.webhookEvent.create({ data: { messageId: bucketKey } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return false;
    }
    console.warn("[property-follow-up] tick claim errored; skipping this call:", err);
    return false;
  }
}

/**
 * Scheduled follow-up email sender. For every property whose opportunity
 * has an explicit nextFollowUpDate that has arrived — or, if none was ever
 * set, that was created 3+ months ago and hasn't had a default follow-up
 * sent yet — drafts and sends a check-in email to its primary contact.
 *
 * Secured by `CRON_SECRET`: the caller must send `Authorization: Bearer <secret>`.
 */
async function handlePropertyFollowUp(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization");
  if (!secret || provided !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  if (!(await claimTick(now))) {
    return NextResponse.json({ ok: true, skipped: "already ran for this window" });
  }

  const result = await executePropertyFollowUps(now);

  return NextResponse.json({ ok: true, ...result });
}

export const GET = handlePropertyFollowUp;
export const POST = handlePropertyFollowUp;
