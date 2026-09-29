import { NextRequest, NextResponse } from "next/server";
import { classifyBusinessEmail } from "../../../../lib/classify/business-classifier";
import { toBusinessCategory } from "../../../../lib/classify/categories";

export const dynamic = "force-dynamic";

/**
 * POST /api/zoho/classify — classifies a batch of emails into business
 * categories (for the list filters). Body: { items: [{ messageId, from,
 * subject, summary }] }. Returns { categories: { <messageId>: <category> } }.
 *
 * Results are cached per messageId in-process so re-filtering is instant and we
 * never re-spend AI calls on the same email. Concurrency is capped to stay
 * within the Gemini rate limit.
 */

const CACHE = new Map<string, string>();
const CONCURRENCY = 4;

interface Item {
  messageId: string;
  from?: string;
  subject?: string;
  summary?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { items?: Item[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const result: Record<string, string> = {};
  const pending: Item[] = [];

  // Serve cached categories immediately; queue the rest.
  for (const item of items) {
    if (!item.messageId) continue;
    const cached = CACHE.get(item.messageId);
    if (cached) {
      result[item.messageId] = cached;
    } else {
      pending.push(item);
    }
  }

  // Classify uncached items with a small concurrency cap.
  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      const item = pending[cursor++];
      try {
        const { category } = await classifyBusinessEmail({
          from: item.from ?? "",
          subject: item.subject ?? "",
          bodyText: item.summary ?? "",
        });
        CACHE.set(item.messageId, category);
        result[item.messageId] = category;
      } catch (err) {
        console.warn(`[api/zoho/classify] failed for ${item.messageId}:`, err);
        // Fall back to "other" so the UI can still filter/show it.
        result[item.messageId] = toBusinessCategory(undefined);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker)
  );

  return NextResponse.json({ categories: result });
}
