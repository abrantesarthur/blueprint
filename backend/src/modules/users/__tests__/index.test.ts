import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";

import { deleteUsers, findUser, findUsers } from "../../../db";
import { RATE_LIMITS } from "../../../shared/middleware/rateLimit";
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
import type { SuccessResponse } from "../../shared/schema";
import type { UserResponse } from "../model";

describe("users/index.ts", () => {
  let app: ReturnType<typeof createTestApp>;

  let primaryUser: MockUser;
  let otherUser: MockUser;

  let primaryToken: string;
  let otherToken: string;

  beforeAll(async () => {
    app = createTestApp();

    await agent.seed({ users: ["carlosSilvaAB", "mariaSantosB"] });

    primaryUser = agent.getFixture({ user: "carlosSilvaAB" });
    otherUser = agent.getFixture({ user: "mariaSantosB" });

    const tokens = await generateTestAccessTokens({
      primaryToken: primaryUser.id,
      otherToken: otherUser.id,
    });
    primaryToken = tokens.primaryToken;
    otherToken = tokens.otherToken;
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

    test("returns 200 with the new user record on the happy path", async () => {
      const { status, body } = await app.handle<UserResponse>(
        new Request(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: "Alice",
            lastName: "Silva",
            email: "alice.silva@test.com",
          }),
        }),
      );

      expect(status).toBe(200);
      expect(body).toMatchObject({
        firstName: "Alice",
        lastName: "Silva",
        email: "alice.silva@test.com",
      });
      expect(body.id).toBeString();
      expect(body.createdAt).toBeString();
      expect(new Date(body.createdAt).getTime()).not.toBeNaN();
      expect(body).not.toHaveProperty("updatedAt");

      createdUserIds.push(body.id);
    });

    test("returns 422 when firstName is too short", async () => {
      const response = await app.handle(
        new Request(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstName: "A", lastName: "Silva" }),
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
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstName: "Frank", lastName: "Miller99" }),
        }),
      );

      response.expectStatus(422).expectBody({
        code: "VALIDATION_ERROR",
        error:
          "The 'lastName' property has an invalid value. Make sure it has an appropriate length and format.",
      });
    });

    test("returns 422 when email format is invalid", async () => {
      const response = await app.handle(
        new Request(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: "Frank",
            lastName: "Miller",
            email: "not-an-email",
          }),
        }),
      );

      response.expectStatus(422).expectBody({
        code: "VALIDATION_ERROR",
        error:
          "The 'email' property has an invalid value. Make sure it has an appropriate length and format.",
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
          const response = await app.handle<UserResponse>(
            new Request(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ firstName: "Rate", lastName: "Limited" }),
            }),
          );

          if (response.status === 200) {
            createdUserIds.push(response.body.id);
          }
          if (i < effectiveMax - 1) {
            expect(response.status).toBe(200);
          }
        }

        const response = await app.handle(
          new Request(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ firstName: "Over", lastName: "Limit" }),
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

    test("returns 200 with the caller's user record when fetching self", async () => {
      const dbUser = await findUser({ where: { id: primaryUser.id } });

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
        createdAt: dbUser.createdAt.toISOString(),
      });
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

    test("returns 422 when email format is invalid", async () => {
      const response = await app.handle(
        new Request(url, {
          method: "PATCH",
          headers: {
            ...authHeaders(primaryToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: "not-an-email" }),
        }),
      );
      response.expectStatus(422).expectBody({
        code: "VALIDATION_ERROR",
        error:
          "The 'email' property has an invalid value. Make sure it has an appropriate length and format.",
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
        email: primaryUser.email,
        firstName: "Updated",
        lastName: "Name",
      });
      expect(body.createdAt).toBeString();
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
      const [userBefore] = await findUsers({ where: { id: primaryUser.id } });
      expect(userBefore).toBeDefined();

      const { status, body } = await app.handle<SuccessResponse>(
        new Request("http://localhost/api/users/me", {
          method: "DELETE",
          headers: authHeaders(primaryToken),
        }),
      );

      expect(status).toBe(200);
      expect(body).toEqual({ success: true });

      const userAfter = await findUsers({ where: { id: primaryUser.id } });
      expect(userAfter).toEqual([]);

      await agent.seed({ users: ["carlosSilvaAB"] });
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

    afterAll(async () => {
      disableRateLimitingForTests(originalTrustProxy);
      await Promise.all([
        deleteUsers({ where: { id: primaryUser.id } }),
        deleteUsers({ where: { id: otherUser.id } }),
      ]);
      await agent.seed({ users: ["carlosSilvaAB", "mariaSantosB"] });
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

      // DELETE shares the bucket with PATCH so it must be rate limited
      // (and the user must not be deleted).
      const response = await deleteMe(primaryToken);
      expectRateLimited(response);
    });
  });
});
