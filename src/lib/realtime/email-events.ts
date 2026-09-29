import { EventEmitter } from "events";

/**
 * Process-wide event bus that bridges the Zoho webhook (which receives new
 * emails) to any open SSE connections (which push them to the browser live).
 *
 * Stored on `globalThis` so Next.js dev hot-reload reuses the SAME emitter
 * instead of creating a new one each reload (which would orphan listeners).
 *
 * NOTE: this is in-memory and single-process. It works in dev and on a single
 * server instance. On multi-instance/serverless hosting it would need a real
 * pub/sub (Redis, etc.) — the polling fallback still covers that case.
 */

export interface NewEmailEvent {
  messageId: string;
  subject: string;
  from: string;
  sender: string;
  folderId?: string;
  receivedAt: number;
}

const globalForEvents = globalThis as unknown as {
  __emailEvents?: EventEmitter;
};

export const emailEvents: EventEmitter =
  globalForEvents.__emailEvents ?? new EventEmitter();

// Many browser tabs may each open an SSE listener; lift the default cap.
emailEvents.setMaxListeners(0);

if (!globalForEvents.__emailEvents) {
  globalForEvents.__emailEvents = emailEvents;
}

/** Broadcasts a newly-received email to all open SSE connections. */
export function publishNewEmail(event: NewEmailEvent): void {
  emailEvents.emit("new-email", event);
}
