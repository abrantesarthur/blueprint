import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { env } from "../../../config";
import { sendOtp } from "..";

describe("integrations/otp/index.ts", () => {
  describe("sendOtp", () => {
    const originalRuntimeEnvironment = env.RUNTIME_ENVIRONMENT;

    afterEach(() => {
      env.RUNTIME_ENVIRONMENT = originalRuntimeEnvironment;
    });

    test("logs the code with the [OTP stub] prefix outside production", async () => {
      const logSpy = spyOn(console, "log").mockImplementation(() => {});

      await sendOtp({ phone: "+5511999990000", code: "123456" });

      expect(logSpy).toHaveBeenCalledWith(
        "[OTP stub] Verification code for +5511999990000: 123456",
      );

      logSpy.mockRestore();
    });

    test("throws a not-configured error in production", async () => {
      env.RUNTIME_ENVIRONMENT = "production";

      await expect(
        sendOtp({ phone: "+5511999990000", code: "123456" }),
      ).rejects.toThrow(
        "OTP delivery is not configured — plug in your provider (email/SMS).",
      );
    });
  });
});
