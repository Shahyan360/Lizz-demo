import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  blockSender,
  isSenderBlocked,
  unblockSender,
} from "@/lib/spam/blocklist";

/**
 * INTEGRATION test — exercises the blocked-sender store against a REAL MySQL.
 *
 * Unlike the unit tests, this needs a live database: in CI it runs against the
 * `mysql:8` sidecar after `prisma migrate deploy`; locally it runs inside the
 * Docker verification harness. It proves the schema/migrations are valid and
 * that the app's Prisma layer actually reads and writes MySQL — the round-trip
 * a unit test with a mocked client can never verify.
 *
 * Requires DATABASE_URL to point at a migrated MySQL instance.
 */
const TEST_EMAIL = "integration-blocklist@example.test";

describe("blocklist against real MySQL", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is required for the integration test (point it at the migrated MySQL sidecar)."
      );
    }
    // Prove connectivity up front with a trivial round-trip so a DB/migration
    // problem fails here with a clear message rather than mid-assertion.
    await prisma.$queryRaw`SELECT 1`;
    await unblockSender(TEST_EMAIL); // ensure a clean slate
  });

  afterAll(async () => {
    await unblockSender(TEST_EMAIL);
    await prisma.$disconnect();
  });

  it("reports an unknown sender as not blocked", async () => {
    expect(await isSenderBlocked(TEST_EMAIL)).toBe(false);
  });

  it("persists a block and reads it back (case-insensitive)", async () => {
    await blockSender(TEST_EMAIL, "integration test");
    expect(await isSenderBlocked(TEST_EMAIL)).toBe(true);
    // Addresses are normalized to lowercase, so a mixed-case lookup still hits.
    expect(await isSenderBlocked(TEST_EMAIL.toUpperCase())).toBe(true);

    // The row is actually in MySQL with the reason we set.
    const row = await prisma.blockedSender.findUnique({
      where: { email: TEST_EMAIL },
    });
    expect(row).not.toBeNull();
    expect(row?.reason).toBe("integration test");
  });

  it("upserts (blocking twice does not throw and updates the reason)", async () => {
    await blockSender(TEST_EMAIL, "updated reason");
    const row = await prisma.blockedSender.findUnique({
      where: { email: TEST_EMAIL },
    });
    expect(row?.reason).toBe("updated reason");
  });

  it("unblocks a sender", async () => {
    await unblockSender(TEST_EMAIL);
    expect(await isSenderBlocked(TEST_EMAIL)).toBe(false);
  });
});
