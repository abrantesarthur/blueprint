import { describe, expect, test } from "bun:test";

import { createLogger, isLogLevel, LOG_LEVELS } from "../createLogger";

/** An in-memory log sink capturing each serialized line for assertions. */
interface MemoryDestination {
  /** The captured lines, one serialized JSON object each. */
  lines: string[];
  /** Writes one serialized log line into {@link MemoryDestination.lines}. */
  write: (line: string) => void;
}

/**
 * Creates an in-memory destination capturing written log lines.
 * @returns The capturing destination.
 */
function createMemoryDestination(): MemoryDestination {
  const lines: string[] = [];
  return {
    lines,
    write(line: string): void {
      lines.push(line);
    },
  };
}

describe("logger/createLogger.ts", () => {
  describe("createLogger", () => {
    test("writes one JSON object per line with level, time, and message", () => {
      const destination = createMemoryDestination();
      const logger = createLogger({ level: "info", destination });

      logger.info("hello");
      logger.warn("careful");

      expect(destination.lines).toHaveLength(2);
      const first = JSON.parse(destination.lines[0]!);
      const second = JSON.parse(destination.lines[1]!);
      expect(first).toMatchObject({ msg: "hello", level: 30 });
      expect(second).toMatchObject({ msg: "careful", level: 40 });
      expect(typeof first.time).toBe("number");
    });

    test("merges structured fields into the emitted line", () => {
      const destination = createMemoryDestination();
      const logger = createLogger({ level: "info", destination });

      logger.info({ method: "GET", path: "/health", status: 200 }, "request");

      expect(JSON.parse(destination.lines[0]!)).toMatchObject({
        msg: "request",
        method: "GET",
        path: "/health",
        status: 200,
      });
    });

    test("suppresses records below the configured level", () => {
      const destination = createMemoryDestination();
      const logger = createLogger({ level: "warn", destination });

      logger.debug("dropped");
      logger.info("dropped too");
      logger.error("kept");

      expect(destination.lines).toHaveLength(1);
      expect(JSON.parse(destination.lines[0]!)).toMatchObject({ msg: "kept" });
    });

    test("emits nothing at the silent level", () => {
      const destination = createMemoryDestination();
      const logger = createLogger({ level: "silent", destination });

      logger.fatal("dropped");
      logger.error("dropped");

      expect(destination.lines).toHaveLength(0);
    });

    test("serializes Error objects passed under the err key", () => {
      const destination = createMemoryDestination();
      const logger = createLogger({ level: "info", destination });

      logger.error({ err: new Error("boom") }, "failed");

      const line = JSON.parse(destination.lines[0]!);
      expect(line.msg).toBe("failed");
      expect(line.err).toMatchObject({ type: "Error", message: "boom" });
      expect(typeof line.err.stack).toBe("string");
    });

    test("child loggers inherit the destination and bound fields", () => {
      const destination = createMemoryDestination();
      const logger = createLogger({ level: "info", destination });

      logger.child({ module: "users" }).info("scoped");

      expect(JSON.parse(destination.lines[0]!)).toMatchObject({
        msg: "scoped",
        module: "users",
      });
    });
  });

  describe("isLogLevel", () => {
    test("accepts every level in LOG_LEVELS", () => {
      for (const level of LOG_LEVELS) {
        expect(isLogLevel(level)).toBe(true);
      }
    });

    test("rejects strings that are not levels", () => {
      expect(isLogLevel("")).toBe(false);
      expect(isLogLevel("verbose")).toBe(false);
      expect(isLogLevel("INFO")).toBe(false);
    });
  });
});
