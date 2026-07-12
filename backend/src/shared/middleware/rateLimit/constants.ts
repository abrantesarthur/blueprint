import { ONE_MINUTE } from "@blueprint/time-utils";

import {
  ipKeyGenerator,
  otpRequestIpKeyGenerator,
  otpRequestKeyGenerator,
  otpVerifyKeyGenerator,
  userKeyGenerator,
} from "./keyGenerators";

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
  /** Brute force protection - 3 attempts per 15 min window (tracked per IP+phone). */
  OTP_REQUEST: {
    window: 15 * ONE_MINUTE,
    max: 3,
    keyGenerator: otpRequestKeyGenerator,
  },
  /** Volume cap - 6 OTP requests per 15 min per IP regardless of phone number. */
  OTP_REQUEST_IP: {
    window: 15 * ONE_MINUTE,
    max: 6,
    keyGenerator: otpRequestIpKeyGenerator,
  },
  /** Stricter for verify - 3 attempts per 15 min window (tracked per IP+phone). */
  OTP_VERIFY: {
    window: 15 * ONE_MINUTE,
    max: 3,
    keyGenerator: otpVerifyKeyGenerator,
  },

  /** Auth token endpoints (5/min per IP). */
  TOKEN_REFRESH: { window: ONE_MINUTE, max: 5, keyGenerator: ipKeyGenerator },
  /** Logout endpoint (3/min per IP). */
  LOGOUT: { window: ONE_MINUTE, max: 3, keyGenerator: ipKeyGenerator },

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
