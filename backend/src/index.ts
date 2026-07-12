import { createApp } from "./app";
import { env } from "./config";
import { runMigrations } from "./db";
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

/** Starts the HTTP server and registers graceful-shutdown handlers. */
function startServer(): void {
  const app = createApp().listen(env.PORT);

  console.log(
    `Blueprint API is running at ${app.server?.hostname}:${app.server?.port}`,
  );

  /** Graceful shutdown handler — cleans up the rate limit store and exits. */
  const shutdown = (): void => {
    console.log("Shutting down gracefully...");
    rateLimitStore.destroy();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

if (import.meta.main) {
  if (parseRunMode(process.argv) === "migrate") {
    try {
      await runMigrations();
      process.exit(0);
    } catch (error) {
      console.error("Migration failed:", error);
      process.exit(1);
    }
  } else {
    startServer();
  }
}
