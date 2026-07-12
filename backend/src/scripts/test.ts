import { exec, execStart, promiseSpinner } from "@blueprint/script-utils";
import type { Subprocess } from "bun";

import { TEST_DATABASE_URL, TEST_DB } from "../tests/db";

let testProcess: Subprocess | null = null;
let isCleaningUp = false;

/**
 * Waits for PostgreSQL to be ready.
 * @param maxAttempts - Maximum number of attempts to check.
 */
async function waitForPostgres(maxAttempts: number = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await exec(
        [
          "docker",
          "exec",
          "blueprint-postgres-test",
          "pg_isready",
          "-U",
          TEST_DB.USER,
          "-d",
          TEST_DB.NAME,
        ],
        { silent: true },
      );
      return;
    } catch {
      await Bun.sleep(1000);
    }
  }
  throw new Error("PostgreSQL did not become ready in time");
}

/**
 * Scans test files for .only() markers.
 * @returns Array of absolute paths to test files containing .only markers, or empty if none found.
 */
async function findOnlyMarkerFiles(): Promise<string[]> {
  const glob = new Bun.Glob("**/*.test.ts");
  const testDir = import.meta.dir.replace("/scripts", "/");
  const files: string[] = [];

  for await (const path of glob.scan({ cwd: testDir })) {
    const content = await Bun.file(`${testDir}${path}`).text();
    if (/\.only\s*\(/.test(content)) {
      files.push(`${testDir}${path}`);
    }
  }
  return files;
}

/**
 * Cleanup handler for graceful shutdown.
 * @param exitCode - The exit code to use when exiting the process.
 */
async function cleanup(exitCode: number): Promise<void> {
  if (isCleaningUp) return;
  isCleaningUp = true;

  if (testProcess) {
    testProcess.kill();
  }

  await promiseSpinner(
    exec(["docker", "compose", "-f", "docker-compose.test.yml", "down", "-v"], {
      silent: true,
    }),
    "Stopping test containers...",
  );
  process.exit(exitCode);
}

/** Main entry point for the test script. */
async function main(): Promise<void> {
  // Register cleanup handlers for Ctrl+C and termination
  process.on("SIGINT", () => cleanup(1));
  process.on("SIGTERM", () => cleanup(1));

  // 1. Start test containers
  await promiseSpinner(
    exec(["docker", "compose", "-f", "docker-compose.test.yml", "up", "-d"], {
      silent: true,
    }),
    "Starting test containers...",
  );

  // 2. Wait for postgres to be ready
  await promiseSpinner(waitForPostgres(), "Waiting for PostgreSQL...");

  // 3. Push schema to test database (faster than migrations for ephemeral test DB)
  await promiseSpinner(
    exec(["bun", "x", "drizzle-kit", "push", "--force"], {
      env: { DATABASE_URL: TEST_DATABASE_URL },
    }),
    "Pushing schema...",
  );

  // 4. Run tests
  const onlyFiles = await findOnlyMarkerFiles();
  if (onlyFiles.length > 0) {
    console.log("Detected .only markers - running only marked tests\n");
  }
  const testArgs =
    onlyFiles.length > 0
      ? ["bun", "test", "--only", ...onlyFiles]
      : ["bun", "test"];
  testProcess = execStart(testArgs);
  const exitCode = await testProcess.exited;

  // 6. Cleanup and exit
  await cleanup(exitCode);
}

main();
