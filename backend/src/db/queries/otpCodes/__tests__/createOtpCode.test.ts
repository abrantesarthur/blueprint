import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { DbError } from "../../../../shared/utils/errors";
import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent, testDb } from "../../../../tests/setup";
import { otpCodes } from "../../../schema";
import { createOtpCode, deleteOtpCodes } from "..";

describe("db/queries/otpCodes/createOtpCode.ts", () => {
  let pedroOliveira: MockUser;

  beforeAll(async () => {
    await agent.seed({
      users: ["pedroOliveira"],
    });

    pedroOliveira = agent.getFixture({ user: "pedroOliveira" });
  });

  afterAll(async () => {
    await testDb.delete(otpCodes);
    await agent.clear();
  });

  describe("createOtpCode", () => {
    test("creates a new OTP code and returns the created record", async () => {
      const expiresAt = new Date(Date.now() + 300_000);
      const result = await createOtpCode({
        data: {
          phone: pedroOliveira.phone,
          code: "hashed-code-123",
          expiresAt,
          requestToken: "ab".repeat(32),
        },
      });

      expect(typeof result.id).toBe("string");
      expect(result.phone).toBe(pedroOliveira.phone);
      expect(result.code).toBe("hashed-code-123");
      expect(result.requestToken).toBe("ab".repeat(32));
      expect(result.expiresAt).toEqual(expiresAt);
      expect(result.attempts).toBe(0);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);

      await deleteOtpCodes({ where: { id: result.id } });
    });

    test("throws QueryError on duplicate phone number", async () => {
      const otp = await createOtpCode({
        data: {
          phone: pedroOliveira.phone,
          code: "hashed-code-dup-1",
          expiresAt: new Date(Date.now() + 300_000),
          requestToken: "ab".repeat(32),
        },
      });

      await expect(
        createOtpCode({
          data: {
            phone: pedroOliveira.phone,
            code: "hashed-code-dup-2",
            expiresAt: new Date(Date.now() + 300_000),
            requestToken: "ab".repeat(32),
          },
        }),
      ).rejects.toThrow(DbError);

      await deleteOtpCodes({ where: { id: otp.id } });
    });

    test("creates OTP code with custom attempts", async () => {
      const result = await createOtpCode({
        data: {
          phone: pedroOliveira.phone,
          code: "hashed-code-custom",
          expiresAt: new Date(Date.now() + 300_000),
          attempts: 3,
          requestToken: "ab".repeat(32),
        },
      });

      expect(result.attempts).toBe(3);

      await deleteOtpCodes({ where: { id: result.id } });
    });

    test("creates OTP code with minimal required fields", async () => {
      const result = await createOtpCode({
        data: {
          phone: pedroOliveira.phone,
          code: "hashed-code-minimal",
          expiresAt: new Date(Date.now() + 300_000),
          requestToken: "ab".repeat(32),
        },
      });

      expect(result.attempts).toBe(0);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);

      await deleteOtpCodes({ where: { id: result.id } });
    });

    test("upserts OTP code on phone conflict with onConflictDoUpdate", async () => {
      const original = await createOtpCode({
        data: {
          phone: pedroOliveira.phone,
          code: "hashed-code-original",
          expiresAt: new Date(Date.now() + 300_000),
          attempts: 2,
          requestToken: "ab".repeat(32),
        },
      });

      const newCode = "hashed-code-upserted";
      const newExpiresAt = new Date(Date.now() + 600_000);
      const newCreatedAt = new Date();
      const newRequestToken = "cd".repeat(32);

      const upserted = await createOtpCode({
        data: {
          phone: pedroOliveira.phone,
          code: newCode,
          expiresAt: newExpiresAt,
          requestToken: newRequestToken,
        },
        onConflictDoUpdate: {
          target: "phone",
          set: {
            code: newCode,
            expiresAt: newExpiresAt,
            requestToken: newRequestToken,
            attempts: 0,
            createdAt: newCreatedAt,
          },
        },
      });

      expect(upserted.id).toBe(original.id);
      expect(upserted.code).toBe(newCode);
      expect(upserted.expiresAt).toEqual(newExpiresAt);
      expect(upserted.requestToken).toBe(newRequestToken);
      expect(upserted.attempts).toBe(0);
      expect(upserted.createdAt).toEqual(newCreatedAt);

      await deleteOtpCodes({ where: { id: upserted.id } });
    });

    test("inserts normally when onConflictDoUpdate is provided but no conflict exists", async () => {
      const expiresAt = new Date(Date.now() + 300_000);

      const result = await createOtpCode({
        data: {
          phone: pedroOliveira.phone,
          code: "hashed-code-no-conflict",
          expiresAt,
          requestToken: "ab".repeat(32),
        },
        onConflictDoUpdate: {
          target: "phone",
          set: {
            code: "should-not-be-used",
            expiresAt: new Date(Date.now() + 999_000),
            requestToken: "cd".repeat(32),
            attempts: 5,
          },
        },
      });

      expect(typeof result.id).toBe("string");
      expect(result.phone).toBe(pedroOliveira.phone);
      expect(result.code).toBe("hashed-code-no-conflict");
      expect(result.expiresAt).toEqual(expiresAt);
      expect(result.attempts).toBe(0);

      await deleteOtpCodes({ where: { id: result.id } });
    });
  });
});
