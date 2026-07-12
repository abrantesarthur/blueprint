import { describe, expect, it } from "bun:test";

import AsyncArg from "../..";
import { setupEnvCleanup } from "./utils";

describe("AsyncArg.number", () => {
  setupEnvCleanup();

  it("should parse number from env", async () => {
    Bun.env["PORT"] = "3000";
    const arg = AsyncArg.number({
      description: "Port",
      envName: "PORT",
    });
    const result = await arg.fetch();
    expect(result).toBe(3000);
  });

  it("should return default when env not set", async () => {
    const arg = AsyncArg.number({
      description: "Port",
      envName: "UNSET_PORT",
      default: 8080,
    });
    const result = await arg.fetch();
    expect(result).toBe(8080);
  });

  it("should throw when env not set and no default", async () => {
    const arg = AsyncArg.number({
      description: "Port",
      envName: "UNSET_PORT",
    });
    try {
      await arg.fetch();
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect((error as Error).message).toBe(
        "Failed to fetch UNSET_PORT (Port)",
      );
    }
  });

  it("should throw when env value is not a valid number", async () => {
    Bun.env["PORT"] = "not-a-number";
    const arg = AsyncArg.number({
      description: "Port",
      envName: "PORT",
    });
    try {
      await arg.fetch();
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect((error as Error).message).toBe(
        'Failed to fetch PORT (Port): Cannot parse "not-a-number" as number',
      );
    }
  });

  describe("min validation", () => {
    it("should pass when number meets min", async () => {
      Bun.env["PORT"] = "3000";
      const arg = AsyncArg.number({
        description: "Port",
        envName: "PORT",
        min: 1000,
      });
      const result = await arg.fetch();
      expect(result).toBe(3000);
    });

    it("should pass when number equals min (boundary)", async () => {
      Bun.env["PORT"] = "1000";
      const arg = AsyncArg.number({
        description: "Port",
        envName: "PORT",
        min: 1000,
      });
      const result = await arg.fetch();
      expect(result).toBe(1000);
    });

    it("should fail when number is less than min", async () => {
      Bun.env["PORT"] = "80";
      const arg = AsyncArg.number({
        description: "Port",
        envName: "PORT",
        min: 1000,
      });
      try {
        await arg.fetch();
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toBe(
          "Failed to fetch PORT (Port): must be at least 1000",
        );
      }
    });
  });

  describe("max validation", () => {
    it("should pass when number meets max", async () => {
      Bun.env["PORT"] = "3000";
      const arg = AsyncArg.number({
        description: "Port",
        envName: "PORT",
        max: 65535,
      });
      const result = await arg.fetch();
      expect(result).toBe(3000);
    });

    it("should pass when number equals max (boundary)", async () => {
      Bun.env["PORT"] = "65535";
      const arg = AsyncArg.number({
        description: "Port",
        envName: "PORT",
        max: 65535,
      });
      const result = await arg.fetch();
      expect(result).toBe(65535);
    });

    it("should fail when number exceeds max", async () => {
      Bun.env["PORT"] = "70000";
      const arg = AsyncArg.number({
        description: "Port",
        envName: "PORT",
        max: 65535,
      });
      try {
        await arg.fetch();
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toBe(
          "Failed to fetch PORT (Port): must be at most 65535",
        );
      }
    });
  });

  describe("combined min/max validation", () => {
    it("should pass when number is within range", async () => {
      Bun.env["PORT"] = "3000";
      const arg = AsyncArg.number({
        description: "Port",
        envName: "PORT",
        min: 1000,
        max: 65535,
      });
      const result = await arg.fetch();
      expect(result).toBe(3000);
    });

    it("should fail on min before checking max", async () => {
      Bun.env["PORT"] = "500";
      const arg = AsyncArg.number({
        description: "Port",
        envName: "PORT",
        min: 1000,
        max: 65535,
      });
      try {
        await arg.fetch();
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toBe(
          "Failed to fetch PORT (Port): must be at least 1000",
        );
      }
    });

    it("should fail on max when min passes", async () => {
      Bun.env["PORT"] = "70000";
      const arg = AsyncArg.number({
        description: "Port",
        envName: "PORT",
        min: 1000,
        max: 65535,
      });
      try {
        await arg.fetch();
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toBe(
          "Failed to fetch PORT (Port): must be at most 65535",
        );
      }
    });
  });
});
