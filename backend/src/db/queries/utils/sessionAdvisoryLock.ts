import { sql } from "drizzle-orm";

import type { Database } from "../../client";

/**
 * Connection-bound database executor that runs the advisory-lock and timeout
 * statements. A session-level advisory lock is bound to a single backend
 * connection, so the executor passed here MUST be one whose queries are
 * guaranteed to run on the same connection for the whole lock lifetime (e.g. a
 * single-connection pool). Releasing the lock or ending the connection lets it
 * go.
 */
type SessionExecutor = Pick<Database, "execute">;

/**
 * Acquires a PostgreSQL **session-level** advisory lock without waiting.
 *
 * Uses `pg_try_advisory_lock(key)`, which returns immediately: `true` if the
 * lock was granted, `false` if another session already holds it. Unlike
 * `pg_advisory_xact_lock` (see {@link ./acquireAdvisoryLock}), this lock is held
 * until {@link releaseSessionAdvisoryLock} is called or the connection's session
 * ends — long enough to span an entire migration run.
 *
 * @param params - Lock parameters.
 * @param params.db - Executor whose statements run on the lock-holding connection.
 * @param params.key - 64-bit lock key identifying the lock.
 * @returns `true` when the lock was acquired, `false` when another session holds it.
 */
export async function tryAcquireSessionAdvisoryLock({
  db,
  key,
}: {
  /** Executor whose statements run on the lock-holding connection. */
  db: SessionExecutor;
  /** 64-bit lock key identifying the lock. */
  key: number;
}): Promise<boolean> {
  const rows = await db.execute<{ locked: boolean }>(
    sql`SELECT pg_try_advisory_lock(${key}) AS locked`,
  );
  return rows[0]?.["locked"] === true;
}

/**
 * Releases a session-level advisory lock previously acquired via
 * {@link tryAcquireSessionAdvisoryLock} on the same connection.
 *
 * @param params - Release parameters.
 * @param params.db - Executor whose statements run on the lock-holding connection.
 * @param params.key - 64-bit lock key identifying the lock.
 * @returns `true` when a held lock was released, `false` when no matching lock was held.
 */
export async function releaseSessionAdvisoryLock({
  db,
  key,
}: {
  /** Executor whose statements run on the lock-holding connection. */
  db: SessionExecutor;
  /** 64-bit lock key identifying the lock. */
  key: number;
}): Promise<boolean> {
  const rows = await db.execute<{ released: boolean }>(
    sql`SELECT pg_advisory_unlock(${key}) AS released`,
  );
  return rows[0]?.["released"] === true;
}

/**
 * Sets `statement_timeout` and `lock_timeout` for the connection's session.
 *
 * Bounds how long any single statement may run and how long it may wait to
 * acquire a heavyweight (table/row) lock, so a migration can never hang the
 * deploy indefinitely against a live cluster — it fails fast instead. Both are
 * set session-wide (`is_local = false`) via `set_config`, which parameterizes
 * the value (plain `SET` does not), and persist until the connection ends.
 *
 * @param params - Timeout parameters.
 * @param params.db - Executor whose statements run on the target connection.
 * @param params.statementTimeoutMs - Per-statement timeout in milliseconds.
 * @param params.lockTimeoutMs - Heavyweight-lock acquisition timeout in milliseconds.
 * @returns Resolves once both timeouts are applied.
 */
export async function setSessionTimeouts({
  db,
  statementTimeoutMs,
  lockTimeoutMs,
}: {
  /** Executor whose statements run on the target connection. */
  db: SessionExecutor;
  /** Per-statement timeout in milliseconds. */
  statementTimeoutMs: number;
  /** Heavyweight-lock acquisition timeout in milliseconds. */
  lockTimeoutMs: number;
}): Promise<void> {
  await db.execute(
    sql`SELECT set_config('statement_timeout', ${String(statementTimeoutMs)}, false)`,
  );
  await db.execute(
    sql`SELECT set_config('lock_timeout', ${String(lockTimeoutMs)}, false)`,
  );
}
