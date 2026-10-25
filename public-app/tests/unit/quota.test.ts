import { beforeEach, describe, it, expect, vi } from 'vitest';
const memory = vi.hoisted(() => new Set<string>());
const failures = vi.hoisted(() => ({ list: false, put: false }));
vi.mock('@vercel/blob', () => ({
  list: vi.fn(async ({ prefix }: { prefix: string }) => {
    if (failures.list) throw new Error('storage unavailable');
    return {
      blobs: Array.from(memory)
        .filter((key) => key.startsWith(prefix))
        .map((pathname) => ({ pathname })),
    };
  }),
  put: vi.fn(
    async (
      pathname: string,
      _data: string,
      options: { allowOverwrite: boolean; addRandomSuffix: boolean; access: string },
    ) => {
      if (failures.put) throw new Error('storage unavailable');
      if (options.allowOverwrite || options.addRandomSuffix || options.access !== 'private')
        throw new Error('unsafe options');
      if (memory.has(pathname)) throw new Error('conflict');
      memory.add(pathname);
      return { pathname };
    },
  ),
}));
import { reserveInference, reserveSlot, dailyIdentity, boundedLimit } from '../../src/lib/quota';
beforeEach(() => {
  memory.clear();
  failures.list = false;
  failures.put = false;
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-private-store');
  vi.stubEnv('DEMO_QUOTA_SECRET', 'x'.repeat(32));
  vi.stubEnv('DEMO_DAILY_BUDGET', '2');
  vi.stubEnv('DEMO_VISITOR_DAILY_BUDGET', '1');
});
describe('durable inference quotas', () => {
  it('enforces global limits across different visitors', async () => {
    await reserveInference('a');
    await reserveInference('b');
    await expect(reserveInference('c')).rejects.toMatchObject({ reason: 'global' });
  });
  it('enforces visitor limit independently of local reset', async () => {
    await reserveInference('a');
    await expect(reserveInference('a')).rejects.toMatchObject({ reason: 'visitor' });
  });
  it('allows a fresh UTC day', async () => {
    await reserveInference('a', new Date('2026-10-25T23:59:59Z'));
    await reserveInference('a', new Date('2026-10-26T00:00:00Z'));
  });
  it('never allocates more slots than the global ceiling under contention', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 25 }, () => reserveSlot('parallel/', 2, 'global')),
    );
    expect(results.filter((result) => result.status === 'fulfilled').length).toBe(2);
    expect(memory.size).toBe(2);
  });
  it('fails closed when storage or secrets are missing', async () => {
    failures.list = true;
    await expect(reserveInference('a')).rejects.toMatchObject({ reason: 'unavailable' });
    failures.list = false;
    vi.stubEnv('DEMO_QUOTA_SECRET', '');
    await expect(reserveInference('b')).rejects.toMatchObject({ reason: 'unavailable' });
    expect(memory.size).toBe(0);
  });
  it('fails closed if every durable write fails', async () => {
    failures.put = true;
    await expect(reserveInference('a')).rejects.toMatchObject({ reason: 'unavailable' });
    expect(memory.size).toBe(0);
  });
  it('bounds configuration and rotates anonymous hashes every day', () => {
    expect(boundedLimit('999999', 40, 100)).toBe(100);
    expect(boundedLimit('NaN', 40, 100)).toBe(40);
    expect(boundedLimit('-1', 40, 100)).toBe(40);
    const hash = dailyIdentity('192.0.2.1', '2026-10-25', 'secret');
    expect(hash).not.toContain('192.0.2.1');
    expect(hash).not.toBe(dailyIdentity('192.0.2.1', '2026-10-26', 'secret'));
  });
});
