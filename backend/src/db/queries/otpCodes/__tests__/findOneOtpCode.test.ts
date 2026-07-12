import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { NotFoundError } from "../../../../shared/utils/errors";
import type { MockOtpCode } from "../../../../tests/mock-data/otpCodes/types";
import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent } from "../../../../tests/setup";
import { findOneOtpCode } from "..";

describe("db/queries/otpCodes/findOneOtpCode.ts", () => {
  let pedroOliveira: MockUser;
  let otpA: MockOtpCode;

  beforeAll(async () => {
    await agent.seed({
      users: ["pedroOliveira"],
      otpCodes: ["otpCodeA"],
    });

    pedroOliveira = agent.getFixture({ user: "pedroOliveira" });
    otpA = agent.getFixture({ otpCode: "otpCodeA" });
  });

  afterAll(async () => {
    await agent.clear();
  });

  describe("require", () => {
    test("returns OTP code when found", async () => {
      const result = await findOneOtpCode({
        where: { id: otpA.id },
      });

      expect(result.id).toBe(otpA.id);
    });

    test("throws NotFoundError when not found (default)", async () => {
      await expect(
        findOneOtpCode({
          where: { id: "00000000-0000-0000-0000-000000000000" },
        }),
      ).rejects.toThrow(NotFoundError);
    });

    test("returns null when not found with require: false", async () => {
      const result = await findOneOtpCode({
        where: { id: "00000000-0000-0000-0000-000000000000" },
        require: false,
      });

      expect(result).toBeNull();
    });
  });

  describe("where", () => {
    test("finds OTP code by id", async () => {
      const result = await findOneOtpCode({
        where: { id: otpA.id },
      });

      expect(result.id).toBe(otpA.id);
    });

    test("finds OTP code by phone", async () => {
      const result = await findOneOtpCode({
        where: { phone: pedroOliveira.phone },
      });

      expect(result.id).toBe(otpA.id);
      expect(result.phone).toBe(pedroOliveira.phone);
    });

    test("finds OTP code by expiresAt with lte operator", async () => {
      const result = await findOneOtpCode({
        where: {
          expiresAt: {
            value: new Date("2099-12-31T23:59:59.999Z"),
            operator: "lte",
          },
          id: otpA.id,
        },
      });

      expect(result.id).toBe(otpA.id);
    });
  });
});
