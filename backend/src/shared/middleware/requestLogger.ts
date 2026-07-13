import type { Logger } from "@blueprint/logger-utils";
import { Elysia, StatusMap } from "elysia";

/** Options for {@link requestLoggerPlugin}. */
interface RequestLoggerOptions {
  /** The logger request-completion lines are written to. */
  logger: Logger;
}

/**
 * Checks whether a string is an HTTP status name known to Elysia's
 * {@link StatusMap} (e.g. `"Not Found"`).
 * @param value - The candidate status name.
 * @returns Whether the string is a key of {@link StatusMap}.
 */
function isStatusName(value: string): value is keyof typeof StatusMap {
  return value in StatusMap;
}

/**
 * Resolves Elysia's `set.status` — a numeric code, an HTTP status name, or
 * unset — to a numeric status code.
 * @param status - The `set.status` value at response time.
 * @returns The numeric status code (200 when unset, as Elysia defaults).
 */
function resolveStatus(status: number | string | undefined): number {
  if (typeof status === "number") return status;
  if (typeof status === "string" && isStatusName(status)) {
    return StatusMap[status];
  }
  return 200;
}

/**
 * Creates an Elysia plugin that logs one structured line per HTTP request
 * (method, path, status, duration in ms) after the response is sent.
 *
 * Request bodies are deliberately never logged — they may carry sensitive
 * user content.
 *
 * Note: responses short-circuited by returning a `Response` from `onRequest`
 * (e.g. global rate-limit 429s) never reach `onAfterResponse`, so they get no
 * completion line; those rejections are already logged by the error hook.
 *
 * @param options - The plugin options ({@link RequestLoggerOptions}).
 * @returns An Elysia plugin registering the request-logging hooks.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function requestLoggerPlugin({ logger }: RequestLoggerOptions) {
  const startTimes = new WeakMap<Request, number>();

  return new Elysia({ name: "request-logger" })
    .onRequest(({ request }) => {
      startTimes.set(request, performance.now());
    })
    .onAfterResponse({ as: "global" }, ({ request, set }) => {
      const start = startTimes.get(request);
      logger.info(
        {
          method: request.method,
          path: new URL(request.url).pathname,
          status: resolveStatus(set.status),
          durationMs:
            start === undefined
              ? undefined
              : Math.round(performance.now() - start),
        },
        "request completed",
      );
    });
}
