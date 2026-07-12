import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";

import { createApp } from "../../../app";
import { env } from "../../../config";
import { RATE_LIMITS } from "../../../shared/middleware/rateLimit";
import { setRateLimitEnabled } from "../../../shared/middleware/rateLimit/plugin";
import { rateLimitStore } from "../../../shared/middleware/rateLimit/store";
import { expectRateLimited } from "../../../tests/helpers/rateLimit";
import type { MockUser } from "../../../tests/mock-data/users/types";
import { agent } from "../../../tests/setup";

/**
 * Parses a fetch Response into a shape suitable for assertions.
 * @param response - The Response returned by `app.handle`.
 * @returns The status code, headers, and parsed JSON body.
 */
async function parseResponse(
  response: Response,
): Promise<{ status: number; headers: Headers; body: unknown }> {
  const body = await response.json().catch(() => null);
  return { status: response.status, headers: response.headers, body };
}

describe("auth/index.ts", () => {
  let app: ReturnType<typeof createApp>;
  let carlosSilvaAB: MockUser;
  let anaCostaAdmin: MockUser;

  beforeAll(async () => {
    app = createApp();

    await agent.seed({ users: ["carlosSilvaAB", "anaCostaAdmin"] });

    carlosSilvaAB = agent.getFixture({ user: "carlosSilvaAB" });
    anaCostaAdmin = agent.getFixture({ user: "anaCostaAdmin" });
  });

  afterAll(async () => {
    await agent.clear();
  });

  describe("POST /api/auth/otp/request", () => {
    const url = "http://localhost/api/auth/otp/request";
    const validBody = { phone: "+5511912345678" };

    describe("phone validation", () => {
      test("returns 422 when phone is missing", async () => {
        const { phone: _phone, ...bodyWithoutPhone } = validBody;
        const response = await parseResponse(
          await app.handle(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(bodyWithoutPhone),
            }),
          ),
        );
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          code: "VALIDATION_ERROR",
          error:
            "The 'phone' property has an invalid value. Make sure it has an appropriate length and format.",
        });
      });

      test("returns 422 when phone has no country code", async () => {
        const response = await parseResponse(
          await app.handle(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...validBody, phone: "11912345678" }),
            }),
          ),
        );
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          code: "VALIDATION_ERROR",
          error:
            "The 'phone' property has an invalid value. Make sure it has an appropriate length and format.",
        });
      });

      test("returns 422 when phone starts with a zero after the plus sign", async () => {
        const response = await parseResponse(
          await app.handle(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...validBody, phone: "+0511912345678" }),
            }),
          ),
        );
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          code: "VALIDATION_ERROR",
          error:
            "The 'phone' property has an invalid value. Make sure it has an appropriate length and format.",
        });
      });

      test("returns 422 when phone has too few digits", async () => {
        const response = await parseResponse(
          await app.handle(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...validBody, phone: "+1234567" }),
            }),
          ),
        );
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          code: "VALIDATION_ERROR",
          error:
            "The 'phone' property has an invalid value. Make sure it has an appropriate length and format.",
        });
      });

      test("returns 422 when phone has too many digits", async () => {
        const response = await parseResponse(
          await app.handle(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...validBody,
                phone: "+1234567890123456",
              }),
            }),
          ),
        );
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          code: "VALIDATION_ERROR",
          error:
            "The 'phone' property has an invalid value. Make sure it has an appropriate length and format.",
        });
      });

      test("returns 422 when phone contains letters", async () => {
        const response = await parseResponse(
          await app.handle(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...validBody, phone: "+5511912abc678" }),
            }),
          ),
        );
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          code: "VALIDATION_ERROR",
          error:
            "The 'phone' property has an invalid value. Make sure it has an appropriate length and format.",
        });
      });
    });
  });

  describe("POST /api/auth/otp/verify", () => {
    const url = "http://localhost/api/auth/otp/verify";
    const validBody = {
      phone: "+5511912345678",
      code: "123456",
      requestToken: "ab".repeat(32),
    };

    describe("input validation", () => {
      test("returns 422 when phone is missing", async () => {
        const { phone: _phone, ...bodyWithoutPhone } = validBody;
        const response = await parseResponse(
          await app.handle(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(bodyWithoutPhone),
            }),
          ),
        );
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          code: "VALIDATION_ERROR",
          error:
            "The 'phone' property has an invalid value. Make sure it has an appropriate length and format.",
        });
      });

      test("returns 422 when phone format is invalid", async () => {
        const response = await parseResponse(
          await app.handle(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...validBody, phone: "invalid-phone" }),
            }),
          ),
        );
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          code: "VALIDATION_ERROR",
          error:
            "The 'phone' property has an invalid value. Make sure it has an appropriate length and format.",
        });
      });

      test("returns 422 when code is missing", async () => {
        const { code: _code, ...bodyWithoutCode } = validBody;
        const response = await parseResponse(
          await app.handle(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(bodyWithoutCode),
            }),
          ),
        );
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          code: "VALIDATION_ERROR",
          error:
            "The 'code' property has an invalid value. Make sure it has an appropriate length and format.",
        });
      });

      test("returns 422 when code is too short (5 chars)", async () => {
        const response = await parseResponse(
          await app.handle(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...validBody, code: "12345" }),
            }),
          ),
        );
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          code: "VALIDATION_ERROR",
          error:
            "The 'code' property has an invalid value. Make sure it has an appropriate length and format.",
        });
      });

      test("returns 422 when code is too long (7 chars)", async () => {
        const response = await parseResponse(
          await app.handle(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...validBody, code: "1234567" }),
            }),
          ),
        );
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          code: "VALIDATION_ERROR",
          error:
            "The 'code' property has an invalid value. Make sure it has an appropriate length and format.",
        });
      });

      test("returns 422 when requestToken is missing", async () => {
        const { requestToken: _t, ...bodyWithoutToken } = validBody;
        const response = await parseResponse(
          await app.handle(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(bodyWithoutToken),
            }),
          ),
        );
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          code: "VALIDATION_ERROR",
          error:
            "The 'requestToken' property has an invalid value. Make sure it has an appropriate length and format.",
        });
      });

      test("returns 422 when requestToken is shorter than 64 chars", async () => {
        const response = await parseResponse(
          await app.handle(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...validBody,
                requestToken: "a".repeat(63),
              }),
            }),
          ),
        );
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          code: "VALIDATION_ERROR",
          error:
            "The 'requestToken' property has an invalid value. Make sure it has an appropriate length and format.",
        });
      });

      test("returns 422 when requestToken is longer than 64 chars", async () => {
        const response = await parseResponse(
          await app.handle(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...validBody,
                requestToken: "a".repeat(65),
              }),
            }),
          ),
        );
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          code: "VALIDATION_ERROR",
          error:
            "The 'requestToken' property has an invalid value. Make sure it has an appropriate length and format.",
        });
      });

      test("returns 422 when requestToken contains non-hex characters", async () => {
        const response = await parseResponse(
          await app.handle(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...validBody,
                requestToken: "z".repeat(64),
              }),
            }),
          ),
        );
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          code: "VALIDATION_ERROR",
          error:
            "The 'requestToken' property has an invalid value. Make sure it has an appropriate length and format.",
        });
      });
    });
  });

  describe("POST /api/auth/refresh", () => {
    const url = "http://localhost/api/auth/refresh";

    describe("input validation", () => {
      test("returns 422 when refreshToken is missing", async () => {
        const response = await parseResponse(
          await app.handle(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            }),
          ),
        );
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          code: "VALIDATION_ERROR",
          error:
            "The 'refreshToken' property has an invalid value. Make sure it has an appropriate length and format.",
        });
      });

      test("returns 422 when refreshToken is empty string", async () => {
        const response = await parseResponse(
          await app.handle(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken: "" }),
            }),
          ),
        );
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          code: "VALIDATION_ERROR",
          error:
            "The 'refreshToken' property has an invalid value. Make sure it has an appropriate length and format.",
        });
      });

      test("returns 422 when refreshToken exceeds maxLength (1025 chars)", async () => {
        const response = await parseResponse(
          await app.handle(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken: "a".repeat(1025) }),
            }),
          ),
        );
        expect(response.status).toBe(422);
        expect(response.body).toEqual({
          code: "VALIDATION_ERROR",
          error:
            "The 'refreshToken' property has an invalid value. Make sure it has an appropriate length and format.",
        });
      });
    });
  });

  describe("Rate limiting", () => {
    // Use unique IP prefix for this test file to avoid collisions with parallel tests.
    const IP_PREFIX = "10.99";
    let testCounter = 0;

    /**
     * Generate a unique IP for the current test slot.
     * @param suffix - Sub-identifier within the test.
     * @returns A unique IPv4 string.
     */
    const uniqueIP = (suffix: string): string =>
      `${IP_PREFIX}.${testCounter}.${suffix}`;

    /**
     * Generate a phone unique to the test slot.
     * @param suffix - Sub-identifier within the test.
     * @returns A valid E.164 phone number.
     */
    const uniquePhone = (suffix: string): string => {
      const t = String(testCounter).padStart(4, "0");
      const s = String(suffix).padStart(4, "0");
      return `+55119${t}${s}`;
    };

    let originalTrustProxy: boolean;

    beforeAll(() => {
      rateLimitStore.clear();
      originalTrustProxy = env.TRUST_PROXY;
      (env as { TRUST_PROXY: boolean }).TRUST_PROXY = true;
      setRateLimitEnabled(true);
    });

    afterAll(() => {
      setRateLimitEnabled(false);
      (env as { TRUST_PROXY: boolean }).TRUST_PROXY = originalTrustProxy;
      rateLimitStore.clear();
    });

    beforeEach(() => {
      testCounter++;
    });

    afterEach(() => {
      rateLimitStore.clear();
    });

    describe("OTP request rate limiting", () => {
      /**
       * Sends an OTP request with the given IP and phone.
       * @param ip - The IP address for the request.
       * @param phone - The phone number to request OTP for.
       * @returns The fetch Response.
       */
      const requestOtpHttp = (ip: string, phone: string): Promise<Response> =>
        app.handle(
          new Request("http://localhost/api/auth/otp/request", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-forwarded-for": ip,
            },
            body: JSON.stringify({ phone }),
          }),
        );

      // NOTE: The OTP_REQUEST middleware rate limit (3/15min per IP+phone)
      // cannot be exercised here because the service-layer rate limit
      // (1/min per phone via enforceOtpRateLimit) is stricter and triggers
      // first. The first request per phone succeeds; the second is blocked
      // by the service layer with 429.

      test("returns 429 when service-layer OTP rate limit exceeded", async () => {
        const ip = uniqueIP("1");
        const phone = uniquePhone("1");

        const first = await requestOtpHttp(ip, phone);
        expect(first.status).toBe(200);

        const second = await requestOtpHttp(ip, phone);
        expect(second.status).toBe(429);
      });

      test("rate limits are isolated per phone (service layer)", async () => {
        const ip = uniqueIP("1");
        const phone1 = uniquePhone("1");
        const phone2 = uniquePhone("2");

        const r1 = await requestOtpHttp(ip, phone1);
        expect(r1.status).toBe(200);

        const limited = await requestOtpHttp(ip, phone1);
        expect(limited.status).toBe(429);

        const r2 = await requestOtpHttp(ip, phone2);
        expect(r2.status).toBe(200);
      });
    });

    describe("OTP verify rate limiting", () => {
      /**
       * Sends an OTP verify request with the given IP and phone.
       * @param ip - The IP address for the request.
       * @param phone - The phone number to verify.
       * @returns The fetch Response.
       */
      const verifyOtpHttp = (ip: string, phone: string): Promise<Response> =>
        app.handle(
          new Request("http://localhost/api/auth/otp/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-forwarded-for": ip,
            },
            body: JSON.stringify({
              phone,
              code: "123456",
              requestToken: "ab".repeat(32),
            }),
          }),
        );

      test("returns 429 when limit exceeded", async () => {
        const ip = uniqueIP("1");
        const phone = uniquePhone("1");

        for (let i = 0; i < RATE_LIMITS.OTP_VERIFY.max; i++) {
          const response = await verifyOtpHttp(ip, phone);
          expect(response.status).not.toBe(429);
        }

        const response = await verifyOtpHttp(ip, phone);
        const parsed = await parseResponse(response);
        expectRateLimited(parsed);
      });

      test("rate limits are isolated per IP+phone combination", async () => {
        const ip = uniqueIP("1");
        const phone1 = uniquePhone("1");
        const phone2 = uniquePhone("2");

        for (let i = 0; i < RATE_LIMITS.OTP_VERIFY.max; i++) {
          const response = await verifyOtpHttp(ip, phone1);
          expect(response.status).not.toBe(429);
        }

        const limited = await parseResponse(await verifyOtpHttp(ip, phone1));
        expectRateLimited(limited);

        const allowed = await verifyOtpHttp(ip, phone2);
        expect(allowed.status).not.toBe(429);
      });
    });

    describe("Token refresh rate limiting", () => {
      let validRefreshToken: string;

      /**
       * Sends a token refresh request with the given IP.
       * @param ip - The IP address for the request.
       * @returns The fetch Response.
       */
      const refreshTokenRequest = (ip: string): Promise<Response> =>
        app.handle(
          new Request("http://localhost/api/auth/refresh", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-forwarded-for": ip,
            },
            body: JSON.stringify({ refreshToken: validRefreshToken }),
          }),
        );

      beforeAll(async () => {
        const { generateAuthTokens } = await import(
          "../../../shared/utils/jwt"
        );
        const tokens = await generateAuthTokens({ userId: carlosSilvaAB.id });
        validRefreshToken = tokens.refreshToken;
      });

      test("returns 429 when limit exceeded", async () => {
        const ip = uniqueIP("1");

        for (let i = 0; i < RATE_LIMITS.TOKEN_REFRESH.max; i++) {
          const response = await refreshTokenRequest(ip);
          expect(response.status).toBe(200);
        }

        const response = await refreshTokenRequest(ip);
        const parsed = await parseResponse(response);
        expectRateLimited(parsed);
      });

      test("rate limits are isolated per IP", async () => {
        const ip1 = uniqueIP("1");
        const ip2 = uniqueIP("2");

        for (let i = 0; i < RATE_LIMITS.TOKEN_REFRESH.max; i++) {
          const response = await refreshTokenRequest(ip1);
          expect(response.status).toBe(200);
        }

        const limited = await parseResponse(await refreshTokenRequest(ip1));
        expectRateLimited(limited);

        const allowed = await refreshTokenRequest(ip2);
        expect(allowed.status).not.toBe(429);
      });
    });

    describe("Logout rate limiting", () => {
      /**
       * Sends a logout request with the given IP.
       * @param ip - The IP address for the request.
       * @returns The fetch Response.
       */
      const logoutRequest = (ip: string): Promise<Response> =>
        app.handle(
          new Request("http://localhost/api/auth/logout", {
            method: "POST",
            headers: { "x-forwarded-for": ip },
          }),
        );

      test("returns 429 when limit exceeded", async () => {
        const ip = uniqueIP("1");

        for (let i = 0; i < RATE_LIMITS.LOGOUT.max; i++) {
          const response = await logoutRequest(ip);
          expect(response.status).toBe(200);
        }

        const response = await logoutRequest(ip);
        const parsed = await parseResponse(response);
        expectRateLimited(parsed);
      });

      test("rate limits are isolated per IP", async () => {
        const ip1 = uniqueIP("1");
        const ip2 = uniqueIP("2");

        for (let i = 0; i < RATE_LIMITS.LOGOUT.max; i++) {
          const response = await logoutRequest(ip1);
          expect(response.status).toBe(200);
        }

        const limited = await parseResponse(await logoutRequest(ip1));
        expectRateLimited(limited);

        const allowed = await logoutRequest(ip2);
        expect(allowed.status).toBe(200);
      });
    });

    describe("Get current user rate limiting", () => {
      let instructorToken: string;
      let adminToken: string;

      beforeAll(async () => {
        const { generateAuthTokens } = await import(
          "../../../shared/utils/jwt"
        );
        const [a, b] = await Promise.all([
          generateAuthTokens({ userId: carlosSilvaAB.id }),
          generateAuthTokens({ userId: anaCostaAdmin.id }),
        ]);
        instructorToken = a.accessToken;
        adminToken = b.accessToken;
      });

      /**
       * Sends a GET /auth/me request with a given token and IP.
       * @param token - The access token.
       * @param ip - The IP address for the request.
       * @returns The fetch Response.
       */
      const getMeRequest = (token: string, ip: string): Promise<Response> =>
        app.handle(
          new Request("http://localhost/api/auth/me", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "x-forwarded-for": ip,
            },
          }),
        );

      test("returns 429 when limit exceeded", async () => {
        const ip = uniqueIP("1");

        for (let i = 0; i < RATE_LIMITS.STANDARD.max; i++) {
          const response = await getMeRequest(instructorToken, ip);
          expect(response.status).toBe(200);
        }

        const response = await getMeRequest(instructorToken, ip);
        const parsed = await parseResponse(response);
        expectRateLimited(parsed);
      });

      test("rate limits are isolated per user", async () => {
        const ip = uniqueIP("1");

        for (let i = 0; i < RATE_LIMITS.STANDARD.max; i++) {
          const response = await getMeRequest(instructorToken, ip);
          expect(response.status).toBe(200);
        }

        const limited = await parseResponse(
          await getMeRequest(instructorToken, ip),
        );
        expectRateLimited(limited);

        const allowed = await getMeRequest(adminToken, ip);
        expect(allowed.status).toBe(200);
      });
    });
  });
});
