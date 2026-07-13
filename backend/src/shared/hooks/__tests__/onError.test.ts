import { afterAll, afterEach, describe, expect, spyOn, test } from "bun:test";

import { logger } from "../../logger";
import { NotFoundError } from "../../utils/errors";
import { onError } from "../onError";

/**
 * Builds a minimal onError context for a GET request to the given path.
 * @param error - The error the hook should render.
 * @param path - The request path.
 * @returns The context object expected by the hook.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createContext(error: unknown, path: string = "/api/users") {
  const set: {
    /** HTTP status code, mutated by the hook. */
    status?: number | string;
    /** Response headers. */
    headers: Record<string, string | number>;
  } = { headers: {} };

  return { error, request: new Request(`http://localhost${path}`), set };
}

describe("shared/hooks/onError.ts", () => {
  const warnSpy = spyOn(logger, "warn");
  const errorSpy = spyOn(logger, "error");

  afterEach(() => {
    warnSpy.mockClear();
    errorSpy.mockClear();
  });

  afterAll(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe("onError", () => {
    test("renders AppErrors unchanged and logs them at warn", () => {
      const ctx = createContext(new NotFoundError("User not found"));

      const body = onError(ctx);

      expect(ctx.set.status).toBe(404);
      expect(body).toEqual({ error: "User not found", code: "NOT_FOUND" });
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        { method: "GET", path: "/api/users", status: 404, code: "NOT_FOUND" },
        "User not found",
      );
    });

    test("renders unexpected errors unchanged and logs them at error with err", () => {
      const thrown = new Error("db exploded");
      const ctx = createContext(thrown, "/api/users/123");

      const body = onError(ctx);

      expect(ctx.set.status).toBe(500);
      expect(body).toEqual({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      });
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        {
          method: "GET",
          path: "/api/users/123",
          status: 500,
          code: "INTERNAL_ERROR",
          err: thrown,
        },
        "Internal server error",
      );
    });
  });
});
