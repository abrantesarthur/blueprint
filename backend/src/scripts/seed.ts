import {
  exec,
  logFailure,
  logSuccess,
  promiseSpinner,
} from "@blueprint/script-utils";
import { eq } from "drizzle-orm";

import { loadEnv } from "../config/loadEnv";
import { db } from "../db/client";
import { createUsers } from "../db/queries";
import { users as usersTable } from "../db/schema";
import * as fixtures from "../fixtures";
import { startContainers, waitForPostgres } from "./helpers";

/** The first user's ID, used as a sentinel to check if the database is already seeded. */
const SENTINEL_ID = fixtures.users[0]!.id!;

/**
 * Checks whether the development database already contains seed data.
 * @returns True if the sentinel user record exists.
 */
async function isAlreadySeeded(): Promise<boolean> {
  const result = await db.query.users.findFirst({
    where: eq(usersTable.id, SENTINEL_ID),
  });
  return !!result;
}

/** Deletes all data from seeded tables in reverse FK order. */
async function clearAll(): Promise<void> {
  await db.delete(usersTable);
}

/**
 * Seeds the development database with fixture data.
 * Idempotent — skips if data already exists unless `--force` is passed.
 * Pass `--skip-containers` to skip starting Docker containers and running migrations.
 */
export async function seed(): Promise<void> {
  const env = await promiseSpinner(loadEnv(), "Fetching secrets...");

  if (!process.argv.includes("--skip-containers")) {
    try {
      await startContainers({ services: ["postgres"] });
    } catch {
      process.exit(1);
    }

    await promiseSpinner(
      waitForPostgres({ dbUser: env.DATABASE_USER, dbName: env.DATABASE_NAME }),
      "Waiting for Postgres...",
    );

    await promiseSpinner(
      exec(["bun", "x", "drizzle-kit", "push"], {
        env: { DATABASE_URL: env.DATABASE_URL.release() },
        silent: true,
      }),
      "Pushing schema...",
    );
  }

  const force = process.argv.includes("--force");

  if (await isAlreadySeeded()) {
    if (!force) {
      logFailure("Database already seeded. Use --force to re-seed.");
      return;
    }
    await promiseSpinner(
      clearAll(),
      "Force re-seeding - clearing existing data...",
    );
  }

  await promiseSpinner(
    createUsers({ data: fixtures.users }),
    "Seeding users...",
  );

  logSuccess("Database seeded successfully.");
}

if (import.meta.main) {
  seed()
    .then(() => process.exit(0))
    .catch((error: Error) => {
      console.error("Seed failed:", error.message);
      process.exit(1);
    });
}
