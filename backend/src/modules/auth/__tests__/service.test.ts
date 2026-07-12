import { hashSha256 } from "@blueprint/crypto-utils";
import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";

import {
  createOtpCode,
  createUsers,
  deleteOtpCodes,
  deleteUsers,
  findOneOtpCode,
  findOneUser,
  updateOtpCodes,
} from "../../../db";
import { UnauthorizedError } from "../../../shared/utils/errors";
import { generateAuthTokens } from "../../../shared/utils/jwt";
import type { MockUser } from "../../../tests/mock-data/users/types";
import { agent } from "../../../tests/setup";
import { refreshAuthTokens, requestOtp, verifyOtp } from "../service";

describe("auth/service.ts", () => {
  let testUser: MockUser;

  beforeAll(async () => {
    await agent.seed({ users: ["carlosSilvaAB"] });
    testUser = agent.getFixture({ user: "carlosSilvaAB" });
  });

  afterAll(async () => {
    await agent.clear();
  });

  describe("refreshAuthTokens", () => {
    test("returns new tokens for valid refresh token", async () => {
      const { refreshToken } = await generateAuthTokens({
        userId: testUser.id,
      });

      const result = await refreshAuthTokens(refreshToken);

      expect(result.accessToken).toBeString();
      expect(result.refreshToken).toBeString();
      expect(result.accessTokenExpiresIn).toBeNumber();
      expect(result.refreshTokenExpiresIn).toBeNumber();
      expect(result.accessToken).not.toBe(refreshToken);
    });

    test("throws UnauthorizedError for invalid refresh token", async () => {
      const invalidToken = "invalid.refresh.token";

      await expect(refreshAuthTokens(invalidToken)).rejects.toThrow(
        UnauthorizedError,
      );
    });

    test("throws UnauthorizedError when user not found", async () => {
      const nonExistentUserId = "00000000-0000-0000-0000-000000000000";
      const { refreshToken } = await generateAuthTokens({
        userId: nonExistentUserId,
      });

      await expect(refreshAuthTokens(refreshToken)).rejects.toThrow(
        UnauthorizedError,
      );
    });
  });

  describe("requestOtp", () => {
    /** Phones created by requestOtp tests — cleaned up in afterAll. */
    const createdPhones: string[] = [];

    afterAll(async () => {
      await Promise.all(
        createdPhones.map(async (phone) => {
          await deleteOtpCodes({ where: { phone } }).catch(() => {});
          await deleteUsers({ where: { phone } }).catch(() => {});
        }),
      );
    });

    test("returns a 64-char hex requestToken in the response", async () => {
      const phone = "+5511999999999";
      createdPhones.push(phone);

      const result = await requestOtp({ phone });

      expect(result.success).toBe(true);
      expect(result.expiresIn).toBeGreaterThan(0);
      expect(result.requestToken).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/.test(result.requestToken)).toBe(true);
    });

    test("delivers the OTP code via the OTP integration before persisting", async () => {
      const phone = "+5511999999990";
      createdPhones.push(phone);

      const logSpy = spyOn(console, "log").mockImplementation(() => {});

      await requestOtp({ phone });

      const stubCall = logSpy.mock.calls.find(([message]) =>
        String(message).startsWith("[OTP stub]"),
      );

      expect(stubCall).toBeDefined();
      expect(String(stubCall![0])).toContain(phone);
      expect(String(stubCall![0])).toMatch(/\d{6}/);

      logSpy.mockRestore();
    });

    describe("when MOCK_OTP is enabled", () => {
      let env: typeof import("../../../config").env;

      beforeAll(async () => {
        env = (await import("../../../config")).env;
        env.MOCK_OTP = true;
      });

      afterAll(() => {
        env.MOCK_OTP = false;
      });

      test("skips OTP delivery and stores the hash of the fixed '000000' code", async () => {
        const phone = "+5511999999991";
        createdPhones.push(phone);

        const logSpy = spyOn(console, "log").mockImplementation(() => {});

        const result = await requestOtp({ phone });

        const stubCall = logSpy.mock.calls.find(([message]) =>
          String(message).startsWith("[OTP stub]"),
        );
        expect(stubCall).toBeUndefined();

        expect(result.success).toBe(true);
        expect(result.requestToken).toHaveLength(64);

        const otp = await findOneOtpCode({ where: { phone }, require: true });

        // SHA-256("000000") — what `requestOtp` should have stored.
        const expectedHash =
          "91b4d142823f7d20c5f08df69122de43f35f057a988d9619f6d3138485c9a203";
        expect(otp.code).toBe(expectedHash);

        logSpy.mockRestore();
      });
    });
  });

  describe("verifyOtp", () => {
    /** Known plaintext values for direct DB insertion. */
    const KNOWN_CODE = "999888";
    const KNOWN_REQUEST_TOKEN = "ab".repeat(32);

    /** Phones used in verifyOtp tests — cleaned up in afterAll. */
    const createdPhones: string[] = [];

    afterAll(async () => {
      await Promise.all(
        createdPhones.map(async (phone) => {
          await deleteOtpCodes({ where: { phone } }).catch(() => {});
          await deleteUsers({ where: { phone } }).catch(() => {});
        }),
      );
    });

    /**
     * Seeds a user and a valid OTP for the given phone with known code/token hashes.
     * @param phone - The phone number to seed.
     */
    async function seedOtpForPhone(phone: string): Promise<void> {
      createdPhones.push(phone);

      const existing = await findOneUser({ where: { phone }, require: false });
      if (!existing) {
        await createUsers({
          data: [
            {
              phone,
              firstName: "Test",
              lastName: "User",
              phoneVerified: false,
              role: "user",
            },
          ],
        });
      }

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

    test("succeeds when correct requestToken and code are provided for existing user", async () => {
      const phone = "+5511999999997";
      await seedOtpForPhone(phone);

      const result = await verifyOtp({
        phone,
        code: KNOWN_CODE,
        requestToken: KNOWN_REQUEST_TOKEN,
      });

      expect(result.user).toBeDefined();
      expect(result.user!.id).toBeDefined();
      expect(result.accessToken).toBeString();
      expect(result.refreshToken).toBeString();
      expect(result.accessTokenExpiresIn).toBeNumber();
      expect(result.refreshTokenExpiresIn).toBeNumber();
      expect(result.registrationToken).toBeNull();
    });

    test("issues a registration token when no user exists for the phone", async () => {
      const phone = "+5511999999998";
      createdPhones.push(phone);

      await createOtpCode({
        data: {
          phone,
          code: hashSha256(KNOWN_CODE),
          requestToken: hashSha256(KNOWN_REQUEST_TOKEN),
          expiresAt: new Date(Date.now() + 300_000),
        },
      });

      const result = await verifyOtp({
        phone,
        code: KNOWN_CODE,
        requestToken: KNOWN_REQUEST_TOKEN,
      });

      expect(result).toEqual({
        user: null,
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresIn: null,
        refreshTokenExpiresIn: null,
        registrationToken: expect.any(String),
      });
      expect(result.registrationToken!.length).toBeGreaterThan(0);
    });

    test("throws BadRequestError when wrong requestToken is provided", async () => {
      const phone = "+5511999999996";
      await seedOtpForPhone(phone);

      await expect(
        verifyOtp({
          phone,
          code: KNOWN_CODE,
          requestToken: "cd".repeat(32),
        }),
      ).rejects.toThrow("Invalid request token.");
    });

    test("consumes an attempt when requestToken is wrong", async () => {
      const phone = "+5511999999995";
      await seedOtpForPhone(phone);

      await expect(
        verifyOtp({
          phone,
          code: KNOWN_CODE,
          requestToken: "ef".repeat(32),
        }),
      ).rejects.toThrow("Invalid request token.");

      const otpRecord = await findOneOtpCode({
        where: { phone },
        require: false,
      });

      expect(otpRecord).not.toBeNull();
      expect(otpRecord!.attempts).toBe(1);

      // Restore attempts so afterAll cleanup still works deterministically.
      await updateOtpCodes({ where: { phone }, values: { attempts: 0 } });
    });
  });
});
