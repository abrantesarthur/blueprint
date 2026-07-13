import { createLogger } from "@blueprint/logger-utils";
import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";

import { onError } from "../../hooks";
import { requestLoggerPlugin } from "../requestLogger";

/** A parsed request-completion log line. */
interface RequestLogLine {
  /** Log message. */
  msg: string;
  /** HTTP method. */
  method: string;
  /** Request path. */
  path: string;
  /** Numeric HTTP status. */
  status: number;
  /** Request duration in milliseconds. */
  durationMs: number;
}

/**
 * Builds a test app wired with the request logger writing to memory.
 * @returns The app and the captured, lazily parsed log lines.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createLoggedApp() {
  const lines: string[] = [];
  const logger = createLogger({
    level: "info",
    destination: {
      write(line: string): void {
        lines.push(line);
      },
    },
  });

  const app = new Elysia()
    .use(requestLoggerPlugin({ logger }))
    .onError(onError)
    .get("/ok", () => ({ ok: true }))
    .get("/boom", () => {
      throw new Error("boom");
    });

  return { app, lines };
}

/**
 * Waits until the expected number of log lines has been captured.
 * `onAfterResponse` fires detached from the response, so tests must poll.
 * @param lines - The captured lines array.
 * @param count - The number of lines to wait for.
 * @returns The lines parsed as JSON.
 */
async function waitForLines(
  lines: string[],
  count: number,
): Promise<RequestLogLine[]> {
  const deadline = Date.now() + 1000;
  while (lines.length < count && Date.now() < deadline) {
    await Bun.sleep(5);
  }
  expect(lines.length).toBe(count);
  return lines.map((line) => JSON.parse(line));
}

describe("shared/middleware/requestLogger.ts", () => {
  describe("requestLoggerPlugin", () => {
    test("logs one line per request with method, path, status, and duration", async () => {
      const { app, lines } = createLoggedApp();

      await app.handle(new Request("http://localhost/ok"));
      const [line] = await waitForLines(lines, 1);

      expect(line).toMatchObject({
        msg: "request completed",
        method: "GET",
        path: "/ok",
        status: 200,
      });
      expect(typeof line!.durationMs).toBe("number");
      expect(line!.durationMs).toBeGreaterThanOrEqual(0);
    });

    test("logs the error status for a thrown route error", async () => {
      const { app, lines } = createLoggedApp();

      const response = await app.handle(new Request("http://localhost/boom"));
      const [line] = await waitForLines(lines, 1);

      expect(response.status).toBe(500);
      expect(line).toMatchObject({
        msg: "request completed",
        method: "GET",
        path: "/boom",
        status: 500,
      });
    });

    test("logs unmatched routes with their 404 status", async () => {
      const { app, lines } = createLoggedApp();

      await app.handle(new Request("http://localhost/nope"));
      const [line] = await waitForLines(lines, 1);

      expect(line).toMatchObject({ path: "/nope", status: 404 });
    });

    test("logs each request separately", async () => {
      const { app, lines } = createLoggedApp();

      await Promise.all([
        app.handle(new Request("http://localhost/ok")),
        app.handle(new Request("http://localhost/ok", { method: "HEAD" })),
      ]);
      const parsed = await waitForLines(lines, 2);

      const methods = parsed.map((line) => line.method).sort();
      expect(methods).toEqual(["GET", "HEAD"]);
    });

    test("never logs request bodies", async () => {
      const { app, lines } = createLoggedApp();

      await app.handle(
        new Request("http://localhost/ok", {
          method: "GET",
          headers: { "content-type": "application/json" },
        }),
      );
      const [line] = await waitForLines(lines, 1);

      expect(Object.keys(line!).sort()).toEqual([
        "durationMs",
        "hostname",
        "level",
        "method",
        "msg",
        "path",
        "pid",
        "status",
        "time",
      ]);
    });
  });
});
