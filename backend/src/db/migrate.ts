import { ONE_MINUTE, ONE_SECOND } from "@blueprint/time-utils";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";

import { env } from "../config";
import {
  releaseSessionAdvisoryLock,
  setSessionTimeouts,
  tryAcquireSessionAdvisoryLock,
} from "./queries";
import * as schema from "./schema";

/**
 * Absolute path to the migrations folder baked into the runtime image.
 * The Dockerfile copies `backend/src/db/migrations` here so the compiled binary
 * can read the SQL/journal at runtime (`bun build --compile` does not embed
 * loose `.sql` files). Absolute so it never depends on the binary's cwd.
 */
const DEFAULT_MIGRATIONS_FOLDER = "/app/migrations";

/**
 * Fixed 64-bit key for the migration session advisory lock. Arbitrary but
 * stable: every migrator process contends on this same key, so at most one
 * applies migrations at a time.
 */
const MIGRATION_ADVISORY_LOCK_KEY = 0x494e5354;

/** Default per-statement timeout for a migration run, in milliseconds. */
const DEFAULT_STATEMENT_TIMEOUT_MS = 5 * ONE_MINUTE;

/** Default heavyweight-lock acquisition timeout for a migration run, in milliseconds. */
const DEFAULT_LOCK_TIMEOUT_MS = 10 * ONE_SECOND;

/** Seconds to wait for in-flight queries to finish when closing the migration connection. */
const CLOSE_TIMEOUT_SECONDS = 5;

/**
 * Applies all pending database migrations from the embedded SQL, then returns.
 *
 * Runs on a **dedicated single-connection** Bun SQL client (`max: 1`) so the
 * session advisory lock and the session timeouts both bind to the one backend
 * connection that also runs the migration — satisfying the "lock spans the
 * entire migrate() call" requirement without reaching for a pooled connection.
 *
 * Defense-in-depth against a pathological concurrent deploy: the run fails fast
 * (exits the caller non-zero) if another migrator already holds the advisory
 * lock, and `statement_timeout` / `lock_timeout` keep it from hanging the deploy
 * against a live cluster. Drizzle's pg-core migrator wraps the entire run —
 * every pending migration file — in a single transaction, so any failed
 * statement rolls back the whole run, leaving the database untouched.
 *
 * @param options - Optional overrides (mainly for tests).
 * @param options.migrationsFolder - Folder holding the generated SQL + journal. Defaults to the baked-in image path.
 * @param options.databaseUrl - Connection URL to migrate. Defaults to the runtime `DATABASE_URL`.
 * @param options.tls - Whether the connection must use TLS. Defaults to the runtime `DATABASE_SSL`.
 * @param options.statementTimeoutMs - Per-statement timeout in milliseconds.
 * @param options.lockTimeoutMs - Heavyweight-lock acquisition timeout in milliseconds.
 * @returns Resolves once all pending migrations are applied.
 * @throws When the advisory lock is held by another migrator, or any migration statement fails.
 */
export async function runMigrations({
  migrationsFolder = DEFAULT_MIGRATIONS_FOLDER,
  databaseUrl = env.DATABASE_URL.release(),
  tls = env.DATABASE_SSL,
  statementTimeoutMs = DEFAULT_STATEMENT_TIMEOUT_MS,
  lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
}: {
  /** Folder holding the generated SQL + journal. Defaults to the baked-in image path. */
  migrationsFolder?: string;
  /** Connection URL to migrate. Defaults to the runtime `DATABASE_URL`. */
  databaseUrl?: string;
  /** Whether the connection must use TLS. Defaults to the runtime `DATABASE_SSL`. */
  tls?: boolean;
  /** Per-statement timeout in milliseconds. */
  statementTimeoutMs?: number;
  /** Heavyweight-lock acquisition timeout in milliseconds. */
  lockTimeoutMs?: number;
} = {}): Promise<void> {
  const client = drizzle({
    connection: { url: databaseUrl, tls, max: 1, idleTimeout: 0 },
    schema,
    casing: "snake_case",
  });

  try {
    await setSessionTimeouts({
      db: client,
      statementTimeoutMs,
      lockTimeoutMs,
    });

    const acquired = await tryAcquireSessionAdvisoryLock({
      db: client,
      key: MIGRATION_ADVISORY_LOCK_KEY,
    });
    if (!acquired) {
      throw new Error(
        "Could not acquire the migration advisory lock; another migrator is running.",
      );
    }

    try {
      await migrate(client, { migrationsFolder });
    } finally {
      // Best-effort: closing the connection below also releases the session lock.
      await releaseSessionAdvisoryLock({
        db: client,
        key: MIGRATION_ADVISORY_LOCK_KEY,
      }).catch(() => undefined);
    }
  } finally {
    await client.$client.close({ timeout: CLOSE_TIMEOUT_SECONDS });
  }
}
