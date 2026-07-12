import { Secret } from "@transcend-io/secret-value";
import { describe, expect, it } from "bun:test";

import AsyncArg from "../..";
import { setupEnvCleanup } from "./utils";

describe("sensitive option", () => {
  setupEnvCleanup();

  it("should wrap value in Secret when sensitive is true", async () => {
    Bun.env["API_KEY"] = "secret-123";
    const arg = AsyncArg.string({
      description: "API Key",
      envName: "API_KEY",
      sensitive: true,
    });
    const result = await arg.fetch();
    expect(result).toBeInstanceOf(Secret);
    expect(result.release()).toBe("secret-123");
  });

  it("should return plain value when sensitive is false", async () => {
    Bun.env["PORT"] = "3000";
    const arg = AsyncArg.number({
      description: "Port",
      envName: "PORT",
      sensitive: false,
    });
    const result = await arg.fetch();
    expect(result).toBe(3000);
    expect(result).not.toBeInstanceOf(Secret);
  });

  it("should return plain value when sensitive is not specified", async () => {
    Bun.env["PORT"] = "3000";
    const arg = AsyncArg.number({
      description: "Port",
      envName: "PORT",
    });
    const result = await arg.fetch();
    expect(result).toBe(3000);
    expect(result).not.toBeInstanceOf(Secret);
  });

  it("should redact when converting sensitive value to string", async () => {
    Bun.env["API_KEY"] = "secret-123";
    const arg = AsyncArg.string({
      description: "API Key",
      envName: "API_KEY",
      sensitive: true,
    });
    const result = await arg.fetch();
    expect(String(result)).toBe("[redacted]");
  });

  it("should work with default value when sensitive", async () => {
    const arg = AsyncArg.string({
      description: "API Key",
      envName: "UNSET_KEY",
      default: "default-secret",
      sensitive: true,
    });
    const result = await arg.fetch();
    expect(result).toBeInstanceOf(Secret);
    expect(result.release()).toBe("default-secret");
  });
});
