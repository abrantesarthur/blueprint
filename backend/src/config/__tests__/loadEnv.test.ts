import { describe, expect, test } from "bun:test";

import { sslModeRequiresTls } from "../loadEnv";

describe("config/loadEnv.ts", () => {
  describe("sslModeRequiresTls", () => {
    test("returns true for modes that mandate encryption", () => {
      for (const mode of ["require", "verify-ca", "verify-full"]) {
        expect(sslModeRequiresTls(mode)).toBe(true);
      }
    });

    test("returns false for modes that permit plaintext", () => {
      for (const mode of ["disable", "allow", "prefer"]) {
        expect(sslModeRequiresTls(mode)).toBe(false);
      }
    });

    test("normalizes casing and surrounding whitespace", () => {
      expect(sslModeRequiresTls("  REQUIRE ")).toBe(true);
      expect(sslModeRequiresTls("Verify-Full")).toBe(true);
      expect(sslModeRequiresTls(" Disable ")).toBe(false);
    });

    test("returns false for unrecognized modes", () => {
      expect(sslModeRequiresTls("")).toBe(false);
      expect(sslModeRequiresTls("bogus")).toBe(false);
    });
  });
});
