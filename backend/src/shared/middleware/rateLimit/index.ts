// Core exports
export { RATE_LIMITS } from "./constants";
export { rateLimitHook } from "./plugin";
export { rateLimitStore } from "./store";

// Pre-configured rate limit plugins
import { RATE_LIMITS } from "./constants";
import { globalRateLimitPlugin, scopedRateLimitPlugin } from "./plugin";

/**
 * Global rate limiter - applies to all routes as fallback.
 * 100 requests/min per IP with 10% burst buffer.
 *
 * Uses the `onRequest` lifecycle stage so rejected requests are dropped before
 * route matching, body parsing, or validation — the cheapest possible path.
 */
export const globalIpRateLimitPlugin = globalRateLimitPlugin({
  ...RATE_LIMITS.GLOBAL,
  burstAllowance: 0.1,
});

/**
 * Standard rate limiter - for authenticated endpoints.
 * 60 requests/min per user with 10% burst buffer.
 */
export const standardRateLimitPlugin = scopedRateLimitPlugin({
  ...RATE_LIMITS.STANDARD,
  burstAllowance: 0.1,
});
