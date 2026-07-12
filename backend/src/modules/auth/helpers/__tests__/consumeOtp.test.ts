import { hashSha256 } from "@blueprint/crypto-utils";
import { afterAll, describe, expect, test } from "bun:test";

import {
  createOtpCode,
  deleteOtpCodes,
  findOneOtpCode,
  updateOtpCodes,
} from "../../../../db";
import { consumeOtp } from "../consumeOtp";

describe("modules/auth/helpers/consumeOtp.ts", () => {
  describe("consumeOtp", () => {
    const KNOWN_CODE = "424242";
    const KNOWN_REQUEST_TOKEN = "12".repeat(32);

    /** Phones used in these tests — cleaned up in afterAll. */
    const createdPhones: string[] = [];

    afterAll(async () => {
      await Promise.all(
        createdPhones.map((phone) =>
          deleteOtpCodes({ where: { phone } }).catch(() => {}),
        ),
      );
    });

    /**
     * Seeds an OTP record for a phone with known plaintext code and token.
     * @param phone - The phone number to seed.
     */
    async function seedOtp(phone: string): Promise<void> {
      createdPhones.push(phone);
      await createOtpCode({
        data: {
          phone,
          code: hashSha256(KNOWN_CODE),
          requestToken: hashSha256(KNOWN_REQUEST_TOKEN),
          expiresAt: new Date(Date.now() + 300_000),
        },
        onConflictDoUpdate: {
          target: "phone",
          set: {
            code: hashSha256(KNOWN_CODE),
            requestToken: hashSha256(KNOWN_REQUEST_TOKEN),
            expiresAt: new Date(Date.now() + 300_000),
            attempts: 0,
          },
        },
      });
    }

    test("deletes the OTP record on successful validation", async () => {
      const phone = "+5511999000001";
      await seedOtp(phone);

      await consumeOtp({
        phone,
        code: KNOWN_CODE,
        requestToken: KNOWN_REQUEST_TOKEN,
      });

      const otp = await findOneOtpCode({ where: { phone }, require: false });
      expect(otp).toBeNull();
    });

    test("throws BadRequestError(EXPIRED_OTP) when no active OTP exists", async () => {
      const phone = "+5511999000002";

      await expect(
        consumeOtp({
          phone,
          code: KNOWN_CODE,
          requestToken: KNOWN_REQUEST_TOKEN,
        }),
      ).rejects.toThrow("No valid OTP found. Please request a new code.");
    });

    test("throws BadRequestError(MAX_OTP_ATTEMPTS) when attempts exhausted", async () => {
      const phone = "+5511999000003";
      await seedOtp(phone);

      // Force attempts to the max; tryIncrementOtpAttempts will reject the next try.
      await updateOtpCodes({
        where: { phone },
        values: { attempts: 3 },
      });

      await expect(
        consumeOtp({
          phone,
          code: KNOWN_CODE,
          requestToken: KNOWN_REQUEST_TOKEN,
        }),
      ).rejects.toThrow(
        "Maximum verification attempts exceeded. Please request a new code.",
      );
    });

    test("throws BadRequestError(INVALID_REQUEST_TOKEN) when token is wrong", async () => {
      const phone = "+5511999000004";
      await seedOtp(phone);

      await expect(
        consumeOtp({
          phone,
          code: KNOWN_CODE,
          requestToken: "fe".repeat(32),
        }),
      ).rejects.toThrow("Invalid request token.");
    });

    test("throws BadRequestError(INVALID_OTP) when code is wrong, and consumes an attempt", async () => {
      const phone = "+5511999000005";
      await seedOtp(phone);

      await expect(
        consumeOtp({
          phone,
          code: "111111",
          requestToken: KNOWN_REQUEST_TOKEN,
        }),
      ).rejects.toThrow("Invalid verification code.");

      const otp = await findOneOtpCode({ where: { phone }, require: false });
      expect(otp).not.toBeNull();
      expect(otp!.attempts).toBe(1);
    });
  });
});
