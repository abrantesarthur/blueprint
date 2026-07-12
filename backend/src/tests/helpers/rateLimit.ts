import { expect } from "bun:test";

import { env } from "../../config";
import { setRateLimitEnabled } from "../../shared/middleware/rateLimit/plugin";
import { rateLimitStore } from "../../shared/middleware/rateLimit/store";

/**
 * Enables rate limiting for tests and sets TRUST_PROXY to true.
 * @returns The original TRUST_PROXY value to restore later.
 */
export function enableRateLimitingForTests(): boolean {
  setRateLimitEnabled(true);
  const originalTrustProxy = env.TRUST_PROXY;
  (env as { TRUST_PROXY: boolean }).TRUST_PROXY = true;
  return originalTrustProxy;
}

/**
 * Disables rate limiting for tests and restores the original TRUST_PROXY value.
 * @param originalTrustProxy - The original TRUST_PROXY value to restore.
 */
export function disableRateLimitingForTests(originalTrustProxy: boolean): void {
  setRateLimitEnabled(false);
  (env as { TRUST_PROXY: boolean }).TRUST_PROXY = originalTrustProxy;
}

/** Shape of a response object for rate limit assertions. */
interface RateLimitResponse {
  /** HTTP status code. */
  status: number;
  /** Response headers. */
  headers: Headers;
  /** Parsed response body. */
  body: unknown;
}

/**
 * Asserts that a response is a valid rate limit (429) response.
 * @param response - The response to check.
 */
export function expectRateLimited(response: RateLimitResponse): void {
  expect(response.status).toBe(429);
  const retryAfter = response.headers.get("Retry-After");
  expect(retryAfter).not.toBeNull();
  expect(Number(retryAfter)).toBeGreaterThan(0);
  expect(response.body).toEqual({
    code: "TOO_MANY_REQUESTS",
    error: expect.stringMatching(
      /^Rate limit exceeded\. Please try again in \d+ seconds\.$/,
    ),
  });
}

/** Clears all rate limit entries from the store. */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}
