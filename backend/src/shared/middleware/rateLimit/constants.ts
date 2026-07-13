import { ONE_MINUTE } from "@blueprint/time-utils";

import { ipKeyGenerator, userKeyGenerator } from "./keyGenerators";

/** Context type for rate limit key generators. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KeyGeneratorContext = { request: Request } & Record<string, any>;

/** Rate limit configuration for a specific tier. */
interface RateLimitTier {
  /** Time window in milliseconds. */
  window: number;
  /** Maximum requests allowed in the window. */
  max: number;
  /** Key generator function for this tier. */
  keyGenerator?: (ctx: KeyGeneratorContext) => string;
}

/**
 * Pre-defined rate limit configurations for different endpoint tiers.
 * All limits assume real human users - no automated/bot traffic expected.
 * Each tier includes its natural key generator.
 */
export const RATE_LIMITS = {
  /** User creation (5/min per IP). */
  CREATE_USER: { window: ONE_MINUTE, max: 5, keyGenerator: ipKeyGenerator },

  /** General authenticated endpoints (60/min per user). */
  STANDARD: { window: ONE_MINUTE, max: 60, keyGenerator: userKeyGenerator },

  /** Global fallback for all routes (100/min per IP). */
  GLOBAL: { window: ONE_MINUTE, max: 100 },
} as const satisfies Record<string, RateLimitTier>;

/**
 * Maximum entries in the rate limit store (DDoS protection).
 * Prevents memory exhaustion from IP spoofing attacks.
 */
export const MAX_STORE_ENTRIES = 100_000;
