import { describe, test } from "bun:test";

import type { createTestApp } from "../app";

/** Configuration for reusable pagination validation tests. */
interface PaginationValidationConfig {
  /** The test app instance (lazy getter to support deferred initialization). */
  app: () => ReturnType<typeof createTestApp>;
  /** Builds the full URL for a given query string. */
  buildUrl: (query: string) => string;
  /** Auth headers to include in the request (lazy getter). */
  headers: () => Record<string, string>;
}

/**
 * Generates pagination validation tests for limit and offset query parameters.
 * @param config - Test configuration for the paginated route.
 * @returns Nothing. Registers pagination validation test cases.
 * @public Reusable test harness for future paginated endpoints.
 */
export function testPaginationValidation(
  config: PaginationValidationConfig,
): void {
  const { app: getApp, buildUrl, headers: getHeaders } = config;

  const expectedBody = {
    code: "VALIDATION_ERROR",
    error:
      "Invalid input. Make sure all values have an appropriate length and format.",
  };

  describe("pagination validation", () => {
    test("returns 422 (Validation) when limit is 0", async () => {
      const response = await getApp().handle(
        new Request(buildUrl("limit=0"), {
          method: "GET",
          headers: getHeaders(),
        }),
      );
      response.expectStatus(422).expectBody(expectedBody);
    });

    test("returns 422 (Validation) when limit exceeds 100", async () => {
      const response = await getApp().handle(
        new Request(buildUrl("limit=101"), {
          method: "GET",
          headers: getHeaders(),
        }),
      );
      response.expectStatus(422).expectBody(expectedBody);
    });

    test("returns 422 (Validation) when offset is negative", async () => {
      const response = await getApp().handle(
        new Request(buildUrl("offset=-1"), {
          method: "GET",
          headers: getHeaders(),
        }),
      );
      response.expectStatus(422).expectBody(expectedBody);
    });
  });
}
