import { describe, expect, it } from "bun:test";

import AsyncArg from "../..";
import { setupEnvCleanup } from "./utils";

describe("AsyncArg.string", () => {
  setupEnvCleanup();

  it("should return string from env", async () => {
    Bun.env["DB_HOST"] = "localhost";
    const arg = AsyncArg.string({
      description: "Database host",
      envName: "DB_HOST",
    });
    const result = await arg.fetch();
    expect(result).toBe("localhost");
  });

  it("should return default when env not set", async () => {
    const arg = AsyncArg.string({
      description: "Database host",
      envName: "UNSET_HOST",
      default: "127.0.0.1",
    });
    const result = await arg.fetch();
    expect(result).toBe("127.0.0.1");
  });

  it("should throw when env not set and no default", async () => {
    const arg = AsyncArg.string({
      description: "Database host",
      envName: "UNSET_HOST",
    });
    try {
      await arg.fetch();
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect((error as Error).message).toBe(
        "Failed to fetch UNSET_HOST (Database host)",
      );
    }
  });

  describe("minLength validation", () => {
    it("should pass when string meets minLength", async () => {
      Bun.env["SECRET_KEY"] = "this-is-a-long-enough-secret-key";
      const arg = AsyncArg.string({
        description: "Secret key",
        envName: "SECRET_KEY",
        minLength: 10,
      });
      const result = await arg.fetch();
      expect(result).toBe("this-is-a-long-enough-secret-key");
    });

    it("should fail when string is shorter than minLength", async () => {
      Bun.env["SECRET_KEY"] = "short";
      const arg = AsyncArg.string({
        description: "Secret key",
        envName: "SECRET_KEY",
        minLength: 32,
      });
      try {
        await arg.fetch();
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toBe(
          "Failed to fetch SECRET_KEY (Secret key): must be at least 32 characters",
        );
      }
    });
  });

  describe("maxLength validation", () => {
    it("should pass when string meets maxLength", async () => {
      Bun.env["SHORT_CODE"] = "ABC";
      const arg = AsyncArg.string({
        description: "Short code",
        envName: "SHORT_CODE",
        maxLength: 10,
      });
      const result = await arg.fetch();
      expect(result).toBe("ABC");
    });

    it("should fail when string exceeds maxLength", async () => {
      Bun.env["SHORT_CODE"] = "this-is-too-long";
      const arg = AsyncArg.string({
        description: "Short code",
        envName: "SHORT_CODE",
        maxLength: 5,
      });
      try {
        await arg.fetch();
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toBe(
          "Failed to fetch SHORT_CODE (Short code): must be at most 5 characters",
        );
      }
    });
  });

  describe("pattern validation", () => {
    it("should pass when string matches pattern", async () => {
      Bun.env["EMAIL"] = "user@example.com";
      const arg = AsyncArg.string({
        description: "Email address",
        envName: "EMAIL",
        pattern: /^[^@]+@[^@]+\.[^@]+$/,
      });
      const result = await arg.fetch();
      expect(result).toBe("user@example.com");
    });

    it("should fail when string does not match pattern", async () => {
      Bun.env["EMAIL"] = "invalid-email";
      const arg = AsyncArg.string({
        description: "Email address",
        envName: "EMAIL",
        pattern: /^[^@]+@[^@]+\.[^@]+$/,
      });
      try {
        await arg.fetch();
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toContain(
          "Failed to fetch EMAIL (Email address): must match pattern",
        );
      }
    });
  });

  describe("combined validations", () => {
    it("should pass when all validations pass", async () => {
      Bun.env["API_KEY"] = "key-12345678";
      const arg = AsyncArg.string({
        description: "API key",
        envName: "API_KEY",
        minLength: 5,
        maxLength: 20,
        pattern: /^key-/,
      });
      const result = await arg.fetch();
      expect(result).toBe("key-12345678");
    });

    it("should fail on first validation that fails (minLength)", async () => {
      Bun.env["API_KEY"] = "key";
      const arg = AsyncArg.string({
        description: "API key",
        envName: "API_KEY",
        minLength: 5,
        maxLength: 20,
        pattern: /^key-/,
      });
      try {
        await arg.fetch();
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toBe(
          "Failed to fetch API_KEY (API key): must be at least 5 characters",
        );
      }
    });
  });
});
