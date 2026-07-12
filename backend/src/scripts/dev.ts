import { exec, execStart, promiseSpinner } from "@blueprint/script-utils";
import type { Subprocess } from "bun";
import { Tunnel } from "cloudflared";

import { loadEnv } from "../config/loadEnv";
import {
  cleanup,
  registerCleanupHandlers,
  startContainers,
  waitForPostgres,
} from "./helpers";

let server: Subprocess | null = null;
let tunnel: Tunnel | null = null;

/** Kills the dev server and tunnel subprocesses. */
function killProcesses(): void {
  if (server) {
    server.kill();
  }
  if (tunnel) {
    tunnel.stop();
  }
}

/** Main entry point for the dev script. */
async function main(): Promise<void> {
  // Register cleanup handlers
  registerCleanupHandlers(killProcesses);

  // Load environment configuration (fetches secrets from Bitwarden)
  const env = await promiseSpinner(loadEnv(), "Fetching secrets...");

  // Start docker compose
  try {
    await startContainers();
  } catch (error) {
    console.error("\n  Failed to start containers:\n");
    console.error(error instanceof Error ? error.message : error);
    console.error(
      "\n  Tip: a stale Docker network can cause this. Try `bun run dev:down` then rerun, or `docker compose up -d --force-recreate`.\n",
    );
    process.exit(1);
  }

  // Wait for services to be ready
  await promiseSpinner(
    waitForPostgres({ dbUser: env.DATABASE_USER, dbName: env.DATABASE_NAME }),
    "Waiting for Postgres...",
  );

  // Push database schema
  try {
    await promiseSpinner(
      exec(["bun", "x", "drizzle-kit", "push"], {
        env: { DATABASE_URL: env.DATABASE_URL.release() },
        silent: true,
      }),
      "Pushing schema...",
    );
  } catch {
    await cleanup(1, killProcesses);
  }

  // Seed development data (skip with --skip-seed)
  if (!process.argv.includes("--skip-seed")) {
    process.argv.push("--skip-containers");
    const { seed } = await import("./seed");
    await seed();
  }

  // Start a Cloudflare tunnel when --tunnel is passed. With a
  // CLOUDFLARE_TUNNEL_TOKEN configured (fetched from Bitwarden via loadEnv),
  // run a named (remotely-managed) tunnel whose hostname is configured in the
  // Cloudflare dashboard and stays stable across restarts — useful for
  // third-party integrations that require a fixed callback URL. Without a
  // token, fall back to an ephemeral quick tunnel whose URL changes on every
  // run.
  if (process.argv.includes("--tunnel")) {
    const tunnelToken = env.CLOUDFLARE_TUNNEL_TOKEN.release();
    if (tunnelToken) {
      tunnel = Tunnel.withToken(tunnelToken);
      await promiseSpinner(
        new Promise<void>((resolve, reject) => {
          tunnel!.once("connected", () => resolve());
          tunnel!.once("error", reject);
        }),
        "Starting named Cloudflare tunnel...",
      );
      const hostname = env.CLOUDFLARE_TUNNEL_HOSTNAME;
      console.log(
        `\n  Tunnel: ${hostname ? `https://${hostname}` : "named tunnel connected (stable hostname configured in Cloudflare)"}\n`,
      );
    } else {
      tunnel = Tunnel.quick(`http://localhost:${env.PORT}`);
      const publicUrl = await promiseSpinner(
        new Promise<string>((resolve) => {
          tunnel!.once("url", resolve);
        }),
        "Starting tunnel...",
      );
      console.log(`\n  Tunnel: ${publicUrl}\n`);
    }
  }

  // Start the dev server
  server = execStart(["bun", "run", "--watch", "src/index.ts"]);

  // Wait for server to exit, then cleanup
  const exitCode = await server.exited;
  await cleanup(exitCode, killProcesses);
}

main();
