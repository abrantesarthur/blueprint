import type { ApiErrorResponse } from "@blueprint/error-utils";

import { handleError } from "../utils/errors";

/** Minimal Elysia-like context the hook reads from. */
interface OnErrorContext {
  /** The error to render. */
  error: unknown;
  /** The incoming request (used to derive the path). */
  request: Request;
  /** The response setter; its `status` field is mutated. */
  set: {
    /** HTTP status code to send. Mutated by the hook. */
    status?: number | string;
    /** Response headers (unused here, present to match Elysia's context). */
    headers: Record<string, string | number>;
  };
}

/**
 * Pure Elysia-compatible hook that renders any error as a standardized JSON
 * response. Works as:
 *   - The argument to `.onError(onError)` at the app level.
 *   - An inline responder for sites that catch errors they cannot throw out
 *     of (e.g. the global rate limiter returning a 429 from `onRequest`).
 *
 * Delegates the error → `{ status, body }` mapping to `handleError`, mutates
 * `set.status` in place, and returns the body.
 *
 * @param ctx - The error context with `error`, `request`, and `set`.
 * @returns The response body produced by `handleError`.
 */
export function onError(ctx: OnErrorContext): ApiErrorResponse["body"] {
  const path = new URL(ctx.request.url).pathname;
  const { status, body } = handleError(ctx.error, path);
  ctx.set.status = status;
  return body;
}
