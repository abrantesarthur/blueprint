import { createLogger } from "@blueprint/logger-utils";
import { describe, expect, mock, test } from "bun:test";

import { createShutdown, parseRunMode } from "..";
import { createApp } from "../app";

/**
 * Builds a createShutdown dependency set backed by mocks, recording the
 * order in which the shutdown steps run.
 * @returns The dependencies plus the recorded call order and exit codes.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createShutdownDeps() {
  const calls: string[] = [];
  const exitCodes: number[] = [];

  return {
    calls,
    exitCodes,
    deps: {
      stopServer: mock(async () => {
        calls.push("stopServer");
      }),
      destroyRateLimitStore: mock(() => {
        calls.push("destroyRateLimitStore");
      }),
      closeDatabase: mock(async () => {
        calls.push("closeDatabase");
      }),
      log: createLogger({ level: "silent" }),
      exit: mock((code: number) => {
        exitCodes.push(code);
      }),
    },
  };
}

describe("index.ts", () => {
  describe("parseRunMode", () => {
    test("selects migrate mode when the first argument is 'migrate'", () => {
      expect(parseRunMode(["bun", "/app/server", "migrate"])).toBe("migrate");
    });

    test("selects serve mode when no argument is given", () => {
      expect(parseRunMode(["bun", "/app/server"])).toBe("serve");
    });

    test("selects serve mode for any non-migrate argument", () => {
      expect(parseRunMode(["bun", "/app/server", "serve"])).toBe("serve");
      expect(parseRunMode(["bun", "/app/server", "migrations"])).toBe("serve");
      expect(parseRunMode(["bun", "/app/server", ""])).toBe("serve");
    });
  });

  describe("createShutdown", () => {
    test("drains the server, then closes the pool, then exits 0", async () => {
      const { calls, exitCodes, deps } = createShutdownDeps();

      await createShutdown(deps)("SIGTERM");

      expect(calls).toEqual([
        "stopServer",
        "destroyRateLimitStore",
        "closeDatabase",
      ]);
      expect(exitCodes).toEqual([0]);
    });

    test("ignores repeat signals while a shutdown is in progress", async () => {
      const { deps } = createShutdownDeps();
      const shutdown = createShutdown(deps);

      await Promise.all([shutdown("SIGTERM"), shutdown("SIGINT")]);
      await shutdown("SIGTERM");

      expect(deps.stopServer).toHaveBeenCalledTimes(1);
      expect(deps.exit).toHaveBeenCalledTimes(1);
    });

    test("exits 1 when a step fails", async () => {
      const { exitCodes, deps } = createShutdownDeps();
      deps.closeDatabase.mockImplementation(async () => {
        throw new Error("pool already gone");
      });

      await createShutdown(deps)("SIGTERM");

      expect(exitCodes).toEqual([1]);
    });
  });

  describe("createApp", () => {
    const app = createApp();

    test("responds to the health check", async () => {
      const response = await app.handle(new Request("http://localhost/health"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({ status: "ok" });
    });

    test("mounts the users module under /api", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/users/550e8400-e29b-41d4-a716-446655440000",
        ),
      );

      expect(response.status).toBe(401);
    });
  });
});
