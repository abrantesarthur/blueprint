import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent, testDb } from "../../../../tests/setup";
import { otpCodes } from "../../../schema";
import { withTransaction } from "../../../utils";
import { createOtpCode, deleteOtpCodes, incrementOtpAttempts } from "..";

describe("db/queries/otpCodes/incrementOtpAttempts.ts", () => {
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

  describe("incrementOtpAttempts", () => {
    test("successfully increments attempts when under max limit", async () => {
      const otp = await createOtpCode({
        data: {
          phone: pedroOliveira.phone,
          code: "hashed-code-1",
          expiresAt: new Date(Date.now() + 300_000),
          attempts: 2,
          requestToken: "ab".repeat(32),
        },
      });

      const updated = await incrementOtpAttempts({
        otpId: otp.id,
        maxAttempts: 5,
      });

      expect(updated).toHaveLength(1);
      expect(updated[0]!.id).toBe(otp.id);
      expect(updated[0]!.attempts).toBe(3);

      await deleteOtpCodes({ where: { id: otp.id } });
    });

    test("returns empty array when at max attempts", async () => {
      const otp = await createOtpCode({
        data: {
          phone: pedroOliveira.phone,
          code: "hashed-code-2",
          expiresAt: new Date(Date.now() + 300_000),
          attempts: 5,
          requestToken: "ab".repeat(32),
        },
      });

      const updated = await incrementOtpAttempts({
        otpId: otp.id,
        maxAttempts: 5,
      });

      expect(updated).toEqual([]);

      // Verify the original record is unchanged
      const [unchanged] = await testDb
        .select()
        .from(otpCodes)
        .where(eq(otpCodes.id, otp.id));
      expect(unchanged!.attempts).toBe(5);

      await deleteOtpCodes({ where: { id: otp.id } });
    });

    test("returns empty array for non-existent OTP ID", async () => {
      const result = await incrementOtpAttempts({
        otpId: "00000000-0000-0000-0000-000000000000",
        maxAttempts: 5,
      });

      expect(result).toEqual([]);
    });

    test("increments by exactly 1 each call", async () => {
      const otp = await createOtpCode({
        data: {
          phone: pedroOliveira.phone,
          code: "hashed-code-3",
          expiresAt: new Date(Date.now() + 300_000),
          attempts: 0,
          requestToken: "ab".repeat(32),
        },
      });

      const first = await incrementOtpAttempts({
        otpId: otp.id,
        maxAttempts: 3,
      });

      expect(first).toHaveLength(1);
      expect(first[0]!.attempts).toBe(1);

      const second = await incrementOtpAttempts({
        otpId: otp.id,
        maxAttempts: 3,
      });

      expect(second).toHaveLength(1);
      expect(second[0]!.attempts).toBe(2);

      await deleteOtpCodes({ where: { id: otp.id } });
    });

    test("works within a transaction", async () => {
      const otp = await createOtpCode({
        data: {
          phone: pedroOliveira.phone,
          code: "hashed-code-4",
          expiresAt: new Date(Date.now() + 300_000),
          attempts: 1,
          requestToken: "ab".repeat(32),
        },
      });

      const result = await withTransaction(async (tx) => {
        return await incrementOtpAttempts({
          otpId: otp.id,
          maxAttempts: 5,
          tx,
        });
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.attempts).toBe(2);

      // Verify the change persisted
      const [persisted] = await testDb
        .select()
        .from(otpCodes)
        .where(eq(otpCodes.id, otp.id));
      expect(persisted!.attempts).toBe(2);

      await deleteOtpCodes({ where: { id: otp.id } });
    });

    test("updates updatedAt timestamp when incrementing", async () => {
      const otp = await createOtpCode({
        data: {
          phone: pedroOliveira.phone,
          code: "hashed-code-5",
          expiresAt: new Date(Date.now() + 300_000),
          attempts: 0,
          requestToken: "ab".repeat(32),
        },
      });

      const originalUpdatedAt = otp.updatedAt;

      // Small delay to ensure timestamp changes
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      const updated = await incrementOtpAttempts({
        otpId: otp.id,
        maxAttempts: 5,
      });

      expect(updated).toHaveLength(1);
      expect(updated[0]!.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );

      await deleteOtpCodes({ where: { id: otp.id } });
    });

    test("does not increment when attempts equals maxAttempts - 1 but filter is at boundary", async () => {
      const otp = await createOtpCode({
        data: {
          phone: pedroOliveira.phone,
          code: "hashed-code-6",
          expiresAt: new Date(Date.now() + 300_000),
          attempts: 4,
          requestToken: "ab".repeat(32),
        },
      });

      // maxAttempts=5, attempts=4, so this should increment to 5
      const updated = await incrementOtpAttempts({
        otpId: otp.id,
        maxAttempts: 5,
      });

      expect(updated).toHaveLength(1);
      expect(updated[0]!.attempts).toBe(5);

      // Now maxAttempts=5, attempts=5, so this should not increment
      const notUpdated = await incrementOtpAttempts({
        otpId: otp.id,
        maxAttempts: 5,
      });

      expect(notUpdated).toEqual([]);

      await deleteOtpCodes({ where: { id: otp.id } });
    });

    test("increments from zero to one", async () => {
      const otp = await createOtpCode({
        data: {
          phone: pedroOliveira.phone,
          code: "hashed-code-7",
          expiresAt: new Date(Date.now() + 300_000),
          attempts: 0,
          requestToken: "ab".repeat(32),
        },
      });

      const updated = await incrementOtpAttempts({
        otpId: otp.id,
        maxAttempts: 1,
      });

      expect(updated).toHaveLength(1);
      expect(updated[0]!.attempts).toBe(1);

      await deleteOtpCodes({ where: { id: otp.id } });
    });
  });
});
