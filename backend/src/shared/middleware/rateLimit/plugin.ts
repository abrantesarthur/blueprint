import { Elysia } from "elysia";

import { onError } from "../../hooks";
import { logger } from "../../logger";
import { TooManyRequestsError } from "../../utils/errors";
import { getClientIP, globalIpKeyGenerator } from "./keyGenerators";
import { type RateLimitResult, rateLimitStore } from "./store";

/** Disabled by default in tests; toggled via `setRateLimitEnabled`. */
let rateLimitDisabled = Bun.env.NODE_ENV === "test";

/**
 * Enables or disables rate limiting (for testing purposes).
 * @param enabled - Whether rate limiting should be enabled.
 */
export const setRateLimitEnabled = (enabled: boolean): void => {
  rateLimitDisabled = !enabled;
};

/** Context shape required for rate limiting. */
interface RateLimitContext {
  /** The incoming request. */
  request: Request;
  /** Response headers setter. */
  set: { headers: Record<string, string | number> };
}

/** Rate limit configuration for the plugin and hook. */
interface RateLimitConfig {
  /** Time window in milliseconds. */
  window: number;
  /** Maximum requests per window. */
  max: number;
  /** Burst allowance (0.1 = 10% buffer before hard block). */
  burstAllowance?: number;
  /** Key generator function. */
  keyGenerator: (ctx: RateLimitContext) => string;
  /** Skip rate limiting for certain conditions. */
  skip?: (ctx: RateLimitContext) => boolean;
}

/** Internal config with required burstAllowance for the core check. */
type CoreRateLimitConfig = Required<
  Pick<RateLimitConfig, "window" | "max" | "burstAllowance">
>;

/**
 * Core rate-limit check shared by every factory. Returns the result when
 * allowed, `null` when skipped, throws `TooManyRequestsError` when blocked.
 *
 * @param ctx - The request context.
 * @param config - Rate limit configuration.
 * @param keyGenerator - Function to generate the rate limit key.
 * @param skip - Optional function to skip rate limiting.
 * @returns The rate limit result, or null if skipped.
 * @throws TooManyRequestsError if rate limit exceeded.
 */
const checkRateLimit = (
  ctx: RateLimitContext,
  config: CoreRateLimitConfig,
  keyGenerator: (ctx: RateLimitContext) => string,
  skip?: (ctx: RateLimitContext) => boolean,
): RateLimitResult | null => {
  if (rateLimitDisabled) return null;
  if (skip?.(ctx)) return null;

  const key = keyGenerator(ctx);
  const result = rateLimitStore.hit({
    key,
    window: config.window,
    max: config.max,
    burstAllowance: config.burstAllowance,
  });

  if (!result.allowed) {
    const retryAfterSeconds = Math.ceil(result.retryAfter / 1000);
    // Set header before the throw so it survives to the error response.
    ctx.set.headers["Retry-After"] = retryAfterSeconds.toString();

    // The generic onError line carries no client identity; log the IP here.
    logger.warn(
      {
        path: new URL(ctx.request.url).pathname,
        clientIp: getClientIP(ctx.request),
      },
      "rate limit exceeded",
    );

    throw new TooManyRequestsError(
      `Rate limit exceeded. Please try again in ${retryAfterSeconds} seconds.`,
    );
  }

  return result;
};

/**
 * Rate limit plugin that runs in `onBeforeHandle` — after route matching and
 * validation, so the key generator may use route/user context. Use this for
 * module-scoped or per-route-group limits.
 *
 * @param config - The rate limit configuration.
 * @returns An Elysia plugin that enforces rate limiting.
 *
 * @example
 * ```typescript
 * app.use(scopedRateLimitPlugin(RATE_LIMITS.STANDARD))
 * ```
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const scopedRateLimitPlugin = (config: RateLimitConfig) => {
  const { window, max, keyGenerator, burstAllowance = 0, skip } = config;

  return new Elysia().onBeforeHandle({ as: "scoped" }, (ctx) => {
    const result = checkRateLimit(
      ctx,
      { window, max, burstAllowance },
      keyGenerator,
      skip,
    );

    if (result) {
      ctx.set.headers["X-RateLimit-Limit"] = result.limit.toString();
      ctx.set.headers["X-RateLimit-Remaining"] = result.remaining.toString();
    }
  });
};

/**
 * Config for the global rate limit plugin. `keyGenerator` is intentionally
 * absent — it is hardcoded to `globalIpKeyGenerator` because `onRequest` has
 * no route/user context, and accepting a user-keyed generator here would
 * silently fall back to IP.
 */
type GlobalRateLimitConfig = Omit<RateLimitConfig, "keyGenerator">;

/**
 * Rate limit plugin that runs in `onRequest` — before route matching,
 * parsing, or validation — so rejections are as cheap as possible. Keyed on
 * the client IP. Use this for app-wide limits; use `scopedRateLimitPlugin`
 * or `rateLimitHook` when you need route or user context.
 *
 * Rejections are returned from `onRequest` rather than thrown: Elysia's
 * `onError` catching of throws out of `onRequest` has been observed to
 * diverge across environments (e.g. the Elysia playground does not catch
 * it), so returning is the robust short-circuit.
 *
 * @param config - The rate limit configuration (without `keyGenerator`).
 * @returns An Elysia plugin that enforces rate limiting at the request stage.
 *
 * @example
 * ```typescript
 * app.use(globalRateLimitPlugin({ window: ONE_MINUTE, max: 100 }))
 * ```
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const globalRateLimitPlugin = (config: GlobalRateLimitConfig) => {
  const { window, max, burstAllowance = 0, skip } = config;

  return new Elysia().onRequest(({ request, set }) => {
    try {
      const result = checkRateLimit(
        { request, set },
        { window, max, burstAllowance },
        globalIpKeyGenerator,
        skip,
      );

      if (result) {
        set.headers["X-RateLimit-Limit"] = result.limit.toString();
        set.headers["X-RateLimit-Remaining"] = result.remaining.toString();
      }
    } catch (error) {
      // Render inline via the shared onError hook so this path produces the
      // exact same response as the app-level .onError(onError) handler.
      return onError({ error, request, set });
    }
  });
};

/**
 * `beforeHandle` hook factory for per-route rate limiting — use when a
 * single route needs different limits than its module.
 *
 * @param config - The rate limit configuration for this route.
 * @returns A beforeHandle hook function.
 *
 * @example
 * ```typescript
 * .post("/users", handler, {
 *   beforeHandle: rateLimitHook(RATE_LIMITS.CREATE_USER),
 * })
 * ```
 */
export const rateLimitHook = (
  config: RateLimitConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ((ctx: any) => void) => {
  const { window, max, keyGenerator, burstAllowance = 0, skip } = config;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ctx: any): void => {
    checkRateLimit(ctx, { window, max, burstAllowance }, keyGenerator, skip);
  };
};
