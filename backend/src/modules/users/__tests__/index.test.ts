import { hashSha256 } from "@blueprint/crypto-utils";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";

import {
  createOtpCode,
  createUsers,
  deleteOtpCodes,
  deleteUsers,
  findOneOtpCode,
  findOneUser,
  updateUsers,
} from "../../../db";
import { RATE_LIMITS } from "../../../shared/middleware/rateLimit";
import {
  generateAuthTokens,
  generateRegistrationToken,
} from "../../../shared/utils/jwt";
import { createTestApp } from "../../../tests/app";
import { authHeaders, generateTestAccessTokens } from "../../../tests/auth";
import {
  clearAllRateLimits,
  disableRateLimitingForTests,
  enableRateLimitingForTests,
  expectRateLimited,
} from "../../../tests/helpers";
import type { MockUser } from "../../../tests/mock-data/users/types";
import { agent } from "../../../tests/setup";
import type { UserCreateResponse, UserResponse } from "../model";

describe("users/index.ts", () => {
  let app: ReturnType<typeof createTestApp>;

  let primaryUser: MockUser;
  let otherUser: MockUser;
  let adminUser: MockUser;

  let primaryToken: string;
  let otherToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = createTestApp();

    await agent.seed({
      users: ["carlosSilvaAB", "mariaSantosB", "anaCostaAdmin"],
    });

    primaryUser = agent.getFixture({ user: "carlosSilvaAB" });
    otherUser = agent.getFixture({ user: "mariaSantosB" });
    adminUser = agent.getFixture({ user: "anaCostaAdmin" });

    const tokens = await generateTestAccessTokens({
      primaryToken: primaryUser.id,
      otherToken: otherUser.id,
      adminToken: adminUser.id,
    });
    primaryToken = tokens.primaryToken;
    otherToken = tokens.otherToken;
    adminToken = tokens.adminToken;
  });

  afterAll(async () => {
    await agent.clear();
  });

  describe("POST /api/users", () => {
    const url = "http://localhost/api/users";
    /** Ids of users created by these tests — cleaned up in afterAll. */
    const createdUserIds: string[] = [];

    afterAll(async () => {
      await Promise.all(
        createdUserIds.map((id) =>
          deleteUsers({ where: { id } }).catch(() => {}),
        ),
      );
    });

    test("returns 200 with the new user and auth tokens on the happy path", async () => {
      const phone = "+5511986666666";
      const { registrationToken } = await generateRegistrationToken({ phone });

      const { status, body } = await app.handle<UserCreateResponse>(
        new Request(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registrationToken,
            firstName: "Alice",
            lastName: "Silva",
          }),
        }),
      );

      expect(status).toBe(200);
      expect(body.user).toMatchObject({
        firstName: "Alice",
        lastName: "Silva",
        role: "user",
      });
      expect(body.user.id).toBeString();
      expect(body.accessToken).toBeString();
      expect(body.refreshToken).toBeString();
      expect(body.accessTokenExpiresIn).toBeNumber();
      expect(body.refreshTokenExpiresIn).toBeNumber();

      createdUserIds.push(body.user.id);
    });

    test("returns 401 when the registration token is malformed", async () => {
      const response = await app.handle(
        new Request(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registrationToken: "not-a-valid-token",
            firstName: "Bob",
            lastName: "Jones",
          }),
        }),
      );

      response.expectStatus(401).expectBody({
        code: "UNAUTHORIZED",
        error: "Invalid or expired registration token",
      });
    });

    test("returns 401 when an access token is used instead of a registration token", async () => {
      const { accessToken } = await generateAuthTokens({
        userId: primaryUser.id,
      });

      const response = await app.handle(
        new Request(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registrationToken: accessToken,
            firstName: "Bob",
            lastName: "Jones",
          }),
        }),
      );

      response.expectStatus(401).expectBody({
        code: "UNAUTHORIZED",
        error: "Invalid or expired registration token",
      });
    });

    test("returns 409 when the verified phone is already registered", async () => {
      const { registrationToken } = await generateRegistrationToken({
        phone: primaryUser.phone,
      });

      const response = await app.handle(
        new Request(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registrationToken,
            firstName: "Charlie",
            lastName: "Brown",
          }),
        }),
      );

      response.expectStatus(409).expectBody({
        code: "CONFLICT",
        error: "A user with this phone number already exists",
      });
    });

    test("returns 422 when registrationToken is missing", async () => {
      const response = await app.handle(
        new Request(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: "David",
            lastName: "Lee",
          }),
        }),
      );

      response.expectStatus(422).expectBody({
        code: "VALIDATION_ERROR",
      });
    });

    test("returns 422 when firstName is too short", async () => {
      const { registrationToken } = await generateRegistrationToken({
        phone: "+5511983333333",
      });

      const response = await app.handle(
        new Request(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registrationToken,
            firstName: "A",
            lastName: "Silva",
          }),
        }),
      );

      response.expectStatus(422).expectBody({
        code: "VALIDATION_ERROR",
      });
    });

    test("returns 422 when firstName contains digits", async () => {
      const { registrationToken } = await generateRegistrationToken({
        phone: "+5511984444444",
      });

      const response = await app.handle(
        new Request(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registrationToken,
            firstName: "Frank123",
            lastName: "Miller",
          }),
        }),
      );

      response.expectStatus(422).expectBody({
        code: "VALIDATION_ERROR",
      });
    });

    describe("Rate limiting", () => {
      let originalTrustProxy: boolean;

      beforeAll(() => {
        clearAllRateLimits();
        originalTrustProxy = enableRateLimitingForTests();
      });

      afterAll(() => {
        disableRateLimitingForTests(originalTrustProxy);
      });

      afterEach(() => {
        clearAllRateLimits();
      });

      test("returns 429 once the per-IP burst window is exhausted", async () => {
        const BURST_ALLOWANCE = 0.1;
        const effectiveMax = Math.floor(
          RATE_LIMITS.CREATE_USER.max * (1 + BURST_ALLOWANCE),
        );

        for (let i = 0; i < effectiveMax; i++) {
          const phone = `+55119${String(i).padStart(8, "0")}`;
          const { registrationToken } = await generateRegistrationToken({
            phone,
          });

          const response = await app.handle<UserCreateResponse>(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                registrationToken,
                firstName: "Rate",
                lastName: "Limited",
              }),
            }),
          );

          if (i < effectiveMax - 1) {
            expect(response.status).toBe(200);
            createdUserIds.push(response.body.user.id);
          }
        }

        const { registrationToken } = await generateRegistrationToken({
          phone: "+5511979999999",
        });

        const response = await app.handle(
          new Request(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              registrationToken,
              firstName: "Over",
              lastName: "Limit",
            }),
          }),
        );

        expectRateLimited(response);
      });
    });
  });

  describe("GET /api/users/:id", () => {
    /**
     * Builds the endpoint URL for the given user id.
     * @param id - The user id to interpolate into the path.
     * @returns The full endpoint URL.
     */
    const url = (id: string): string => `http://localhost/api/users/${id}`;

    test("returns 401 (Unauthorized) when no auth token provided", async () => {
      const response = await app.handle(
        new Request(url(primaryUser.id), { method: "GET" }),
      );
      response
        .expectStatus(401)
        .expectBody({ error: "Authentication required" });
    });

    test("returns 422 (Validation) when id is not a valid uuid", async () => {
      const response = await app.handle(
        new Request(url("not-a-uuid"), {
          method: "GET",
          headers: authHeaders(primaryToken),
        }),
      );
      response.expectStatus(422).expectBody({
        code: "VALIDATION_ERROR",
        error:
          "The 'id' property has an invalid value. Make sure it has an appropriate length and format.",
      });
    });

    test("returns 200 with the caller's full user record when fetching self", async () => {
      const dbUser = await findOneUser({ where: { id: primaryUser.id } });

      const { status, body } = await app.handle<UserResponse>(
        new Request(url(primaryUser.id), {
          method: "GET",
          headers: authHeaders(primaryToken),
        }),
      );

      expect(status).toBe(200);
      expect(body).toMatchObject({
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        role: dbUser.role,
        phone: dbUser.phone,
      });
      expect(new Date(body.createdAt)).toBeInstanceOf(Date);
    });

    test("returns 200 when admin fetches another user's record", async () => {
      const { status, body } = await app.handle<UserResponse>(
        new Request(url(primaryUser.id), {
          method: "GET",
          headers: authHeaders(adminToken),
        }),
      );

      expect(status).toBe(200);
      expect(body.id).toBe(primaryUser.id);
    });

    test("returns 403 when a non-admin fetches another user's record", async () => {
      const response = await app.handle(
        new Request(url(primaryUser.id), {
          method: "GET",
          headers: authHeaders(otherToken),
        }),
      );
      response.expectStatus(403);
    });

    test("response excludes sensitive fields (phoneVerified, otpRequestedAt, updatedAt)", async () => {
      const { status, body } = await app.handle<Record<string, unknown>>(
        new Request(url(primaryUser.id), {
          method: "GET",
          headers: authHeaders(primaryToken),
        }),
      );

      expect(status).toBe(200);
      expect(body).not.toHaveProperty("phoneVerified");
      expect(body).not.toHaveProperty("otpRequestedAt");
      expect(body).not.toHaveProperty("updatedAt");
    });
  });

  describe("PATCH /api/users/me", () => {
    const url = "http://localhost/api/users/me";

    afterEach(async () => {
      await deleteUsers({ where: { id: primaryUser.id } });
      await agent.seed({ users: ["carlosSilvaAB"] });
    });

    test("returns 401 (Unauthorized) when no auth token provided", async () => {
      const response = await app.handle(
        new Request(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstName: "Updated" }),
        }),
      );
      response
        .expectStatus(401)
        .expectBody({ error: "Authentication required" });
    });

    test("returns 422 when firstName is too short", async () => {
      const response = await app.handle(
        new Request(url, {
          method: "PATCH",
          headers: {
            ...authHeaders(primaryToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ firstName: "A" }),
        }),
      );
      response.expectStatus(422).expectBody({
        code: "VALIDATION_ERROR",
        error:
          "The 'firstName' property has an invalid value. Make sure it has an appropriate length and format.",
      });
    });

    test("returns 422 when lastName contains digits", async () => {
      const response = await app.handle(
        new Request(url, {
          method: "PATCH",
          headers: {
            ...authHeaders(primaryToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ lastName: "Silva99" }),
        }),
      );
      response.expectStatus(422).expectBody({
        code: "VALIDATION_ERROR",
        error:
          "The 'lastName' property has an invalid value. Make sure it has an appropriate length and format.",
      });
    });

    test("successfully updates allowed fields and returns the user record", async () => {
      const { status, body } = await app.handle<UserResponse>(
        new Request(url, {
          method: "PATCH",
          headers: {
            ...authHeaders(primaryToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            firstName: "Updated",
            lastName: "Name",
          }),
        }),
      );

      expect(status).toBe(200);
      expect(body).toMatchObject({
        id: primaryUser.id,
        firstName: "Updated",
        lastName: "Name",
      });
    });
  });

  describe("PATCH /api/users/me/phone", () => {
    const url = "http://localhost/api/users/me/phone";

    const KNOWN_CODE = "525252";
    const KNOWN_REQUEST_TOKEN = "0a".repeat(32);

    const phonesToCleanup: string[] = [];

    afterAll(async () => {
      await Promise.all(
        phonesToCleanup.map((phone) =>
          deleteOtpCodes({ where: { phone } }).catch(() => {}),
        ),
      );
    });

    /**
     * Seeds an OTP record for a phone with known plaintext code and token.
     * @param phone - The phone number to seed.
     */
    async function seedOtp(phone: string): Promise<void> {
      phonesToCleanup.push(phone);
      await createOtpCode({
        data: {
          phone,
          code: hashSha256(KNOWN_CODE),
          requestToken: hashSha256(KNOWN_REQUEST_TOKEN),
          expiresAt: new Date(Date.now() + 300_000),
        },
        onConflictDoUpdate: {
          target: "phone",
          set: {
            code: hashSha256(KNOWN_CODE),
            requestToken: hashSha256(KNOWN_REQUEST_TOKEN),
            expiresAt: new Date(Date.now() + 300_000),
            attempts: 0,
          },
        },
      });
    }

    test("returns 401 (Unauthorized) when no auth token provided", async () => {
      const response = await app.handle(
        new Request(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: "+5511955551111",
            code: KNOWN_CODE,
            requestToken: KNOWN_REQUEST_TOKEN,
          }),
        }),
      );
      response
        .expectStatus(401)
        .expectBody({ error: "Authentication required" });
    });

    test("returns 422 (Validation) when phone format is invalid", async () => {
      const response = await app.handle(
        new Request(url, {
          method: "PATCH",
          headers: {
            ...authHeaders(primaryToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: "11912345678",
            code: KNOWN_CODE,
            requestToken: KNOWN_REQUEST_TOKEN,
          }),
        }),
      );
      response.expectStatus(422).expectBody({
        code: "VALIDATION_ERROR",
        error:
          "The 'phone' property has an invalid value. Make sure it has an appropriate length and format.",
      });
    });

    test("returns 422 (Validation) when code is not 6 chars", async () => {
      const response = await app.handle(
        new Request(url, {
          method: "PATCH",
          headers: {
            ...authHeaders(primaryToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: "+5511955552222",
            code: "12345",
            requestToken: KNOWN_REQUEST_TOKEN,
          }),
        }),
      );
      response.expectStatus(422).expectBody({
        code: "VALIDATION_ERROR",
        error:
          "The 'code' property has an invalid value. Make sure it has an appropriate length and format.",
      });
    });

    test("returns 422 (Validation) when requestToken is wrong length", async () => {
      const response = await app.handle(
        new Request(url, {
          method: "PATCH",
          headers: {
            ...authHeaders(primaryToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: "+5511955552222",
            code: KNOWN_CODE,
            requestToken: "abc",
          }),
        }),
      );
      response.expectStatus(422).expectBody({
        code: "VALIDATION_ERROR",
        error:
          "The 'requestToken' property has an invalid value. Make sure it has an appropriate length and format.",
      });
    });

    test("returns 422 (Validation) when phone field is missing", async () => {
      const response = await app.handle(
        new Request(url, {
          method: "PATCH",
          headers: {
            ...authHeaders(primaryToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: KNOWN_CODE,
            requestToken: KNOWN_REQUEST_TOKEN,
          }),
        }),
      );
      response.expectStatus(422).expectBody({
        code: "VALIDATION_ERROR",
        error:
          "The 'phone' property has an invalid value. Make sure it has an appropriate length and format.",
      });
    });

    test("successfully updates phone and returns 200 with the updated user", async () => {
      const userBefore = await findOneUser({
        where: { id: primaryUser.id },
        require: false,
      });
      expect(userBefore).toBeDefined();

      const newPhone = "+5511955553333";
      await seedOtp(newPhone);

      const { status, body } = await app.handle<UserResponse>(
        new Request(url, {
          method: "PATCH",
          headers: {
            ...authHeaders(primaryToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: newPhone,
            code: KNOWN_CODE,
            requestToken: KNOWN_REQUEST_TOKEN,
          }),
        }),
      );

      expect(status).toBe(200);
      expect(body).toMatchObject({ id: primaryUser.id, phone: newPhone });

      const otp = await findOneOtpCode({
        where: { phone: newPhone },
        require: false,
      });
      expect(otp).toBeNull();

      await updateUsers({
        where: { id: primaryUser.id },
        values: {
          phone: userBefore!.phone,
          phoneVerified: userBefore!.phoneVerified,
        },
      });
    });
  });

  describe("DELETE /api/users/me", () => {
    test("returns 401 (Unauthorized) when no auth token provided", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/users/me", { method: "DELETE" }),
      );
      response
        .expectStatus(401)
        .expectBody({ error: "Authentication required" });
    });

    test("successfully deletes user account and returns success", async () => {
      const userBefore = await findOneUser({
        where: { id: primaryUser.id },
        require: false,
      });
      expect(userBefore).toBeDefined();

      const { status, body } = await app.handle<{ success: boolean }>(
        new Request("http://localhost/api/users/me", {
          method: "DELETE",
          headers: authHeaders(primaryToken),
        }),
      );

      expect(status).toBe(200);
      expect(body).toMatchObject({ success: true });

      const userAfter = await findOneUser({
        where: { id: primaryUser.id },
        require: false,
      });
      expect(userAfter).toBeNull();

      // Restore so subsequent describe blocks still see the seeded user.
      await createUsers({
        data: [
          {
            id: userBefore!.id,
            email: userBefore!.email,
            firstName: userBefore!.firstName,
            lastName: userBefore!.lastName,
            phone: userBefore!.phone,
            phoneVerified: userBefore!.phoneVerified,
            role: userBefore!.role,
            otpRequestedAt: userBefore!.otpRequestedAt,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
    });
  });

  describe("Rate limiting", () => {
    // STANDARD tier with 10% burst allowance
    const BURST_ALLOWANCE = 0.1;
    const EFFECTIVE_MAX = Math.floor(
      RATE_LIMITS.STANDARD.max * (1 + BURST_ALLOWANCE),
    );

    let originalTrustProxy: boolean;

    beforeAll(() => {
      clearAllRateLimits();
      originalTrustProxy = enableRateLimitingForTests();
    });

    afterAll(() => {
      disableRateLimitingForTests(originalTrustProxy);
    });

    afterEach(() => {
      clearAllRateLimits();
    });

    /**
     * Sends a PATCH /me request with minimal valid data.
     * @param token - The auth token.
     * @returns The response promise.
     */
    const patchMe = (token: string): ReturnType<typeof app.handle> =>
      app.handle(
        new Request("http://localhost/api/users/me", {
          method: "PATCH",
          headers: {
            ...authHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ firstName: "Test" }),
        }),
      );

    /**
     * Sends a DELETE /me request.
     * @param token - The auth token.
     * @returns The response promise.
     */
    const deleteMe = (token: string): ReturnType<typeof app.handle> =>
      app.handle(
        new Request("http://localhost/api/users/me", {
          method: "DELETE",
          headers: authHeaders(token),
        }),
      );

    test("PATCH /me returns 429 when limit exceeded", async () => {
      for (let i = 0; i < EFFECTIVE_MAX; i++) {
        const response = await patchMe(primaryToken);
        expect(response.status).toBe(200);
      }

      const response = await patchMe(primaryToken);
      expectRateLimited(response);
    });

    test("DELETE /me returns 429 when limit exceeded", async () => {
      // Exhaust the rate limit using PATCH requests first
      // (can't call DELETE many times since it deletes the user).
      for (let i = 0; i < EFFECTIVE_MAX; i++) {
        const response = await patchMe(primaryToken);
        expect(response.status).toBe(200);
      }

      // DELETE shares the bucket with PATCH so it must be rate limited.
      const response = await deleteMe(primaryToken);
      expectRateLimited(response);
    });

    test("rate limits are isolated per user", async () => {
      for (let i = 0; i < EFFECTIVE_MAX; i++) {
        const response = await patchMe(primaryToken);
        expect(response.status).toBe(200);
      }

      const limitedResponse = await patchMe(primaryToken);
      expectRateLimited(limitedResponse);

      const allowedResponse = await patchMe(otherToken);
      expect(allowedResponse.status).toBe(200);
    });

    test("all endpoints share the same rate limit bucket", async () => {
      for (let i = 0; i < EFFECTIVE_MAX; i++) {
        const response = await patchMe(primaryToken);
        expect(response.status).toBe(200);
      }

      const response = await deleteMe(primaryToken);
      expectRateLimited(response);
    });
  });
});
