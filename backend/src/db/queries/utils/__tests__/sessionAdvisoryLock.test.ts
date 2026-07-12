import { SQL } from "bun";
import { afterEach, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";

import { TEST_DATABASE_URL } from "../../../../tests/db";
import { testDb } from "../../../../tests/setup";
import * as schema from "../../../schema";
import {
  releaseSessionAdvisoryLock,
  setSessionTimeouts,
  tryAcquireSessionAdvisoryLock,
} from "../sessionAdvisoryLock";

/** Lock key isolated to this suite so it never collides with real locks. */
const TEST_LOCK_KEY = 918_273_645;

/** Pinned single connections opened per test, released in afterEach. */
const reserved: Array<{ release: () => void }> = [];

/**
 * Reserves a dedicated pool connection and wraps it in a Drizzle instance so
 * session-scoped state (advisory locks, timeouts) stays on one backend.
 * @returns A Drizzle client bound to a single reserved connection.
 */
async function pinnedConnection(): Promise<ReturnType<typeof drizzle>> {
  const connection = await testDb.$client.reserve();
  reserved.push(connection);
  return drizzle({ client: connection, schema, casing: "snake_case" });
}

describe("db/queries/utils/sessionAdvisoryLock.ts", () => {
  afterEach(() => {
    while (reserved.length > 0) {
      reserved.pop()!.release();
    }
  });

  describe("tryAcquireSessionAdvisoryLock / releaseSessionAdvisoryLock", () => {
    test("acquires a free lock and releases it", async () => {
      const db = await pinnedConnection();

      expect(
        await tryAcquireSessionAdvisoryLock({ db, key: TEST_LOCK_KEY }),
      ).toBe(true);
      expect(await releaseSessionAdvisoryLock({ db, key: TEST_LOCK_KEY })).toBe(
        true,
      );
    });

    test("reports false when releasing a lock the session does not hold", async () => {
      const db = await pinnedConnection();

      expect(await releaseSessionAdvisoryLock({ db, key: TEST_LOCK_KEY })).toBe(
        false,
      );
    });

    test("blocks a second session from acquiring the same lock until released", async () => {
      const holder = await pinnedConnection();
      const contender = await pinnedConnection();

      expect(
        await tryAcquireSessionAdvisoryLock({ db: holder, key: TEST_LOCK_KEY }),
      ).toBe(true);
      expect(
        await tryAcquireSessionAdvisoryLock({
          db: contender,
          key: TEST_LOCK_KEY,
        }),
      ).toBe(false);

      expect(
        await releaseSessionAdvisoryLock({ db: holder, key: TEST_LOCK_KEY }),
      ).toBe(true);

      expect(
        await tryAcquireSessionAdvisoryLock({
          db: contender,
          key: TEST_LOCK_KEY,
        }),
      ).toBe(true);
      expect(
        await releaseSessionAdvisoryLock({ db: contender, key: TEST_LOCK_KEY }),
      ).toBe(true);
    });
  });

  describe("setSessionTimeouts", () => {
    test("applies statement_timeout and lock_timeout to the session", async () => {
      const client = new SQL(TEST_DATABASE_URL, { max: 1 });
      const db = drizzle({ client, schema, casing: "snake_case" });

      try {
        await setSessionTimeouts({
          db,
          statementTimeoutMs: 5000,
          lockTimeoutMs: 3000,
        });

        const rows = await db.execute<{ name: string; setting: string }>(
          sql`SELECT name, setting FROM pg_settings WHERE name IN ('statement_timeout', 'lock_timeout')`,
        );
        const settings = new Map(rows.map((r) => [r["name"], r["setting"]]));

        expect(settings.get("statement_timeout")).toBe("5000");
        expect(settings.get("lock_timeout")).toBe("3000");
      } finally {
        // Dedicated non-pooled client: the session-wide timeouts persist past
        // release(), so the whole client is closed to guarantee the tainted
        // connection never returns to the shared pool other tests depend on.
        await client.close();
      }
    });
  });
});
