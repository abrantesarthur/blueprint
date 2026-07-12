import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import type { MockUser } from "../../../../tests/mock-data/users/types";
import { agent, testDb } from "../../../../tests/setup";
import { otpCodes } from "../../../schema";
import { createOtpCode, deleteOtpCodes, updateOtpCodes } from "..";

describe("db/queries/otpCodes/updateOtpCodes.ts", () => {
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

  describe("updateOtpCodes", () => {
    describe("updating by id", () => {
      test("updates attempts field and returns updated record", async () => {
        const otp = await createOtpCode({
          data: {
            phone: pedroOliveira.phone,
            code: "hashed-code-1",
            expiresAt: new Date(Date.now() + 300_000),
            requestToken: "ab".repeat(32),
          },
        });

        const updated = await updateOtpCodes({
          where: { id: otp.id },
          values: { attempts: 3 },
        });

        expect(updated).toHaveLength(1);
        expect(updated[0]!.id).toBe(otp.id);
        expect(updated[0]!.attempts).toBe(3);

        await deleteOtpCodes({ where: { id: otp.id } });
      });

      test("updates code field and returns updated record", async () => {
        const otp = await createOtpCode({
          data: {
            phone: pedroOliveira.phone,
            code: "hashed-code-2",
            expiresAt: new Date(Date.now() + 300_000),
            requestToken: "ab".repeat(32),
          },
        });

        const updated = await updateOtpCodes({
          where: { id: otp.id },
          values: { code: "new-hashed-code" },
        });

        expect(updated).toHaveLength(1);
        expect(updated[0]!.code).toBe("new-hashed-code");

        await deleteOtpCodes({ where: { id: otp.id } });
      });

      test("updates expiresAt field and returns updated record", async () => {
        const otp = await createOtpCode({
          data: {
            phone: pedroOliveira.phone,
            code: "hashed-code-3",
            expiresAt: new Date(Date.now() + 300_000),
            requestToken: "ab".repeat(32),
          },
        });
        const newExpiry = new Date(Date.now() + 600_000);

        const updated = await updateOtpCodes({
          where: { id: otp.id },
          values: { expiresAt: newExpiry },
        });

        expect(updated).toHaveLength(1);
        expect(updated[0]!.expiresAt).toEqual(newExpiry);

        await deleteOtpCodes({ where: { id: otp.id } });
      });

      test("updates multiple fields at once", async () => {
        const otp = await createOtpCode({
          data: {
            phone: pedroOliveira.phone,
            code: "hashed-code-4",
            expiresAt: new Date(Date.now() + 300_000),
            requestToken: "ab".repeat(32),
          },
        });
        const newExpiry = new Date(Date.now() + 900_000);

        const updated = await updateOtpCodes({
          where: { id: otp.id },
          values: {
            attempts: 5,
            code: "multi-update-code",
            expiresAt: newExpiry,
          },
        });

        expect(updated).toHaveLength(1);
        expect(updated[0]!.attempts).toBe(5);
        expect(updated[0]!.code).toBe("multi-update-code");
        expect(updated[0]!.expiresAt).toEqual(newExpiry);

        await deleteOtpCodes({ where: { id: otp.id } });
      });
    });

    describe("updating by phone", () => {
      test("updates OTP matching phone filter", async () => {
        const otp = await createOtpCode({
          data: {
            phone: pedroOliveira.phone,
            code: "hashed-code-5",
            expiresAt: new Date(Date.now() + 300_000),
            requestToken: "ab".repeat(32),
          },
        });

        const updated = await updateOtpCodes({
          where: { phone: pedroOliveira.phone },
          values: { attempts: 2 },
        });

        expect(updated).toHaveLength(1);
        expect(updated[0]!.phone).toBe(pedroOliveira.phone);
        expect(updated[0]!.attempts).toBe(2);

        await deleteOtpCodes({ where: { id: otp.id } });
      });
    });

    describe("updating with explicit filter operators", () => {
      test("updates OTP codes where attempts < N (lt operator)", async () => {
        const otp = await createOtpCode({
          data: {
            phone: pedroOliveira.phone,
            code: "hashed-code-6",
            expiresAt: new Date(Date.now() + 300_000),
            attempts: 2,
            requestToken: "ab".repeat(32),
          },
        });

        const updated = await updateOtpCodes({
          where: {
            id: otp.id,
            attempts: { value: 5, operator: "lt" },
          },
          values: { code: "updated-under-limit" },
        });

        expect(updated).toHaveLength(1);
        expect(updated[0]!.code).toBe("updated-under-limit");

        await deleteOtpCodes({ where: { id: otp.id } });
      });

      test("does not update OTP codes where attempts >= N (lt operator, no match)", async () => {
        const otp = await createOtpCode({
          data: {
            phone: pedroOliveira.phone,
            code: "hashed-code-7",
            expiresAt: new Date(Date.now() + 300_000),
            attempts: 5,
            requestToken: "ab".repeat(32),
          },
        });

        const updated = await updateOtpCodes({
          where: {
            id: otp.id,
            attempts: { value: 5, operator: "lt" },
          },
          values: { code: "should-not-update" },
        });

        expect(updated).toEqual([]);

        // Verify the original record is unchanged
        const [unchanged] = await testDb
          .select()
          .from(otpCodes)
          .where(eq(otpCodes.id, otp.id));
        expect(unchanged!.code).toBe("hashed-code-7");

        await deleteOtpCodes({ where: { id: otp.id } });
      });
    });

    describe("edge cases", () => {
      test("returns empty array when no OTP matches the filter", async () => {
        const result = await updateOtpCodes({
          where: { id: "00000000-0000-0000-0000-000000000000" },
          values: { attempts: 1 },
        });

        expect(result).toEqual([]);
      });

      test("returns empty array for non-existent phone", async () => {
        const result = await updateOtpCodes({
          where: { phone: "+5511999999999" },
          values: { attempts: 1 },
        });

        expect(result).toEqual([]);
      });
    });

    describe("bulk updates", () => {
      test("updates multiple OTP codes matching OR filter", async () => {
        const otpStudent = await createOtpCode({
          data: {
            phone: pedroOliveira.phone,
            code: "hashed-bulk-1",
            expiresAt: new Date(Date.now() + 300_000),
            requestToken: "ab".repeat(32),
          },
        });
        const otpAdmin = await createOtpCode({
          data: {
            phone: anaCostaAdmin.phone,
            code: "hashed-bulk-2",
            expiresAt: new Date(Date.now() + 300_000),
            requestToken: "cd".repeat(32),
          },
        });

        const updated = await updateOtpCodes({
          where: {
            or: [{ id: otpStudent.id }, { id: otpAdmin.id }],
          },
          values: { attempts: 4 },
        });

        expect(updated).toHaveLength(2);
        expect(updated.map((o) => o.id).sort()).toEqual(
          [otpStudent.id, otpAdmin.id].sort(),
        );
        expect(updated.every((o) => o.attempts === 4)).toBe(true);

        await Promise.all([
          deleteOtpCodes({ where: { id: otpStudent.id } }),
          deleteOtpCodes({ where: { id: otpAdmin.id } }),
        ]);
      });
    });

    describe("strict mode safety", () => {
      test("throws when and clause is empty", async () => {
        await expect(
          updateOtpCodes({
            // @ts-expect-error Testing invalid where clause
            where: { and: [] },
            values: { attempts: 1 },
          }),
        ).rejects.toThrow("Strict mode");
      });

      test("throws when or clause is empty", async () => {
        await expect(
          updateOtpCodes({
            // @ts-expect-error Testing invalid where clause
            where: { or: [] },
            values: { attempts: 1 },
          }),
        ).rejects.toThrow("Strict mode");
      });

      test("throws when nested clauses resolve to empty", async () => {
        await expect(
          updateOtpCodes({
            // @ts-expect-error Testing invalid where clause
            where: { and: [{ or: [] }] },
            values: { attempts: 1 },
          }),
        ).rejects.toThrow("Strict mode");
      });
    });
  });
});
