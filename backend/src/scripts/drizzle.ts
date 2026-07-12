import { exec, promiseSpinner } from "@blueprint/script-utils";

import { loadDbEnv } from "../config/loadDbEnv";
import { cleanup, registerCleanupHandlers, startContainers } from "./helpers";

/**
 * Runs drizzle-kit commands with DATABASE_URL from env.
 * Usage: bun src/scripts/drizzle.ts <command> [args...]
 * Example: bun src/scripts/drizzle.ts generate
 *          bun src/scripts/drizzle.ts push
 *          bun src/scripts/drizzle.ts migrate
 *          bun src/scripts/drizzle.ts studio
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: bun src/scripts/drizzle.ts <command> [args...]");
    console.error("Example: bun src/scripts/drizzle.ts migrate");
    process.exit(1);
  }

  // Register cleanup handlers
  registerCleanupHandlers();

  // Load database environment (fetches secrets from Bitwarden)
  const env = await promiseSpinner(loadDbEnv(), "Fetching secrets...");

  // Start docker compose
  try {
    await startContainers();
  } catch {
    process.exit(1);
  }

  // Run drizzle-kit command
  try {
    await exec(["bun", "x", "drizzle-kit", ...args], {
      env: {
        DATABASE_URL: env.DATABASE_URL.release(),
        DATABASE_SSL: String(env.DATABASE_SSL),
      },
    });
  } catch {
    await cleanup(1);
  }

  await cleanup(0);
}

main();
