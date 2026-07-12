import { describe, expect, test } from "bun:test";

import { assertMockOtpNotInProduction, sslModeRequiresTls } from "../loadEnv";

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

  describe("assertMockOtpNotInProduction", () => {
    test("throws when the mock is enabled in production", () => {
      expect(() =>
        assertMockOtpNotInProduction({
          mockEnabled: true,
          runtimeEnvironment: "production",
        }),
      ).toThrow(/MOCK_OTP must not be enabled/);
    });

    test("allows the mock in non-production environments", () => {
      for (const runtimeEnvironment of ["development", "test", "staging"]) {
        expect(() =>
          assertMockOtpNotInProduction({
            mockEnabled: true,
            runtimeEnvironment,
          }),
        ).not.toThrow();
      }
    });

    test("allows production when the mock is disabled", () => {
      expect(() =>
        assertMockOtpNotInProduction({
          mockEnabled: false,
          runtimeEnvironment: "production",
        }),
      ).not.toThrow();
    });
  });
});
