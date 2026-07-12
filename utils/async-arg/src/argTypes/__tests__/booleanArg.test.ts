import { describe, expect, it } from "bun:test";

import AsyncArg from "../..";
import { setupEnvCleanup } from "./utils";

describe("AsyncArg.boolean", () => {
  setupEnvCleanup();

  it("should parse 'true' as true", async () => {
    Bun.env["DEBUG"] = "true";
    const arg = AsyncArg.boolean({
      description: "Debug mode",
      envName: "DEBUG",
    });
    expect(await arg.fetch()).toBe(true);
  });

  it("should parse 'TRUE' as true (case-insensitive)", async () => {
    Bun.env["DEBUG"] = "TRUE";
    const arg = AsyncArg.boolean({
      description: "Debug mode",
      envName: "DEBUG",
    });
    expect(await arg.fetch()).toBe(true);
  });

  it("should parse 'false' as false", async () => {
    Bun.env["DEBUG"] = "false";
    const arg = AsyncArg.boolean({
      description: "Debug mode",
      envName: "DEBUG",
    });
    expect(await arg.fetch()).toBe(false);
  });

  it("should parse 'FALSE' as false (case-insensitive)", async () => {
    Bun.env["DEBUG"] = "FALSE";
    const arg = AsyncArg.boolean({
      description: "Debug mode",
      envName: "DEBUG",
    });
    expect(await arg.fetch()).toBe(false);
  });

  it("should throw for invalid boolean string", async () => {
    Bun.env["DEBUG"] = "yes";
    const arg = AsyncArg.boolean({
      description: "Debug mode",
      envName: "DEBUG",
    });
    try {
      await arg.fetch();
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect((error as Error).message).toBe(
        'Failed to fetch DEBUG (Debug mode): Cannot parse "yes" as boolean',
      );
    }
  });

  it("should return default when env not set", async () => {
    const arg = AsyncArg.boolean({
      description: "Debug mode",
      envName: "UNSET_DEBUG",
      default: false,
    });
    expect(await arg.fetch()).toBe(false);
  });
});
