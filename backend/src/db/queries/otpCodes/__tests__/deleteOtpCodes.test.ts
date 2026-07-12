import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent, testDb } from "../../../../tests/setup";
import { otpCodes } from "../../../schema";
import { createOtpCode, deleteOtpCodes } from "..";

describe("db/queries/otpCodes/deleteOtpCodes.ts", () => {
  let pedroOliveira: MockUser;
  let anaCostaAdmin: MockUser;

  beforeAll(async () => {
    await agent.seed({
      users: ["pedroOliveira", "anaCostaAdmin"],
    });

    pedroOliveira = agent.getFixture({ user: "pedroOliveira" });
    anaCostaAdmin = agent.getFixture({ user: "anaCostaAdmin" });
  });

  afterAll(async () => {
    await testDb.delete(otpCodes);
    await agent.clear();
  });

  describe("deleteOtpCodes", () => {
    test("deletes an OTP code by id and returns the deleted record", async () => {
      const otp = await createOtpCode({
        data: {
          phone: pedroOliveira.phone,
          code: "hashed-code-1",
          expiresAt: new Date(Date.now() + 300_000),
          requestToken: "ab".repeat(32),
        },
      });

      const deleted = await deleteOtpCodes({ where: { id: otp.id } });

      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.id).toBe(otp.id);
      expect(deleted[0]!.phone).toBe(pedroOliveira.phone);

      // Verify it no longer exists
      const remaining = await testDb.query.otpCodes.findFirst({
        where: eq(otpCodes.id, otp.id),
      });
      expect(remaining).toBeUndefined();
    });

    test("deletes an OTP code by phone number", async () => {
      const otp = await createOtpCode({
        data: {
          phone: pedroOliveira.phone,
          code: "hashed-code-2",
          expiresAt: new Date(Date.now() + 300_000),
          requestToken: "ab".repeat(32),
        },
      });

      const deleted = await deleteOtpCodes({
        where: { phone: pedroOliveira.phone },
      });

      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.id).toBe(otp.id);
    });

    test("returns empty array when no OTP matches the filter", async () => {
      const result = await deleteOtpCodes({
        where: { id: "00000000-0000-0000-0000-000000000000" },
      });

      expect(result).toEqual([]);
    });

    test("deletes only the matching OTP when multiple exist", async () => {
      const otpStudent = await createOtpCode({
        data: {
          phone: pedroOliveira.phone,
          code: "hashed-code-3",
          expiresAt: new Date(Date.now() + 300_000),
          requestToken: "ab".repeat(32),
        },
      });
      const otpAdmin = await createOtpCode({
        data: {
          phone: anaCostaAdmin.phone,
          code: "hashed-code-4",
          expiresAt: new Date(Date.now() + 300_000),
          requestToken: "cd".repeat(32),
        },
      });

      const deleted = await deleteOtpCodes({
        where: { phone: pedroOliveira.phone },
      });

      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.id).toBe(otpStudent.id);

      // Verify the other OTP still exists
      const remaining = await testDb.query.otpCodes.findFirst({
        where: eq(otpCodes.id, otpAdmin.id),
      });
      expect(remaining).toBeDefined();

      // Cleanup remaining OTP
      await deleteOtpCodes({ where: { id: otpAdmin.id } });
    });
  });

  describe("strict mode safety", () => {
    test("throws when and clause is empty", async () => {
      await expect(
        // @ts-expect-error Testing invalid where clause
        deleteOtpCodes({ where: { and: [] } }),
      ).rejects.toThrow("Strict mode");
    });

    test("throws when or clause is empty", async () => {
      await expect(
        // @ts-expect-error Testing invalid where clause
        deleteOtpCodes({ where: { or: [] } }),
      ).rejects.toThrow("Strict mode");
    });

    test("throws when nested clauses resolve to empty", async () => {
      await expect(
        deleteOtpCodes({
          // @ts-expect-error Testing invalid where clause
          where: { and: [{ or: [] }] },
        }),
      ).rejects.toThrow("Strict mode");
    });
  });
});
