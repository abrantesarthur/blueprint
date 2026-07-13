import type { Logger } from "@blueprint/logger-utils";

import { createApp } from "./app";
import { env } from "./config";
import { closeDb, runMigrations } from "./db";
import { logger } from "./shared/logger";
import { rateLimitStore } from "./shared/middleware/rateLimit";

/** The mutually exclusive run modes selected from the CLI arguments. */
export type RunMode = "migrate" | "serve";

/**
 * Selects the run mode from the process argument vector.
 *
 * `/app/server migrate` applies pending migrations and exits; any other
 * invocation starts the HTTP server. Branching here — before {@link createApp}
 * — guarantees the migrate path never reaches `listen()`.
 *
 * @param argv - The process argument vector (e.g. `process.argv`).
 * @returns `"migrate"` when the first argument is `migrate`, otherwise `"serve"`.
 */
export function parseRunMode(argv: string[]): RunMode {
  return argv[2] === "migrate" ? "migrate" : "serve";
}

/**
 * Dependencies for {@link createShutdown}, injected so the sequencing can be
 * unit tested without a live server, database, or process exit.
 */
interface ShutdownDeps {
  /** Stops the HTTP server: no new connections, in-flight requests finish. */
  stopServer: () => Promise<unknown>;
  /** Stops the rate-limit store's cleanup interval. */
  destroyRateLimitStore: () => void;
  /** Closes the Postgres connection pool. */
  closeDatabase: () => Promise<void>;
  /** Structured logger for shutdown events. */
  log: Logger;
  /** Terminates the process with the given exit code. */
  exit: (code: number) => void;
}

/**
 * Creates an idempotent graceful-shutdown handler: drains the HTTP server,
 * stops the rate-limit store, closes the database pool, then exits 0 (or 1
 * if any step fails). Repeat signals while a shutdown is in progress are
 * ignored.
 *
 * @param deps - The injected shutdown dependencies ({@link ShutdownDeps}).
 * @returns An async handler taking the received signal name.
 */
export function createShutdown(
  deps: ShutdownDeps,
): (signal: string) => Promise<void> {
  let shuttingDown = false;

  return async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    deps.log.info({ signal }, "shutdown started");
    try {
      await deps.stopServer();
      deps.destroyRateLimitStore();
      await deps.closeDatabase();
      deps.log.info({ signal }, "shutdown complete");
      deps.exit(0);
    } catch (error) {
      deps.log.error({ signal, err: error }, "shutdown failed");
      deps.exit(1);
    }
  };
}

/** Starts the HTTP server and registers graceful-shutdown handlers. */
function startServer(): void {
  const app = createApp().listen(env.PORT);

  logger.info(
    { hostname: app.server?.hostname, port: app.server?.port },
    "server started",
  );

  const shutdown = createShutdown({
    stopServer: () => app.stop(),
    destroyRateLimitStore: () => rateLimitStore.destroy(),
    closeDatabase: closeDb,
    log: logger,
    exit: (code: number) => process.exit(code),
  });

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

if (import.meta.main) {
  if (parseRunMode(process.argv) === "migrate") {
    try {
      await runMigrations();
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "migration failed");
      process.exit(1);
    }
  } else {
    startServer();
  }
}
