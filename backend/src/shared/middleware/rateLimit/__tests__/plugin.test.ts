import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "bun:test";
import { Elysia } from "elysia";

import { env } from "../../../../config";
import { expectRateLimited } from "../../../../tests/helpers/rateLimit";
import { logger } from "../../../logger";
import { handleError } from "../../../utils/errors";
import { ipKeyGenerator } from "../keyGenerators";
import {
  globalRateLimitPlugin,
  rateLimitHook,
  scopedRateLimitPlugin,
  setRateLimitEnabled,
} from "../plugin";

/**
 * Parse a fetch Response into the shape `expectRateLimited` expects and
 * assert it is a valid 429 (status + Retry-After + body).
 * @param response - The fetch Response to check.
 */
const expectRateLimitedResponse = async (response: Response): Promise<void> => {
  const body = await response.json();
  expectRateLimited({
    status: response.status,
    headers: response.headers,
    body,
  });
};

/**
 * Helper to create an app with proper error handling.
 * @returns An Elysia app instance with error handling configured.
 */
const createTestApp = (): ReturnType<typeof Elysia.prototype.onError> =>
  new Elysia().onError(({ error, set }) => {
    const { status, body } = handleError(error);
    set.status = status;
    return body;
  });

describe("shared/middleware/rateLimit/plugin.ts", () => {
  // Store original TRUST_PROXY value
  let originalTrustProxy: boolean;
  // Counter for unique IPs per test
  let testCounter = 0;

  // Enable rate limiting for these tests (it's disabled by default in test env)
  beforeAll(() => {
    setRateLimitEnabled(true);
  });

  afterAll(() => {
    setRateLimitEnabled(false);
  });

  /**
   * Generate a unique IP for each test to avoid cross-test interference.
   * @param suffix - A suffix to identify the test.
   * @returns A unique IP address string.
   */
  const uniqueIP = (suffix: string): string => `${testCounter}.${suffix}`;

  beforeEach(() => {
    originalTrustProxy = env.TRUST_PROXY;
    (env as { TRUST_PROXY: boolean }).TRUST_PROXY = true;
    testCounter++;
  });

  afterEach(() => {
    (env as { TRUST_PROXY: boolean }).TRUST_PROXY = originalTrustProxy;
  });

  describe("scopedRateLimitPlugin()", () => {
    test("allows requests under the limit", async () => {
      const ip = uniqueIP("allow");
      const app = createTestApp()
        .use(
          scopedRateLimitPlugin({
            window: 60000,
            max: 10,
            keyGenerator: ipKeyGenerator,
          }),
        )
        .get("/test", () => "ok");

      const response = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("ok");
    });

    test("blocks requests when limit exceeded", async () => {
      const ip = uniqueIP("block");
      const app = createTestApp()
        .use(
          scopedRateLimitPlugin({
            window: 60000,
            max: 3,
            keyGenerator: ipKeyGenerator,
          }),
        )
        .get("/test", () => "ok");

      // Make 3 allowed requests
      for (let i = 0; i < 3; i++) {
        const response = await app.handle(
          new Request("http://localhost/test", {
            headers: { "x-forwarded-for": ip },
          }),
        );
        expect(response.status).toBe(200);
      }

      // 4th request should be blocked
      const response = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );

      await expectRateLimitedResponse(response);
    });

    test("logs a structured warn with the offending IP when blocked", async () => {
      const warnSpy = spyOn(logger, "warn");
      try {
        const ip = uniqueIP("log");
        const app = createTestApp()
          .use(
            scopedRateLimitPlugin({
              window: 60000,
              max: 1,
              keyGenerator: ipKeyGenerator,
            }),
          )
          .get("/test", () => "ok");

        await app.handle(
          new Request("http://localhost/test", {
            headers: { "x-forwarded-for": ip },
          }),
        );
        const blocked = await app.handle(
          new Request("http://localhost/test", {
            headers: { "x-forwarded-for": ip },
          }),
        );

        await expectRateLimitedResponse(blocked);
        expect(warnSpy).toHaveBeenCalledWith(
          { path: "/test", clientIp: ip },
          "rate limit exceeded",
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    test("returns 429 error message when blocked", async () => {
      const ip = uniqueIP("error");
      const app = createTestApp()
        .use(
          scopedRateLimitPlugin({
            window: 60000,
            max: 1,
            keyGenerator: ipKeyGenerator,
          }),
        )
        .get("/test", () => "ok");

      // First request
      await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );

      // Second request should be blocked
      const response = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );

      await expectRateLimitedResponse(response);
    });

    test("adds X-RateLimit-Limit header to response", async () => {
      const ip = uniqueIP("header1");
      const app = createTestApp()
        .use(
          scopedRateLimitPlugin({
            window: 60000,
            max: 10,
            keyGenerator: ipKeyGenerator,
          }),
        )
        .get("/test", () => "ok");

      const response = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );

      expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
    });

    test("adds X-RateLimit-Remaining header to response", async () => {
      const ip = uniqueIP("header2");
      const app = createTestApp()
        .use(
          scopedRateLimitPlugin({
            window: 60000,
            max: 10,
            keyGenerator: ipKeyGenerator,
          }),
        )
        .get("/test", () => "ok");

      const response = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );

      expect(response.headers.get("X-RateLimit-Remaining")).toBe("9");
    });

    test("decrements remaining count with each request", async () => {
      const ip = uniqueIP("decrement");
      const app = createTestApp()
        .use(
          scopedRateLimitPlugin({
            window: 60000,
            max: 5,
            keyGenerator: ipKeyGenerator,
          }),
        )
        .get("/test", () => "ok");

      for (let i = 4; i >= 0; i--) {
        const response = await app.handle(
          new Request("http://localhost/test", {
            headers: { "x-forwarded-for": ip },
          }),
        );
        expect(response.headers.get("X-RateLimit-Remaining")).toBe(String(i));
      }
    });

    test("tracks different IPs separately", async () => {
      const ipA = uniqueIP("a");
      const ipB = uniqueIP("b");
      const app = createTestApp()
        .use(
          scopedRateLimitPlugin({
            window: 60000,
            max: 2,
            keyGenerator: ipKeyGenerator,
          }),
        )
        .get("/test", () => "ok");

      // IP A makes 2 requests
      for (let i = 0; i < 2; i++) {
        await app.handle(
          new Request("http://localhost/test", {
            headers: { "x-forwarded-for": ipA },
          }),
        );
      }

      // IP A should be blocked
      const responseA = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ipA },
        }),
      );
      await expectRateLimitedResponse(responseA);

      // IP B should still be allowed
      const responseB = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ipB },
        }),
      );
      expect(responseB.status).toBe(200);
      expect(await responseB.text()).toBe("ok");
    });

    test("respects skip function", async () => {
      const ip = uniqueIP("skip");
      const app = createTestApp()
        .use(
          scopedRateLimitPlugin({
            window: 60000,
            max: 1,
            keyGenerator: ipKeyGenerator,
            skip: (ctx) => ctx.request.url.includes("skip=true"),
          }),
        )
        .get("/test", () => "ok");

      // First request consumes the limit
      await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );

      // Second request should be blocked
      const blocked = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );
      await expectRateLimitedResponse(blocked);

      // Request with skip=true should bypass rate limiting
      const skipped = await app.handle(
        new Request("http://localhost/test?skip=true", {
          headers: { "x-forwarded-for": ip },
        }),
      );
      expect(skipped.status).toBe(200);
      expect(await skipped.text()).toBe("ok");
    });

    describe("burst allowance", () => {
      test("allows burst traffic up to burst limit", async () => {
        const ip = uniqueIP("burst");
        const app = createTestApp()
          .use(
            scopedRateLimitPlugin({
              window: 60000,
              max: 10,
              keyGenerator: ipKeyGenerator,
              burstAllowance: 0.2, // 20% burst = 12 effective max
            }),
          )
          .get("/test", () => "ok");

        // Should allow 12 requests (10 * 1.2)
        for (let i = 0; i < 12; i++) {
          const response = await app.handle(
            new Request("http://localhost/test", {
              headers: { "x-forwarded-for": ip },
            }),
          );
          expect(response.status).toBe(200);
        }

        // 13th should be blocked
        const response = await app.handle(
          new Request("http://localhost/test", {
            headers: { "x-forwarded-for": ip },
          }),
        );
        await expectRateLimitedResponse(response);
      });

      test("reports configured limit in headers (not burst limit)", async () => {
        const ip = uniqueIP("burst-header");
        const app = createTestApp()
          .use(
            scopedRateLimitPlugin({
              window: 60000,
              max: 10,
              keyGenerator: ipKeyGenerator,
              burstAllowance: 0.5, // 50% burst
            }),
          )
          .get("/test", () => "ok");

        const response = await app.handle(
          new Request("http://localhost/test", {
            headers: { "x-forwarded-for": ip },
          }),
        );

        // Should report the configured max, not the burst max
        expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
      });
    });
  });

  describe("rateLimitHook()", () => {
    test("blocks requests when limit exceeded", async () => {
      const ip = uniqueIP("hook");
      const app = createTestApp().get("/test", () => "ok", {
        beforeHandle: rateLimitHook({
          window: 60000,
          max: 2,
          keyGenerator: ipKeyGenerator,
        }),
      });

      // Make 2 allowed requests
      for (let i = 0; i < 2; i++) {
        const response = await app.handle(
          new Request("http://localhost/test", {
            headers: { "x-forwarded-for": ip },
          }),
        );
        expect(response.status).toBe(200);
      }

      // 3rd request should be blocked
      const response = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );
      await expectRateLimitedResponse(response);
    });

    test("allows per-route override with different limits", async () => {
      const ipExpensive = uniqueIP("expensive");
      const ipNormal = uniqueIP("normal");

      /**
       * Custom key generator with route-specific prefix to isolate from global plugin.
       * @param ctx - The request context.
       * @returns A rate limit key with route prefix.
       */
      const expensiveKeyGenerator = (ctx: { request: Request }): string =>
        `expensive:${ipKeyGenerator(ctx)}`;

      const app = createTestApp()
        .use(
          scopedRateLimitPlugin({
            window: 60000,
            max: 100, // High default limit
            keyGenerator: ipKeyGenerator,
          }),
        )
        .get("/normal", () => "normal endpoint")
        .get("/expensive", () => "expensive endpoint", {
          // Override with stricter limit using separate key namespace
          beforeHandle: rateLimitHook({
            window: 60000,
            max: 2,
            keyGenerator: expensiveKeyGenerator,
          }),
        });

      // Make 2 requests to expensive endpoint
      for (let i = 0; i < 2; i++) {
        const response = await app.handle(
          new Request("http://localhost/expensive", {
            headers: { "x-forwarded-for": ipExpensive },
          }),
        );
        expect(response.status).toBe(200);
      }

      // 3rd request to expensive should be blocked
      const expensiveBlocked = await app.handle(
        new Request("http://localhost/expensive", {
          headers: { "x-forwarded-for": ipExpensive },
        }),
      );
      await expectRateLimitedResponse(expensiveBlocked);

      // But normal endpoint should still work (uses plugin limit)
      const normalAllowed = await app.handle(
        new Request("http://localhost/normal", {
          headers: { "x-forwarded-for": ipNormal },
        }),
      );
      expect(normalAllowed.status).toBe(200);
      expect(await normalAllowed.text()).toBe("normal endpoint");
    });

    test("supports custom key generator", async () => {
      /**
       * Custom key generator that uses an API key header.
       * @param ctx - The request context.
       * @returns A rate limit key based on the API key.
       */
      const customKeyGenerator = (ctx: { request: Request }): string => {
        return `custom:${ctx.request.headers.get("x-api-key") ?? "anonymous"}`;
      };

      const keyA = uniqueIP("user-a");
      const keyB = uniqueIP("user-b");

      const app = createTestApp().get("/test", () => "ok", {
        beforeHandle: rateLimitHook({
          window: 60000,
          max: 2,
          keyGenerator: customKeyGenerator,
        }),
      });

      // User A makes 2 requests
      for (let i = 0; i < 2; i++) {
        await app.handle(
          new Request("http://localhost/test", {
            headers: { "x-api-key": keyA },
          }),
        );
      }

      // User A should be blocked
      const blockedA = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-api-key": keyA },
        }),
      );
      await expectRateLimitedResponse(blockedA);

      // User B should still be allowed
      const allowedB = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-api-key": keyB },
        }),
      );
      expect(allowedB.status).toBe(200);
      expect(await allowedB.text()).toBe("ok");
    });

    test("supports burst allowance", async () => {
      const ip = uniqueIP("hook-burst");
      const app = createTestApp().get("/test", () => "ok", {
        beforeHandle: rateLimitHook({
          window: 60000,
          max: 5,
          burstAllowance: 0.4, // 40% burst = 7 effective
          keyGenerator: ipKeyGenerator,
        }),
      });

      // Should allow 7 requests (5 * 1.4)
      for (let i = 0; i < 7; i++) {
        const response = await app.handle(
          new Request("http://localhost/test", {
            headers: { "x-forwarded-for": ip },
          }),
        );
        expect(response.status).toBe(200);
      }

      // 8th should be blocked
      const response = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );
      await expectRateLimitedResponse(response);
    });
  });

  describe("Retry-After header", () => {
    test("sets Retry-After header when request is blocked", async () => {
      const ip = uniqueIP("retry-after");
      const app = createTestApp()
        .use(
          scopedRateLimitPlugin({
            window: 60000, // 60 seconds
            max: 1,
            keyGenerator: ipKeyGenerator,
          }),
        )
        .get("/test", () => "ok");

      // First request
      await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );

      // Second request should be blocked with Retry-After
      const response = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );

      // Retry-After should be a number of seconds <= the window (60).
      const retryAfter = response.headers.get("Retry-After");
      const seconds = parseInt(retryAfter!, 10);
      expect(seconds).toBeLessThanOrEqual(60);
      await expectRateLimitedResponse(response);
    });
  });

  describe("globalRateLimitPlugin()", () => {
    test("allows requests under the limit", async () => {
      const ip = uniqueIP("onrequest-allow");
      const app = createTestApp()
        .use(
          globalRateLimitPlugin({
            window: 60000,
            max: 10,
          }),
        )
        .get("/test", () => "ok");

      // Make 3 requests under the limit
      for (let i = 0; i < 3; i++) {
        const response = await app.handle(
          new Request("http://localhost/test", {
            headers: { "x-forwarded-for": ip },
          }),
        );

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("ok");
      }
    });

    test("blocks requests when the limit is exceeded", async () => {
      const ip = uniqueIP("onrequest-block");
      const app = createTestApp()
        .use(
          globalRateLimitPlugin({
            window: 60000,
            max: 2,
          }),
        )
        .get("/test", () => "ok");

      // First two requests should be allowed
      for (let i = 0; i < 2; i++) {
        const response = await app.handle(
          new Request("http://localhost/test", {
            headers: { "x-forwarded-for": ip },
          }),
        );
        expect(response.status).toBe(200);
      }

      // Third request should be blocked
      const response = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );

      await expectRateLimitedResponse(response);
    });

    test("sets X-RateLimit-Limit and X-RateLimit-Remaining headers on success and decrements remaining", async () => {
      const ip = uniqueIP("onrequest-headers");
      const app = createTestApp()
        .use(
          globalRateLimitPlugin({
            window: 60000,
            max: 5,
          }),
        )
        .get("/test", () => "ok");

      // Make 3 successive requests and verify headers
      for (const expectedRemaining of ["4", "3", "2"]) {
        const response = await app.handle(
          new Request("http://localhost/test", {
            headers: { "x-forwarded-for": ip },
          }),
        );

        expect(response.headers.get("X-RateLimit-Limit")).toBe("5");
        expect(response.headers.get("X-RateLimit-Remaining")).toBe(
          expectedRemaining,
        );
      }
    });

    test("sets Retry-After header on 429", async () => {
      const ip = uniqueIP("onrequest-retry-after");
      const app = createTestApp()
        .use(
          globalRateLimitPlugin({
            window: 60000,
            max: 1,
          }),
        )
        .get("/test", () => "ok");

      // First request consumes the limit
      await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );

      // Second request should be blocked with Retry-After
      const response = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );

      // Retry-After should be a number of seconds <= the window (60).
      const retryAfter = response.headers.get("Retry-After");
      const seconds = parseInt(retryAfter!, 10);
      expect(seconds).toBeLessThanOrEqual(60);
      await expectRateLimitedResponse(response);
    });

    test("tracks different IPs separately", async () => {
      const ipA = uniqueIP("onrequest-ip-a");
      const ipB = uniqueIP("onrequest-ip-b");
      const app = createTestApp()
        .use(
          globalRateLimitPlugin({
            window: 60000,
            max: 2,
          }),
        )
        .get("/test", () => "ok");

      // IP A makes 2 requests
      for (let i = 0; i < 2; i++) {
        const response = await app.handle(
          new Request("http://localhost/test", {
            headers: { "x-forwarded-for": ipA },
          }),
        );
        expect(response.status).toBe(200);
      }

      // IP A should be blocked on third request
      const responseA = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ipA },
        }),
      );
      await expectRateLimitedResponse(responseA);

      // IP B should still be allowed
      const responseB = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ipB },
        }),
      );
      expect(responseB.status).toBe(200);
      expect(await responseB.text()).toBe("ok");
    });

    test("respects the skip function", async () => {
      const ip = uniqueIP("onrequest-skip");
      const app = createTestApp()
        .use(
          globalRateLimitPlugin({
            window: 60000,
            max: 1,
            skip: (ctx) => ctx.request.url.includes("skip=true"),
          }),
        )
        .get("/test", () => "ok");

      // Make 5 requests with skip=true, all should pass
      for (let i = 0; i < 5; i++) {
        const response = await app.handle(
          new Request("http://localhost/test?skip=true", {
            headers: { "x-forwarded-for": ip },
          }),
        );
        expect(response.status).toBe(200);
      }
    });

    test("does not invoke the route handler when blocked", async () => {
      const ip = uniqueIP("onrequest-handler");
      let handlerCalls = 0;

      const app = createTestApp()
        .use(
          globalRateLimitPlugin({
            window: 60000,
            max: 1,
          }),
        )
        .get("/test", () => {
          handlerCalls++;
          return "ok";
        });

      // First request should call handler
      const response1 = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );
      expect(response1.status).toBe(200);
      expect(await response1.text()).toBe("ok");

      // Second request should be blocked without calling handler
      const response2 = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );
      await expectRateLimitedResponse(response2);

      // Third request should also be blocked
      const response3 = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );
      await expectRateLimitedResponse(response3);

      // Handler should have been called only once
      expect(handlerCalls).toBe(1);
    });

    test("applies to every route on the root app", async () => {
      const ip = uniqueIP("onrequest-routes");
      const app = createTestApp()
        .use(
          globalRateLimitPlugin({
            window: 60000,
            max: 2,
          }),
        )
        .get("/a", () => "a")
        .get("/b", () => "b");

      // First request to /a
      const responseA1 = await app.handle(
        new Request("http://localhost/a", {
          headers: { "x-forwarded-for": ip },
        }),
      );
      expect(responseA1.status).toBe(200);
      expect(await responseA1.text()).toBe("a");

      // First request to /b
      const responseB1 = await app.handle(
        new Request("http://localhost/b", {
          headers: { "x-forwarded-for": ip },
        }),
      );
      expect(responseB1.status).toBe(200);
      expect(await responseB1.text()).toBe("b");

      // Third request to either route should be blocked
      const responseA2 = await app.handle(
        new Request("http://localhost/a", {
          headers: { "x-forwarded-for": ip },
        }),
      );
      await expectRateLimitedResponse(responseA2);

      // Verify /b is also blocked
      const responseB2 = await app.handle(
        new Request("http://localhost/b", {
          headers: { "x-forwarded-for": ip },
        }),
      );
      await expectRateLimitedResponse(responseB2);
    });

    test("allows burst requests up to the burst allowance", async () => {
      const ip = uniqueIP("onrequest-burst");
      const app = createTestApp()
        .use(
          globalRateLimitPlugin({
            window: 60000,
            max: 10,
            burstAllowance: 0.2, // 20% burst = 12 effective max
          }),
        )
        .get("/test", () => "ok");

      // Should allow 12 requests (10 * 1.2)
      for (let i = 0; i < 12; i++) {
        const response = await app.handle(
          new Request("http://localhost/test", {
            headers: { "x-forwarded-for": ip },
          }),
        );
        expect(response.status).toBe(200);
        // Verify limit header equals configured max, not burst ceiling
        expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
      }

      // 13th should be blocked
      const response = await app.handle(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": ip },
        }),
      );
      await expectRateLimitedResponse(response);
    });
  });
});
