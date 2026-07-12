import { expect } from "bun:test";

import { createApp } from "../app";

/** Response wrapper with fluent assertion methods for testing. */
interface TestResponse<T = unknown> {
  /** HTTP status code. */
  status: number;
  /** Parsed JSON body. */
  body: T;
  /** Response headers. */
  headers: Headers;
  /** Asserts the response status equals the expected code. */
  expectStatus: (code: number) => TestResponse<T>;
  /** Asserts the body matches the expected partial object. */
  expectBody: <U>(expected: Partial<U>) => TestResponse<T>;
}

/**
 * Creates a test app wrapper with a fluent API for response assertions.
 * @returns App with a typed handle method.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createTestApp() {
  const app = createApp();

  return {
    /**
     * Handles a request and returns a response with assertion helpers.
     * @param request - The request to handle.
     * @returns Response with status, body, and assertion methods.
     */
    handle: async <T = unknown>(request: Request): Promise<TestResponse<T>> => {
      const response = await app.handle(request);
      const body = (await response.json().catch(() => null)) as T;

      const result: TestResponse<T> = {
        status: response.status,
        body,
        headers: response.headers,
        expectStatus(code: number) {
          expect(response.status).toBe(code);
          return result;
        },
        expectBody<U>(expected: Partial<U>) {
          expect(body).toMatchObject(expected);
          return result;
        },
      };

      return result;
    },
  };
}
