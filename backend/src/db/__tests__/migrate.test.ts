import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { SQL } from "bun";
import { afterAll, afterEach, describe, expect, test } from "bun:test";

import { TEST_DB } from "../../tests/db";
import { runMigrations } from "../migrate";

/** Absolute path to the real generated migrations folder. */
const MIGRATIONS_FOLDER = path.join(import.meta.dir, "../migrations");

/**
 * Fixed 64-bit key for the migration session advisory lock. Must mirror
 * `MIGRATION_ADVISORY_LOCK_KEY` in `migrate.ts` so this test can both simulate
 * contention and verify the lock is released.
 */
const MIGRATION_ADVISORY_LOCK_KEY = 0x494e5354;

/** Connection URL to the default test database, used for CREATE/DROP DATABASE. */
const ADMIN_URL = `postgresql://${TEST_DB.USER}:${TEST_DB.PASSWORD}@${TEST_DB.HOST}:${TEST_DB.PORT}/${TEST_DB.NAME}`;

/**
 * Builds a connection URL for a database on the test Postgres instance.
 * @param database - The database name.
 * @returns The connection URL.
 */
function urlFor(database: string): string {
  return `postgresql://${TEST_DB.USER}:${TEST_DB.PASSWORD}@${TEST_DB.HOST}:${TEST_DB.PORT}/${database}`;
}

describe("db/migrate.ts", () => {
  const admin = new SQL(ADMIN_URL);

  /** Throwaway databases created during a test, dropped by the afterEach safety net. */
  const createdDatabases = new Set<string>();

  afterAll(async () => {
    await admin.close();
  });

  afterEach(async () => {
    for (const database of createdDatabases) {
      await admin.unsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    }
    createdDatabases.clear();
  });

  /**
   * Drops then recreates an empty throwaway database on the test instance and
   * registers it for cleanup so a thrown test never orphans it.
   * @param database - The database name to (re)create.
   */
  async function recreateDatabase(database: string): Promise<void> {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE "${database}"`);
    createdDatabases.add(database);
  }

  /**
   * Checks whether the migration advisory lock is currently free on the given
   * database by attempting to acquire it from a fresh connection, then releasing
   * it. A successful acquisition proves no other session holds the lock.
   * @param databaseUrl - Connection URL to the database to probe.
   * @returns `true` when the lock was free and could be acquired, `false` otherwise.
   */
  async function lockIsFree(databaseUrl: string): Promise<boolean> {
    const conn = new SQL(databaseUrl);
    try {
      const rows = await conn`
        SELECT pg_try_advisory_lock(${MIGRATION_ADVISORY_LOCK_KEY}) AS locked
      `;
      const acquired = rows[0].locked === true;
      if (acquired) {
        await conn`SELECT pg_advisory_unlock(${MIGRATION_ADVISORY_LOCK_KEY})`;
      }
      return acquired;
    } finally {
      await conn.close();
    }
  }

  describe("runMigrations", () => {
    test("applies all pending migrations to a fresh database", async () => {
      const database = "blueprint_migrate_smoke";
      await recreateDatabase(database);

      try {
        await runMigrations({
          databaseUrl: urlFor(database),
          tls: false,
          migrationsFolder: MIGRATIONS_FOLDER,
        });

        const conn = new SQL(urlFor(database));
        try {
          const tables = await conn`
            SELECT to_regclass('public.users') IS NOT NULL AS users
          `;
          expect(tables[0].users).toBe(true);

          const applied =
            await conn`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`;
          expect(applied[0].count).toBeGreaterThanOrEqual(1);
        } finally {
          await conn.close();
        }

        expect(await lockIsFree(urlFor(database))).toBe(true);
      } finally {
        await admin.unsafe(
          `DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`,
        );
      }
    });

    test("is a no-op when run again with no pending migrations", async () => {
      const database = "blueprint_migrate_idempotent";
      await recreateDatabase(database);

      try {
        await runMigrations({
          databaseUrl: urlFor(database),
          tls: false,
          migrationsFolder: MIGRATIONS_FOLDER,
        });

        const conn = new SQL(urlFor(database));
        try {
          const afterFirst =
            await conn`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`;
          const countAfterFirstRun = afterFirst[0].count;

          await runMigrations({
            databaseUrl: urlFor(database),
            tls: false,
            migrationsFolder: MIGRATIONS_FOLDER,
          });

          const afterSecond =
            await conn`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`;
          expect(afterSecond[0].count).toBe(countAfterFirstRun);
        } finally {
          await conn.close();
        }
      } finally {
        await admin.unsafe(
          `DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`,
        );
      }
    });

    test("rejects when a migration statement fails", async () => {
      const database = "blueprint_migrate_failure";
      await recreateDatabase(database);

      const brokenFolder = await mkdtemp(
        path.join(tmpdir(), "blueprint-broken-migrations-"),
      );
      await mkdir(path.join(brokenFolder, "meta"), { recursive: true });
      await writeFile(
        path.join(brokenFolder, "meta", "_journal.json"),
        JSON.stringify({
          version: "7",
          dialect: "postgresql",
          entries: [
            {
              idx: 0,
              version: "7",
              when: 1,
              tag: "0000_broken",
              breakpoints: true,
            },
          ],
        }),
      );
      await writeFile(
        path.join(brokenFolder, "0000_broken.sql"),
        'CREATE TABLE "ok_table" ("id" integer);--> statement-breakpoint\nTHIS IS NOT VALID SQL;',
      );

      try {
        await expect(
          runMigrations({
            databaseUrl: urlFor(database),
            tls: false,
            migrationsFolder: brokenFolder,
          }),
        ).rejects.toThrow();

        const conn = new SQL(urlFor(database));
        try {
          const rows = await conn`
            SELECT to_regclass('public.ok_table') IS NULL AS rolled_back
          `;
          expect(rows[0].rolled_back).toBe(true);
        } finally {
          await conn.close();
        }

        expect(await lockIsFree(urlFor(database))).toBe(true);
      } finally {
        await rm(brokenFolder, { recursive: true, force: true });
        await admin.unsafe(
          `DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`,
        );
      }
    });

    test("fails fast when another migrator holds the advisory lock", async () => {
      const database = "blueprint_migrate_contention";
      await recreateDatabase(database);

      const holder = new SQL(urlFor(database));
      try {
        const held = await holder`
          SELECT pg_try_advisory_lock(${MIGRATION_ADVISORY_LOCK_KEY}) AS locked
        `;
        expect(held[0].locked).toBe(true);

        await expect(
          runMigrations({
            databaseUrl: urlFor(database),
            tls: false,
            migrationsFolder: MIGRATIONS_FOLDER,
          }),
        ).rejects.toThrow(
          "Could not acquire the migration advisory lock; another migrator is running.",
        );
      } finally {
        await holder`SELECT pg_advisory_unlock(${MIGRATION_ADVISORY_LOCK_KEY})`;
        await holder.close();
        await admin.unsafe(
          `DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`,
        );
      }
    });
  });
});
