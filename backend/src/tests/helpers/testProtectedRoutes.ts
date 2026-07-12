import { test } from "bun:test";

import type { createTestApp } from "../app";

/** Configuration for common protected route error tests. */
interface ProtectedRouteTestConfig {
  /** The test app instance (lazy getter). */
  app: () => ReturnType<typeof createTestApp>;
  /** Builds the full URL for a given ID. */
  buildUrl: (id: string) => string;
  /** HTTP method for the request. */
  method: string;
  /** Auth headers to include in authenticated requests (lazy getter). */
  headers: () => Record<string, string>;
  /** Optional JSON body to include in the request. */
  body?: Record<string, unknown>;
  /** Error message for 404 responses. */
  notFoundError: string;
}

/**
 * Generates common protected route tests: 401 (no auth), 422 (invalid UUID), 404 (not found).
 * @param config - Test configuration for the route.
 * @returns Nothing. Registers test cases.
 * @public Reusable test harness for future protected-by-id endpoints.
 */
export function testProtectedRoutes(config: ProtectedRouteTestConfig): void {
  const {
    app: getApp,
    buildUrl,
    method,
    headers: getHeaders,
    body,
    notFoundError,
  } = config;

  const validId = "550e8400-e29b-41d4-a716-446655440000";
  const fakeId = "00000000-0000-0000-0000-000000000000";
  const invalidId = "not-a-uuid";

  /**
   * Builds request init options for a request.
   * @param headers - Optional headers to include.
   * @returns The request init object.
   */
  const requestInit = (headers?: Record<string, string>): RequestInit => {
    const init: RequestInit = { method };
    if (body) {
      init.headers = { ...headers, "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    } else if (headers) {
      init.headers = headers;
    }
    return init;
  };

  test("returns 401 (Unauthorized) when no auth token provided", async () => {
    const response = await getApp().handle(
      new Request(buildUrl(validId), requestInit()),
    );
    response.expectStatus(401).expectBody({ error: "Authentication required" });
  });

  test("returns 422 (Validation) when ID is not a valid UUID", async () => {
    const response = await getApp().handle(
      new Request(buildUrl(invalidId), requestInit(getHeaders())),
    );
    response.expectStatus(422).expectBody({
      code: "VALIDATION_ERROR",
      error:
        "The 'id' property has an invalid value. Make sure it has an appropriate length and format.",
    });
  });

  test("returns 404 (Not Found) when resource does not exist", async () => {
    const response = await getApp().handle(
      new Request(buildUrl(fakeId), requestInit(getHeaders())),
    );
    response.expectStatus(404).expectBody({ error: notFoundError });
  });
}
