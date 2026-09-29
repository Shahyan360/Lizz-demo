const DEFAULT_INTERVAL_MINUTES = 30;
function intervalMs(): number {
  const minutes = Number(process.env.PROPERTY_FOLLOW_UP_INTERVAL_MINUTES);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_INTERVAL_MINUTES) * 60 * 1000;
}

function schedulerEnabled(): boolean {
  const override = process.env.PROPERTY_FOLLOW_UP_SCHEDULER_ENABLED;
  if (override === "true") return true;
  if (override === "false") return false;
  return process.env.NODE_ENV === "production";
}

function internalOrigin(): string {
  return (
    process.env.NEXTAUTH_URL_INTERNAL?.replace(/\/$/, "") ??
    `http://127.0.0.1:${process.env.PORT ?? "3000"}`
  );
}

async function tick(): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[property-follow-up-scheduler] CRON_SECRET is not set; skipping tick");
    return;
  }

  try {
    const res = await fetch(`${internalOrigin()}/api/cron/property-follow-up`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) {
      console.warn(`[property-follow-up-scheduler] tick call returned ${res.status}`);
    }
  } catch (err) {
    console.error("[property-follow-up-scheduler] tick call failed:", err);
  }
}

let started = false;

/**
 * In-process stand-in for an external cron trigger — Cloud Run has no
 * built-in scheduler, so this runs the periodic property follow-up check
 * inside the app itself instead of relying on something hitting
 * `/api/cron/property-follow-up` from outside.
 *
 * Two caveats inherent to running this in-process on Cloud Run (not fixable
 * without an external scheduler, which is the trade-off that was chosen
 * instead of this):
 *  - If the service scales to zero between requests, this timer stops with
 *    the container. A follow-up due while the app is idle waits until the
 *    next request boots a fresh instance, which checks immediately on boot.
 *  - If Cloud Run scales OUT to multiple instances, each instance starts its
 *    own timer and could call the route around the same moment; the route
 *    itself claims a 30-minute window so only one call per window does work.
 */
export function startPropertyFollowUpScheduler(): void {
  if (started) return;
  started = true;

  if (!schedulerEnabled()) {
    console.log("[property-follow-up-scheduler] disabled (not production; see PROPERTY_FOLLOW_UP_SCHEDULER_ENABLED)");
    return;
  }

  const ms = intervalMs();
  console.log(`[property-follow-up-scheduler] started — checking every ${ms / 60_000} min`);
  setInterval(() => void tick(), ms);
  void tick();
}
