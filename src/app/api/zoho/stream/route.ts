import {
  emailEvents,
  type NewEmailEvent,
} from "../../../../lib/realtime/email-events";

// Long-lived stream — never cache.
export const dynamic = "force-dynamic";

/**
 * GET /api/zoho/stream — a Server-Sent Events (SSE) stream.
 *
 * The browser opens this once and holds it open. Whenever the Zoho webhook
 * publishes a new email, we push a `new-email` event down this stream so the UI
 * can update instantly. A periodic heartbeat keeps the connection alive.
 */
export async function GET(request: Request): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Controller already closed — ignore.
        }
      };

      // Tell the client the stream is ready.
      send("ready", { ok: true });

      const onNewEmail = (e: NewEmailEvent) => send("new-email", e);
      emailEvents.on("new-email", onNewEmail);

      // Heartbeat comment every 25s so proxies/browsers keep the socket open.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 25_000);

      // Clean up when the client disconnects.
      const cleanup = () => {
        clearInterval(heartbeat);
        emailEvents.off("new-email", onNewEmail);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
