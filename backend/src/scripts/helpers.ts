import { exec, promiseSpinner } from "@blueprint/script-utils";
import { ONE_SECOND } from "@blueprint/time-utils";

let isCleaningUp = false;

/**
 * Stops docker compose containers (preserving volumes) and exits the process.
 * Volumes are intentionally left intact so data persists across `bun dev` restarts;
 * use `bun dev:down` to fully tear down volumes.
 * Ensures cleanup only runs once even if called multiple times.
 * @param exitCode - The exit code to use when exiting the process.
 * @param beforeCleanup - Optional callback to run before stopping containers.
 */
export async function cleanup(
  exitCode: number = 0,
  beforeCleanup?: () => void | Promise<void>,
): Promise<void> {
  if (isCleaningUp) return;
  isCleaningUp = true;

  if (beforeCleanup) {
    await beforeCleanup();
  }

  await promiseSpinner(
    exec(["docker", "compose", "stop"], { silent: true }),
    "Stopping containers...",
  );
  process.exit(exitCode);
}

/**
 * Registers SIGINT and SIGTERM handlers to run cleanup on exit.
 * @param beforeCleanup - Optional callback to run before stopping containers.
 */
export function registerCleanupHandlers(
  beforeCleanup?: () => void | Promise<void>,
): void {
  process.on("SIGINT", () => cleanup(0, beforeCleanup));
  process.on("SIGTERM", () => cleanup(0, beforeCleanup));
  process.on("SIGHUP", () => cleanup(0, beforeCleanup));
}

/**
 * Starts docker compose containers.
 * @param services - Optional list of specific service names to start. Starts all if omitted.
 * @throws Error if containers fail to start.
 */
export async function startContainers({
  services = [],
}: {
  /** Specific service names to start (e.g. ["postgres"]). Starts all if omitted. */
  services?: string[];
} = {}): Promise<void> {
  await promiseSpinner(
    exec(["docker", "compose", "up", "-d", ...(services ?? [])], {
      silent: true,
    }),
    `Starting${
      services.length > 0 ? ` ${services.map((s) => `'${s}'`).join(", ")}` : ""
    } container${services.length !== 1 ? "s" : ""}...`,
  );
}

/**
 * Polls Postgres via `pg_isready` inside the Docker container until it accepts connections.
 * Uses the container's own health-check binary so it doesn't depend on the app's DB pool or schema.
 * @param maxAttempts - Maximum number of attempts before giving up.
 */
export async function waitForPostgres({
  dbUser,
  dbName,
  maxAttempts = 30,
}: {
  maxAttempts?: number;
  dbUser: string;
  dbName: string;
}): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await exec(
        [
          "docker",
          "exec",
          "blueprint-postgres",
          "pg_isready",
          "-U",
          dbUser,
          "-d",
          dbName,
        ],
        { silent: true },
      );
      return;
    } catch {
      await Bun.sleep(ONE_SECOND);
    }
  }
  throw new Error("Postgres did not become ready in time");
}
