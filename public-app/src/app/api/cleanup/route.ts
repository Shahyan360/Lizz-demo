import { timingSafeEqual } from 'node:crypto';
import { list, del } from '@vercel/blob';
export const maxDuration = 30;
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization') || '';
  const target = `Bearer ${expected}`;
  if (
    !expected ||
    expected.length < 32 ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(target) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(target))
  )
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  // Retain the current UTC day and the two previous days. No active slot can
  // be deleted and reused by a concurrent request.
  const cutoff = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  try {
    let cursor: string | undefined;
    let removed = 0;
    for (let page = 0; page < 5; page++) {
      const result = await list({ prefix: 'lizz-quota/', limit: 1000, cursor });
      const stale = result.blobs
        .filter(
          (blob) =>
            /^lizz-quota\/\d{4}-\d{2}-\d{2}\//.test(blob.pathname) &&
            blob.pathname.split('/')[1] < cutoff,
        )
        .map((blob) => blob.url);
      if (stale.length) {
        await del(stale);
        removed += stale.length;
      }
      if (!result.hasMore) break;
      cursor = result.cursor;
    }
    console.info(JSON.stringify({ event: 'demo.quota.cleanup', removed }));
    return Response.json({ removed });
  } catch {
    console.error(JSON.stringify({ event: 'demo.quota.cleanup.failed' }));
    return Response.json({ error: 'Cleanup unavailable' }, { status: 503 });
  }
}
