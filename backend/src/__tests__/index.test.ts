import { describe, expect, test } from "bun:test";

import { parseRunMode } from "..";
import { createApp } from "../app";

describe("index.ts", () => {
  describe("parseRunMode", () => {
    test("selects migrate mode when the first argument is 'migrate'", () => {
      expect(parseRunMode(["bun", "/app/server", "migrate"])).toBe("migrate");
    });

    test("selects serve mode when no argument is given", () => {
      expect(parseRunMode(["bun", "/app/server"])).toBe("serve");
    });

    test("selects serve mode for any non-migrate argument", () => {
      expect(parseRunMode(["bun", "/app/server", "serve"])).toBe("serve");
      expect(parseRunMode(["bun", "/app/server", "migrations"])).toBe("serve");
      expect(parseRunMode(["bun", "/app/server", ""])).toBe("serve");
    });
  });

  describe("createApp", () => {
    const app = createApp();

    test("responds to the health check", async () => {
      const response = await app.handle(
        new Request("http://localhost/health"),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({ status: "ok" });
    });

    test("mounts the users module under /api", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/users/550e8400-e29b-41d4-a716-446655440000",
        ),
      );

      expect(response.status).toBe(401);
    });
  });
});
