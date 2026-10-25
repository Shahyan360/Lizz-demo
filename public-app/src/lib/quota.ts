import { createHmac } from 'node:crypto';
import { list, put } from '@vercel/blob';

export class QuotaError extends Error {
  constructor(public readonly reason: 'visitor' | 'global' | 'unavailable') {
    super(reason);
  }
}
export function boundedLimit(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? Math.min(parsed, max) : fallback;
}
export function dailyIdentity(ip: string, day: string, secret: string) {
  return createHmac('sha256', secret).update(`${day}:${ip}`).digest('hex').slice(0, 32);
}
export const blobOptions = {
  access: 'private' as const,
  addRandomSuffix: false,
  allowOverwrite: false,
};

// Each fixed slot is created once, never overwritten or refunded. Concurrent
// calls must claim different slots; a model request is impossible without one.
export async function reserveSlot(prefix: string, limit: number, reason: 'visitor' | 'global') {
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await list({ prefix, limit: 101, abortSignal: AbortSignal.timeout(3000) });
    const claimed = new Set(existing.blobs.map((blob) => blob.pathname));
    let slot = -1;
    for (let i = 0; i < limit; i++)
      if (!claimed.has(`${prefix}${i}.json`)) {
        slot = i;
        break;
      }
    if (slot < 0) throw new QuotaError(reason);
    try {
      await put(`${prefix}${slot}.json`, '{}', {
        ...blobOptions,
        contentType: 'application/json',
        abortSignal: AbortSignal.timeout(3000),
      });
      return;
    } catch {
      if (attempt === 2) throw new QuotaError('unavailable');
    }
  }
  throw new QuotaError('unavailable');
}
export async function reserveInference(ip: string, now = new Date()) {
  const secret = process.env.DEMO_QUOTA_SECRET;
  if (!process.env.BLOB_READ_WRITE_TOKEN || !secret || secret.length < 32)
    throw new QuotaError('unavailable');
  const day = now.toISOString().slice(0, 10);
  const identity = dailyIdentity(ip, day, secret);
  try {
    await reserveSlot(
      `lizz-quota/${day}/visitor-${identity}/`,
      boundedLimit(process.env.DEMO_VISITOR_DAILY_BUDGET, 3, 5),
      'visitor',
    );
    await reserveSlot(
      `lizz-quota/${day}/global/`,
      boundedLimit(process.env.DEMO_DAILY_BUDGET, 40, 100),
      'global',
    );
  } catch (error) {
    if (error instanceof QuotaError) throw error;
    throw new QuotaError('unavailable');
  }
}
